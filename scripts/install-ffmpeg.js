#!/usr/bin/env node
/**
 * Copy the ffmpeg-static / ffprobe-static binaries into resources/ffmpeg/
 * so the bundled-path check in main/main.ts resolves them in dev. This
 * makes "git clone && npm install" enough to run merges locally without
 * any system FFmpeg install.
 *
 * Runs as a postinstall step. Failures are non-fatal — npm install must
 * keep working on CI environments where the optional packages are not
 * available, or in packaged-build pipelines that supply a manual
 * ffmpeg.zip instead.
 */

const fs = require('fs');
const path = require('path');

function safeRequire(pkg) {
  try {
    return require(pkg);
  } catch {
    return null;
  }
}

function copyIfMissing(src, dest, label) {
  if (!src || !fs.existsSync(src)) {
    console.log(`[install-ffmpeg] ${label}: source not found, skipping`);
    return false;
  }
  if (fs.existsSync(dest)) {
    console.log(`[install-ffmpeg] ${label}: already present at ${dest}`);
    return true;
  }
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`[install-ffmpeg] ${label}: copied to ${dest}`);
  return true;
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const targetDir = path.join(projectRoot, 'resources', 'ffmpeg');
  fs.mkdirSync(targetDir, { recursive: true });

  const ext = process.platform === 'win32' ? '.exe' : '';

  const ffmpegSrc = safeRequire('ffmpeg-static');
  const ffprobeMod = safeRequire('ffprobe-static');
  const ffprobeSrc = ffprobeMod && typeof ffprobeMod === 'object'
    ? ffprobeMod.path
    : null;

  copyIfMissing(
    typeof ffmpegSrc === 'string' ? ffmpegSrc : null,
    path.join(targetDir, `ffmpeg${ext}`),
    'ffmpeg',
  );
  copyIfMissing(
    ffprobeSrc,
    path.join(targetDir, `ffprobe${ext}`),
    'ffprobe',
  );
}

try {
  main();
} catch (err) {
  console.warn(`[install-ffmpeg] non-fatal error: ${err.message}`);
}
