# FFmpeg Bundling Guide

## Overview

VideoMerger can bundle FFmpeg binaries with the installer, so end users don't need to install FFmpeg separately. When bundled, the app detects the included binary automatically and uses it.

## Current Packaged Version

- **Version**: `2026-03-12-git-9dc44b43b2-full_build-www.gyan.dev`
- **Source**: Gyan.dev (Full Build)
- **Included Binaries**: `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe`

## Directory Structure

```
resources/
  ffmpeg/
    ffmpeg.exe      (Windows)
    ffmpeg           (macOS / Linux)
```

## Detection Priority

1. **Bundled binary** — `resources/ffmpeg/ffmpeg(.exe)` in the packaged app directory
2. **System PATH** — Falls back to `where ffmpeg` (Windows) or `which ffmpeg` (Linux/macOS)

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
  return null;
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
