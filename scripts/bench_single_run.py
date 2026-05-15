#!/usr/bin/env python
"""Single-run wall-clock perf capture for the Final Engineering Review.

Generates a synthetic clip with ffmpeg's lavfi inputs and times a small
matrix of merge_videos invocations: baseline clip counts, quality
presets, and each Phase 1-3 toggle. The output is a JSON document
intended for direct inclusion in docs/AUDIT.md section 3.2.

Run from the repo root:

    python scripts/bench_single_run.py > docs/benchmarks/single_run.json
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src' / 'videomerger'))


def resolve_ffmpeg() -> str:
    bundled = ROOT / 'resources' / 'ffmpeg' / (
        'ffmpeg.exe' if os.name == 'nt' else 'ffmpeg'
    )
    if bundled.exists():
        return str(bundled)
    sys_path = shutil.which('ffmpeg')
    if sys_path:
        return sys_path
    raise SystemExit('ffmpeg not available; aborting benchmark')


def make_clip(ffmpeg: str, target: Path, duration: float) -> str:
    if target.exists():
        return str(target)
    cmd = [
        ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i',
        f'testsrc2=size=640x360:rate=30:duration={duration}',
        '-f', 'lavfi', '-i',
        f'sine=frequency=440:duration={duration}',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-c:a', 'aac', '-shortest', str(target),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return str(target)


def time_merge(merge_module, clips, output_path: Path, **kwargs):
    if output_path.exists():
        output_path.unlink()
    t0 = time.perf_counter()
    ok = merge_module.merge_videos(
        clips, str(output_path), overwrite=True, **kwargs,
    )
    elapsed = time.perf_counter() - t0
    return ok, elapsed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--clip-duration', type=float, default=2.0,
        help='Synthetic clip duration in seconds (default 2.0)',
    )
    args = parser.parse_args()

    ffmpeg = resolve_ffmpeg()
    # Put bundled ffmpeg on PATH for the duration of this run so
    # video_processor_cli's bare `ffmpeg` invocations resolve to it.
    os.environ['PATH'] = (
        os.path.dirname(ffmpeg) + os.pathsep + os.environ.get('PATH', '')
    )

    import video_processor_cli  # noqa: WPS433 — late import

    tmp = Path(tempfile.mkdtemp(prefix='vm_bench_'))
    try:
        clip = make_clip(
            ffmpeg, tmp / f'clip_{int(args.clip_duration * 1000)}.mp4',
            args.clip_duration,
        )

        results = {
            'clip_duration_sec': args.clip_duration,
            'platform': sys.platform,
            'ffmpeg': ffmpeg,
            'baseline_seconds_by_clip_count': {},
            'quality_seconds': {},
            'phase_overhead_seconds': {},
        }

        # Baseline: vary clip count
        for n in [2, 5, 10]:
            clips = [clip] * n
            ok, sec = time_merge(
                video_processor_cli, clips, tmp / f'baseline_{n}.mp4',
            )
            assert ok, f'baseline_{n} merge failed'
            results['baseline_seconds_by_clip_count'][n] = round(sec, 3)

        # Quality preset cost on 3 clips
        for q in ['low', 'medium', 'high']:
            clips = [clip] * 3
            ok, sec = time_merge(
                video_processor_cli, clips, tmp / f'quality_{q}.mp4',
                quality=q,
            )
            assert ok
            results['quality_seconds'][q] = round(sec, 3)

        # Phase 1 overhead: per-clip edits on 3 clips
        clips = [clip] * 3
        ok, sec = time_merge(
            video_processor_cli, clips, tmp / 'phase1.mp4',
            clip_edits=[
                {'trimStart': 0.2, 'brightness': 0.1},
                {'aspectRatio': '9:16', 'volume': 0.8},
                {'crop': {'x': 0, 'y': 0, 'width': 320, 'height': 240}},
            ],
        )
        assert ok
        results['phase_overhead_seconds']['phase1_per_clip_edits'] = round(sec, 3)

        # Phase 2 overhead: loudnorm
        ok, sec = time_merge(
            video_processor_cli, [clip] * 3, tmp / 'phase2.mp4',
            loudnorm={'enabled': True, 'targetLufs': -16},
        )
        assert ok
        results['phase_overhead_seconds']['phase2_loudnorm'] = round(sec, 3)

        # Phase 3 overhead: silence trim probe
        ok, sec = time_merge(
            video_processor_cli, [clip] * 3, tmp / 'phase3.mp4',
            auto_silence_trim=True,
        )
        assert ok
        results['phase_overhead_seconds']['phase3_silence_trim'] = round(sec, 3)

        print(json.dumps(results, indent=2))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
