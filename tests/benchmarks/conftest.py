"""Shared fixtures for the benchmark suite.

Generates synthetic test clips with ffmpeg's `lavfi` device (color
gradient video + sine-wave audio) so the benchmarks are reproducible
across machines and never depend on a user's personal media library.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src' / 'videomerger'))


def _resolve_ffmpeg() -> str | None:
    """Find a usable ffmpeg binary: bundled, then PATH."""
    bundled = ROOT / 'resources' / 'ffmpeg' / (
        'ffmpeg.exe' if os.name == 'nt' else 'ffmpeg'
    )
    if bundled.exists():
        return str(bundled)
    return shutil.which('ffmpeg')


@pytest.fixture(scope='session')
def ffmpeg_binary() -> str:
    binary = _resolve_ffmpeg()
    if not binary:
        pytest.skip('ffmpeg not available; benchmarks require it')
    return binary


@pytest.fixture(scope='session')
def synthetic_clip_factory(ffmpeg_binary, tmp_path_factory):
    """Returns a callable that creates a synthetic MP4 clip on demand.

    Each invocation produces a deterministic clip with the given
    duration, resolution, and frame rate. Clips are cached in a
    session-scoped temp dir so repeated calls reuse the same files.
    """
    cache_dir = tmp_path_factory.mktemp('synthetic_clips')

    def make_clip(
        duration_sec: float,
        width: int = 640,
        height: int = 360,
        fps: int = 30,
    ) -> str:
        name = f'clip_{int(duration_sec * 1000)}_{width}x{height}_{fps}.mp4'
        path = cache_dir / name
        if path.exists():
            return str(path)
        cmd = [
            ffmpeg_binary, '-y', '-hide_banner', '-loglevel', 'error',
            '-f', 'lavfi', '-i',
            f'testsrc2=size={width}x{height}:rate={fps}:duration={duration_sec}',
            '-f', 'lavfi', '-i',
            f'sine=frequency=440:duration={duration_sec}',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
            '-c:a', 'aac', '-shortest',
            str(path),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return str(path)

    return make_clip


@pytest.fixture
def merge_module():
    """Import and return the video_processor_cli module."""
    import video_processor_cli  # noqa: WPS433 — late import on purpose
    return video_processor_cli
