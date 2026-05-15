# VideoMerger Operational Runbook

Day-to-day operational reference for building, deploying, and debugging the VideoMerger desktop application. For incident-response and disaster-recovery scenarios see [DR.md](./DR.md).

---

## 1. Build From Scratch

### Prerequisites (one-time setup)

| Tool | Version | Notes |
|------|---------|-------|
| Git | any modern | https://git-scm.com |
| Node.js | 18 or 20 | https://nodejs.org (use the LTS) |
| Python | 3.9 – 3.11 | Whisper (faster-whisper) supports 3.9+ |
| Docker Desktop | latest | Only required for the installer build path |

**FFmpeg is not a manual prerequisite for development** — `npm install` fetches the `ffmpeg-static` / `ffprobe-static` binaries and the `postinstall` hook copies them into `resources/ffmpeg/`. See `docs/ffmpeg-bundling.md` for the full detection priority.

### Local development build

```bash
git clone https://github.com/J4ve/videomerger_app_revamp.git
cd videomerger_app_revamp
git checkout dev          # or whichever feature branch you're working on
npm install               # also runs scripts/install-ffmpeg.js postinstall
pip install -r requirements.txt
npm run dev
```

`npm run dev` orchestrates three concurrent processes:

- `vite` — renderer dev server (port 3000, hot-module-reload)
- `tsc -w` — main / core type checking and JS emission to `dist/main/`
- `electronmon` — boots Electron, auto-restarts on `dist/main/main.js` change

`wait-on` blocks `electronmon` until `dist/main/main.js` exists and port 3000 is alive so the first launch sequences cleanly.

### Packaged Windows installer (`.exe`)

Two paths are supported. Pick one:

#### Option A: Local Windows machine

```powershell
# Drop a Windows static FFmpeg bundle at the repo root as ffmpeg.zip
# (e.g. gyan.dev "ffmpeg-release-essentials"). The build unzips it.
npm install
npm run package
# Output: dist-bin/VideoMerger-Setup-<version>.exe
```

#### Option B: Docker on any host (no Node.js required)

```bash
# Drop ffmpeg.zip at repo root (same as Option A)
docker compose run --rm builder
# Output: dist-bin/VideoMerger-Setup-<version>.exe
```

The Docker `builder` service uses the `electronuserland/builder:wine` image, so the resulting `.exe` is produced from a Linux/Wine environment and is bit-identical to what GitHub Actions produces.

### CI-built artifact

Every push to `main`, `dev`, or `feat/**` triggers the GitHub Actions workflow at `.github/workflows/ci.yml`. The `desktop-build` job runs on `windows-latest`, runs `npm install` + `npm run build` + `npm run package`, and uploads `dist-bin/*.exe` as a workflow artifact retained for 14 days. To download:

```
GitHub → Actions → CI/CD Pipeline → <run> → Artifacts → VideoMerger-Windows-<sha>
```

---

## 2. Rollback A Failed Deployment

### Rolling back the source

```bash
# Identify the bad commit
git log --oneline -20

# Revert the offending commit on a new commit so the history stays linear
git revert <bad-sha>
git push origin <branch>

# OR for a stack of bad commits, branch off the last good sha and force-push
git checkout -b rollback-<date> <last-good-sha>
git push -u origin rollback-<date>
```

CI re-runs and produces a new installer artifact from the rolled-back tree. Hand the artifact URL to anyone running the failed build.

### Rolling back a packaged installer that's already with users

The team currently distributes installers manually (no auto-update server). Process:

1. Pull the prior known-good `.exe` from the CI artifacts archive (see "CI-built artifact" above).
2. Email / Discord the prior installer to affected users with a one-line summary of which bug they're avoiding.
3. Cut a new commit that reverts the regression on `dev`, let CI build it, and circulate that build once verified.
4. Users uninstall the bad version via Windows "Apps & Features", then run the previous installer.

User settings live in `%APPDATA%\VideoMerger\config.json` and survive uninstalls; preset packs in the user's chosen export directory also survive. Only the application binaries are replaced.

### Rolling back the Flask web app container

```bash
# Tag-based rollback (Docker Hub or whichever registry is used)
docker pull videomerger:<previous-tag>
docker stop videomerger && docker rm videomerger
docker run -d --name videomerger -p 5000:5000 videomerger:<previous-tag>
```

The Flask app is stateless (uploads + outputs live on the host volume) so a container swap is safe to perform live.

---

## 3. System Logs During An Outage

### Desktop app logs

The Electron main process logs to stdout and to the Electron-managed log directory.

| Platform | Log path |
|----------|----------|
| Windows | `%APPDATA%\VideoMerger\logs\` |
| macOS | `~/Library/Logs/VideoMerger/` (when packaged) |
| Linux | `~/.config/VideoMerger/logs/` |

In development the same lines appear in the `[electron]` stream of `npm run dev`.

Useful grep patterns:

```bash
# Auth flow
grep "\[Auth\]" main.log

# FFmpeg detection and merge invocations
grep "\[DEBUG\] FFmpeg\|\[DEBUG\] Python interpreter resolved" main.log

# Local-video protocol failures (preview issues)
grep "\[local-video\] handler error" main.log

# Auto-caption transcription
grep "INFO: Loading Whisper model\|SUCCESS: Wrote SRT" main.log
```

### Renderer logs

Renderer console output is visible in Electron's DevTools (`Ctrl+Shift+I` when the app window is focused). Phase 4 preview errors are logged with the tag `[Preview] HTMLMediaError` and include `code`, `label`, `message`, and `src` fields — see `renderer/src/App.tsx:handlePreviewPlaybackError`.

### Python subprocess logs

The video processor CLI prints `INFO:` / `WARNING:` / `ERROR:` / `PROGRESS:` lines on stdout. These are forwarded to the main-process log unmodified, so any merge issue shows up under the corresponding `merge-videos` IPC handler invocation.

To reproduce a merge issue outside the app, run the same CLI directly:

```bash
python src/videomerger/video_processor_cli.py --merge \
  --inputs <clip1> <clip2> \
  --output merged.mp4 \
  --quality medium \
  --allow-hwaccel        # only if the user had hwaccel on
```

Add `--clips-json <path>` to reproduce per-clip-edit cases, or `--captions` / `--loudnorm` / `--auto-silence-trim` to isolate one phase.

### Flask web app logs

```bash
docker logs videomerger
docker logs -f videomerger   # follow
```

---

## 4. Common Operations

### Re-running the FFmpeg postinstall (binaries missing)

```bash
node scripts/install-ffmpeg.js
ls resources/ffmpeg/   # should show ffmpeg.exe + ffprobe.exe on Windows
```

### Force a fresh Whisper model download

```bash
# Hugging Face cache lives here by default
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-base/
# Re-run any merge with --captions to repopulate the cache
```

### Reset OAuth state

```powershell
# Delete the encrypted Google auth blob
Remove-Item "$env:APPDATA\VideoMerger\config.json"
```

The user will be prompted to sign in again on next launch.

### Running the full test suite locally

```bash
npm test                                 # vitest (renderer)
npm run test:core                        # vitest (core + main suites)
pytest tests/unit -v --no-cov            # Python unit tests
pytest tests/benchmarks --benchmark-only \
       --benchmark-save=local-baseline   # Phase 5b perf benchmarks
```
