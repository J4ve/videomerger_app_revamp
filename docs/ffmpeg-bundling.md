# FFmpeg Bundling Guide

## Overview

VideoMerger ships FFmpeg in two distinct ways depending on the target:

| Target | Source | When |
|--------|--------|------|
| **Development** (`npm run dev`) | `ffmpeg-static` / `ffprobe-static` (devDeps), copied into `resources/ffmpeg/` by `scripts/install-ffmpeg.js` during `npm install` postinstall | Automatic — runs on `npm install` |
| **Packaged installer** (`npm run package`, `docker compose run builder`) | Manual `ffmpeg.zip` placed at repo root, extracted into `resources/ffmpeg/` by `docker-compose.yml` builder service | Manual — you provide the zip |

In both cases the runtime detection code in `main/main.ts` looks for binaries inside `resources/ffmpeg/` first, so the app behavior is identical regardless of which path put them there.

## Development setup (automatic)

```bash
npm install
```

This pulls `ffmpeg-static` and `ffprobe-static` into `node_modules/`, then the `postinstall` script (`scripts/install-ffmpeg.js`) copies the two `.exe` files into `resources/ffmpeg/`. Once that completes:

```
resources/
  ffmpeg/
    ffmpeg.exe      (~82 MB, ffmpeg-static v5.x — currently 6.1.1 build)
    ffprobe.exe     (~63 MB, ffprobe-static v3.x)
```

`resources/ffmpeg/` is gitignored, so the binaries never enter version control — each contributor regenerates them from `npm install`.

> **Why a postinstall copy and not just point at `node_modules/`?** Two reasons:
> 1. `resources/ffmpeg/` is the same path the packaged-app detection code expects, so dev and prod code paths stay identical.
> 2. electron-builder's asar archive cannot execute binaries directly from inside the archive. `resources/` is treated as `extraResources` and is always unpacked.

## Packaged-installer setup (manual)

When building the Windows installer via Docker:

1. Download a Windows static build (recommended: [gyan.dev "ffmpeg-release-essentials"](https://www.gyan.dev/ffmpeg/builds/))
2. Place the zip as `ffmpeg.zip` at the **repo root** (not inside `resources/`)
3. Run `docker compose run builder`

The builder service in `docker-compose.yml` runs:
```
unzip -o ffmpeg.zip -d ffmpeg_temp && cp ffmpeg_temp/ffmpeg/bin/*.exe resources/ffmpeg/
```

so the bundled-binary detection at runtime resolves them inside the installed app.

The `ffmpeg-static` / `ffprobe-static` packages are **devDependencies** and are excluded from the packaged installer. Without the manual zip step the packaged `.exe` will ship without FFmpeg.

## Directory Structure

```
resources/
  ffmpeg/
    ffmpeg.exe      (Windows)
    ffprobe.exe     (Windows)
    ffmpeg          (macOS / Linux — current dev install is Windows-only via ffmpeg-static)
```

## Detection Priority

1. **Bundled binary** — `resources/ffmpeg/ffmpeg(.exe)` in the packaged app directory or dev `resources/`
2. **ffmpeg-static fallback** — `require('ffmpeg-static')` path inside `node_modules/`, in case the postinstall copy did not run
3. **System PATH** — Falls back to `where ffmpeg` (Windows) or `which ffmpeg` (Linux/macOS)

The detection logic is in `main/main.ts`:

```typescript
function getBundledFFmpegPath(): string | null {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const possiblePaths = [
    path.join(process.resourcesPath || '', 'ffmpeg', `ffmpeg${ext}`),
    path.join(__dirname, '../../resources/ffmpeg', `ffmpeg${ext}`),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return getStaticBinaryPath('ffmpeg-static');
}
```

## Adding FFmpeg to Installer

### Windows (electron-builder)

In `electron-builder` config (package.json or `electron-builder.json`):

```json
{
  "extraResources": [
    {
      "from": "resources/ffmpeg/",
      "to": "ffmpeg/",
      "filter": ["ffmpeg.exe"]
    }
  ]
}
```

### macOS / Linux

Same approach with platform-specific binary:

```json
{
  "extraResources": [
    {
      "from": "resources/ffmpeg/",
      "to": "ffmpeg/"
    }
  ]
}
```

## Downloading FFmpeg Binaries

- **Windows**: https://www.gyan.dev/ffmpeg/builds/ (static build recommended)
- **macOS**: https://evermeet.cx/ffmpeg/
- **Linux**: https://johnvansickle.com/ffmpeg/

Place the binary in `resources/ffmpeg/` before building the installer.

## Size Impact

FFmpeg static binaries are approximately **~80 MB** per platform. The installer size will increase accordingly.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| FFmpeg shows "Not Installed" | Check the binary is in `resources/ffmpeg/` and has execute permission |
| Wrong FFmpeg version | Replace the binary in `resources/ffmpeg/` |
| User has system FFmpeg | Bundled takes priority; system PATH is fallback |
