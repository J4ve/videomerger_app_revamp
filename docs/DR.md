# Disaster Recovery

Procedures for recovering from data-loss or full-environment-loss events. Day-to-day operations are in [RUNBOOK.md](./RUNBOOK.md).

---

## Scope

VideoMerger is a desktop application with a small legacy Flask companion. The blast radius for any single failure is therefore narrow:

| Component | What "disaster" means here |
|-----------|----------------------------|
| Source code | GitHub repo (`J4ve/videomerger_app_revamp`) is the system of record. Local clones are recoverable from the remote. |
| CI / build artifacts | GitHub Actions retains workflow artifacts for 14 days. Older builds must be rebuilt from source. |
| User data on installed clients | Each user's `%APPDATA%\VideoMerger\` is local and not centrally backed up. The user owns recovery of their preset packs, output videos, and OAuth state. |
| Flask web app data | Uploads + merged outputs in the container's mounted volume. Not currently replicated. |

There is **no centralized user database, no shared object storage, and no managed multi-tenant deployment**. Most disaster scenarios reduce to "rebuild from source and let users re-install."

---

## Recovery Scenarios

### A. Lost GitHub repository

Worst case if the GitHub remote is wiped, transferred, or made private without the team being able to access it.

1. Pull the latest known-good clone from any team member's machine.
2. Create a new remote (any provider) and `git push --mirror` from that clone:
   ```bash
   git remote add backup <new-remote-url>
   git push --mirror backup
   ```
3. Update `package.json` and any docs that hard-link to the old URL.
4. Restore CI by copying `.github/workflows/ci.yml` to the new repo (already version-controlled — no separate config to restore).
5. Re-tag the latest release if the team uses tags for builds.

Mitigation: each team member periodically `git clone --mirror` to a personal backup so a current copy always exists outside GitHub.

### B. Lost CI pipeline / corrupted build

Symptoms: `desktop-build` job fails for unrelated PRs, artifacts are corrupted, runners stuck.

1. Re-run the failing job from the GitHub Actions UI ("Re-run all jobs"). Most transient failures (npm registry blip, electron-builder download) resolve here.
2. If the runner image upstream has changed, pin `runs-on: windows-2022` and re-run.
3. Reset `node_modules` between runs by clearing the GitHub Actions cache and re-running.
4. As a last resort: build the installer locally per the runbook's Option A or via Docker Option B and circulate that `.exe` until CI is restored.

Mitigation: every committer can run `npm run package` (Option A) so CI is never the only path.

### C. Lost packaged installer (`.exe` deleted from artifacts)

GitHub retains workflow artifacts for 14 days by default. After that:

1. Identify the commit SHA the installer was built from.
2. `git checkout <sha>` locally and run `npm run package` (Option A) or `docker compose run --rm builder` (Option B). Both reproduce a byte-equivalent installer given the same `ffmpeg.zip` input.
3. Re-upload to wherever the team distributes builds.

For long-lived release-tagged builds, copy the `.exe` out of CI artifacts into a durable location (Drive, S3, Releases page) within the 14-day window.

### D. Compromised OAuth credentials / accidentally leaked tokens

OAuth tokens are encrypted on disk via `safeStorage` (DPAPI on Windows). They're still revocable centrally:

1. Revoke the affected user's access in [Google Account → Connected apps](https://myaccount.google.com/connections).
2. Rotate the client_id / client_secret in `main/oauthConfig.ts` (the runtime config path) and ship a new build.
3. Force a re-login by clearing each user's `%APPDATA%\VideoMerger\config.json` (or hand them the encrypted-blob keys to delete: `googleAuthSecret`, `googleAuthProfile`).
4. Audit `[Auth]` log lines in any backup for unusual access patterns.

Mitigation: tokens are encrypted with the user's OS keychain (Phase 5c hardening). A plain file copy of `config.json` no longer leaks usable credentials.

### E. Lost user merged outputs / preset packs

Each user's outputs live wherever they chose to save them (default: their selected output directory; preset packs are exported on demand).

VideoMerger does not back these up. Recovery is per-user via:

1. Their OS-level backup (File History on Windows, Time Machine on macOS).
2. The team-distributed installer **does not** retain or upload user content — there is no server-side copy to restore from.

Mitigation: encourage users to point the output directory at a backed-up location, and to re-export their preset packs after major changes.

### F. Flask web app data loss

Applies only to the legacy `src/videomerger/` Flask service if it is being run.

1. The Docker container is stateless. The host-mounted volume (`/app/src/videomerger/static/uploads` and `outputs`) holds user data.
2. Restore from the most recent volume backup, or accept the loss and announce a re-upload window.
3. The container itself rebuilds from `Dockerfile` — see the runbook.

Mitigation: schedule volume snapshots if this deployment becomes load-bearing again. Currently it is dev-focused.

---

## Recovery Verification Checklist

After any rebuild, confirm the system is healthy before declaring the incident resolved:

1. ✅ `npm run dev` boots and renders the React UI.
2. ✅ FFmpeg detection succeeds (no red banner in the app).
3. ✅ A two-clip synthetic merge completes (use `tests/benchmarks` synthetic clip factory).
4. ✅ OAuth sign-in completes and the user blob is stored encrypted (open `%APPDATA%\VideoMerger\config.json` — `googleAuthSecret` should be a base64 string, not a JSON object).
5. ✅ Both vitest suites pass: `npm test`, `npm run test:core`.
6. ✅ pytest unit suite passes: `pytest tests/unit -v`.
7. ✅ CI `desktop-build` job produces an artifact for the recovery branch.

---

## Contact

| Role | Owner |
|------|-------|
| Team lead / repo owner | Jave A. Bacsain (J4ve) |
| Backend lead | Carl Gerald J. Parro |
| Frontend lead | Marc Justin N. Prestado |

In an active incident, post in the team's coordination channel before taking destructive recovery actions (force-push, volume restore, secret rotation). Two-person confirmation prevents accidental data loss during a stressful response.
