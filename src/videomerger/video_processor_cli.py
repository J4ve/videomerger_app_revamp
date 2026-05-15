#!/usr/bin/env python

# finally works bro pls do not touch this file
# again unless you know what ur doing lmao
"""
Video processor CLI for Electron integration
Handles FFmpeg operations via command line
with robust merging and real-time progress
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


def check_ffmpeg():
    """Check if FFmpeg and FFprobe are available."""
    try:
        subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        subprocess.run(
            ['ffprobe', '-version'],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        print('FFmpeg and FFprobe available')
        return True
    except Exception:
        print('FFmpeg/FFprobe not available', file=sys.stderr)
        return False


def get_ffmpeg_version():
    """Get FFmpeg version."""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(version_line)
            return version_line
    except Exception:
        pass
    print('unknown')
    return 'unknown'


def _get_total_duration(video_paths):
    """Get total duration of all videos in seconds using ffprobe."""
    total = 0.0
    for video_path in video_paths:
        try:
            cmd = [
                'ffprobe',
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                video_path,
            ]
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            duration = float(result.stdout.strip())
            total += duration
        except Exception as e:
            print(
                f'WARNING: Could not get duration for {video_path}: {e}',
                file=sys.stderr,
            )
    return total


def _parse_time_from_ffmpeg(line):
    """Parse current time from FFmpeg stderr output."""
    try:
        if 'time=' in line:
            time_str = line.split('time=')[1].split()[0]
            # Parse HH:MM:SS.ms format
            parts = time_str.split(':')
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
    except Exception:
        pass
    return None


def _get_video_properties(video_path):
    """Get width, height, and framerate of a video using ffprobe."""
    try:
        cmd = [
            'ffprobe',
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=width,height,r_frame_rate',
            '-of',
            'json',
            video_path,
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        info = json.loads(result.stdout)
        stream = info['streams'][0]

        width = int(stream['width'])
        height = int(stream['height'])

        fps_str = stream.get('r_frame_rate', '30/1')
        num, den = map(int, fps_str.split('/'))
        fps = num / den if den != 0 else 30.0

        return width, height, fps
    except Exception as e:
        print(
            f'WARNING: Could not read properties for {video_path}: {e}',
            file=sys.stderr,
        )
        return 1920, 1080, 30.0


def _has_audio(video_path):
    """Return True if the input contains an audio stream."""
    try:
        cmd = [
            'ffprobe',
            '-v',
            'error',
            '-select_streams',
            'a:0',
            '-show_entries',
            'stream=codec_type',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            video_path,
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.returncode == 0 and bool(result.stdout.strip())
    except Exception as e:
        print(
            f'WARNING: Could not detect audio stream for {video_path}: {e}',
            file=sys.stderr,
        )
        return False


def _get_duration(video_path):
    """Get duration of a single video in seconds."""
    try:
        cmd = [
            'ffprobe',
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            video_path,
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def _parse_time_from_progress(line):
    """Parse time from FFmpeg's machine-readable -progress output."""
    if line.startswith('out_time_ms='):
        try:
            # Convert microseconds to seconds
            microseconds = int(line.strip().split('=')[1])
            return microseconds / 1000000.0
        except ValueError:
            pass
    return None


# ---------- Silence detection helpers (Phase 3) ----------

# silencedetect prints lines like:
#   [silencedetect @ 0x...] silence_start: 0
#   [silencedetect @ 0x...] silence_end: 2.345 | silence_duration: 2.345
_SILENCE_START_RE = re.compile(r'silence_start:\s*([-\d.]+)')
_SILENCE_END_RE = re.compile(
    r'silence_end:\s*([-\d.]+)\s*\|\s*silence_duration:\s*([-\d.]+)'
)


def _parse_silence_events(stderr_text):
    """Parse silencedetect events from ffmpeg stderr.

    Returns a list of (start, end) tuples sorted by start time. ``end``
    may be ``None`` when the silence extends past the end of the
    stream (i.e. trailing silence with no closing end event).
    """
    events = []
    pending_start = None
    for line in stderr_text.splitlines():
        ms = _SILENCE_START_RE.search(line)
        if ms:
            pending_start = float(ms.group(1))
            continue
        me = _SILENCE_END_RE.search(line)
        if me and pending_start is not None:
            events.append((pending_start, float(me.group(1))))
            pending_start = None
    # Unclosed trailing silence — duration up to end of clip
    if pending_start is not None:
        events.append((pending_start, None))
    return events


def detect_silence_boundaries(
    video_path,
    threshold_db=-50.0,
    min_duration=0.5,
    duration_hint=None,
):
    """Detect leading + trailing silence durations for a single clip.

    Runs a fast probing pass with the ``silencedetect`` audio filter
    and parses its stderr log. Returns ``(leading, trailing)`` in
    seconds. Both values default to ``0.0`` if no silence is detected,
    if the clip has no audio, or if ffmpeg fails to run.

    Only edges are reported. Mid-clip silence is intentionally
    ignored so callers can apply the result directly to the
    Phase 1 trimStart / trimEnd mechanism, keeping audio + video
    in sync without complex filter expressions.
    """
    if not _has_audio(video_path):
        return 0.0, 0.0

    if duration_hint is None:
        duration_hint = _get_duration(video_path) or 0.0

    cmd = [
        'ffmpeg',
        '-hide_banner',
        '-nostdin',
        '-i', video_path,
        '-af', f'silencedetect=noise={threshold_db}dB:d={min_duration}',
        '-f', 'null',
        '-',
    ]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            text=True,
        )
    except OSError as exc:
        print(
            f'WARNING: silencedetect failed for {video_path}: {exc}',
            file=sys.stderr,
        )
        return 0.0, 0.0

    events = _parse_silence_events(result.stderr or '')
    if not events:
        return 0.0, 0.0

    leading = 0.0
    first_start, first_end = events[0]
    if first_start <= 0.05 and first_end is not None:
        leading = max(0.0, first_end)

    trailing = 0.0
    last_start, last_end = events[-1]
    if duration_hint > 0:
        if last_end is None:
            trailing = max(0.0, duration_hint - last_start)
        elif duration_hint - last_end <= 0.05:
            trailing = max(0.0, duration_hint - last_start)

    return leading, trailing


def _augment_edits_with_silence_trim(
    input_paths,
    clip_edits,
    raw_durations,
    threshold_db,
    min_duration,
):
    """Run silencedetect on each clip and add detected silence to trims.

    Mutates ``clip_edits`` in place so the existing trimStart / trimEnd
    pipeline picks up the auto-detected values. Existing manual trim
    values from the user are preserved and the detected silence is
    added on top — never replaced.
    """
    print('INFO: Detecting silence boundaries for auto-trim...')
    for index, path in enumerate(input_paths):
        leading, trailing = detect_silence_boundaries(
            path,
            threshold_db=threshold_db,
            min_duration=min_duration,
            duration_hint=raw_durations[index],
        )
        if leading <= 0 and trailing <= 0:
            continue
        edit = clip_edits[index]
        try:
            existing_start = float(edit.get('trimStart', 0) or 0)
        except (TypeError, ValueError):
            existing_start = 0.0
        try:
            existing_end = float(edit.get('trimEnd', 0) or 0)
        except (TypeError, ValueError):
            existing_end = 0.0
        edit['trimStart'] = existing_start + leading
        edit['trimEnd'] = existing_end + trailing
        print(
            f'INFO:   {os.path.basename(path)} '
            f'-> +{leading:.2f}s leading, +{trailing:.2f}s trailing'
        )


# ---------- Per-clip edit helpers (Phase 1) ----------

ASPECT_PRESETS = {
    '16:9': (16, 9),
    '9:16': (9, 16),
    '1:1': (1, 1),
    '4:5': (4, 5),
    '4:3': (4, 3),
}


def _load_clip_edits(clips_json_path, input_paths):
    """Load per-clip edits keyed to input_paths order.

    Returns a list of dicts (one per input) with normalized fields, or
    None if the JSON file is missing/empty/malformed (caller falls back
    to default behavior).
    """
    if not clips_json_path or not os.path.exists(clips_json_path):
        return None
    try:
        with open(clips_json_path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        print(
            f'WARNING: Could not read clips JSON ({exc}); '
            f'falling back to defaults',
            file=sys.stderr,
        )
        return None

    clips = data.get('clips') if isinstance(data, dict) else None
    if not isinstance(clips, list) or len(clips) != len(input_paths):
        return None

    edits = []
    for entry in clips:
        edit = entry.get('edits') if isinstance(entry, dict) else {}
        edits.append(edit if isinstance(edit, dict) else {})
    return edits


def _clip_effective_duration(raw_duration, edit):
    """Return clip duration after trimStart/trimEnd applied."""
    start = max(float(edit.get('trimStart', 0) or 0), 0.0)
    end_trim = max(float(edit.get('trimEnd', 0) or 0), 0.0)
    effective = max(raw_duration - start - end_trim, 0.0)
    return effective


def _aspect_target_dims(edit, default_w, default_h):
    """Pick target dims based on aspectRatio preset for a clip.

    Returns (w, h) divisible by 2. Falls back to baseline dims when
    preset is 'original' or unknown.
    """
    preset = (edit or {}).get('aspectRatio') or 'original'
    if preset == 'original':
        return default_w, default_h
    if preset == 'custom':
        try:
            cw = int(edit.get('aspectWidth') or 0)
            ch = int(edit.get('aspectHeight') or 0)
        except (TypeError, ValueError):
            cw = ch = 0
        if cw > 0 and ch > 0:
            ratio_w, ratio_h = cw, ch
        else:
            return default_w, default_h
    elif preset in ASPECT_PRESETS:
        ratio_w, ratio_h = ASPECT_PRESETS[preset]
    else:
        return default_w, default_h

    # Fit to baseline area while honoring aspect ratio
    base_area = default_w * default_h
    h = int((base_area * ratio_h / ratio_w) ** 0.5)
    w = int(h * ratio_w / ratio_h)
    w -= w % 2
    h -= h % 2
    return max(w, 2), max(h, 2)


def _build_clip_video_chain(edit, target_w, target_h, target_fps):
    """Build the video filter chain string for one clip.

    Order: trim -> crop -> scale+pad(aspect target) -> fps -> eq -> format.
    """
    filters = []

    # Trim is applied at input level via -ss / -t (faster + frame-accurate
    # with re-encode). Filter only needs to rebase PTS so concat timestamps
    # start at 0 for each clip segment.
    start = max(float(edit.get('trimStart', 0) or 0), 0.0)
    end_trim = max(float(edit.get('trimEnd', 0) or 0), 0.0)
    if start > 0 or end_trim > 0:
        filters.append('setpts=PTS-STARTPTS')

    crop = edit.get('crop') or {}
    try:
        cw = int(crop.get('width') or 0)
        ch = int(crop.get('height') or 0)
        cx = int(crop.get('x') or 0)
        cy = int(crop.get('y') or 0)
    except (TypeError, ValueError):
        cw = ch = cx = cy = 0
    if cw > 0 and ch > 0:
        filters.append(f'crop={cw}:{ch}:{cx}:{cy}')

    aspect_w, aspect_h = _aspect_target_dims(edit, target_w, target_h)
    filters.append(
        f'scale={aspect_w}:{aspect_h}:'
        'force_original_aspect_ratio=decrease'
    )
    filters.append(
        f'pad={aspect_w}:{aspect_h}:(ow-iw)/2:(oh-ih)/2'
    )

    filters.append(f'fps={target_fps}')

    try:
        brightness = float(edit.get('brightness') or 0)
    except (TypeError, ValueError):
        brightness = 0.0
    try:
        contrast = float(edit.get('contrast', 1.0) or 1.0)
    except (TypeError, ValueError):
        contrast = 1.0
    try:
        saturation = float(edit.get('saturation', 1.0) or 1.0)
    except (TypeError, ValueError):
        saturation = 1.0
    if brightness != 0.0 or contrast != 1.0 or saturation != 1.0:
        # Clamp to ffmpeg-supported ranges
        brightness = max(-1.0, min(1.0, brightness))
        contrast = max(0.0, min(2.0, contrast))
        saturation = max(0.0, min(3.0, saturation))
        filters.append(
            f'eq=brightness={brightness:.3f}:'
            f'contrast={contrast:.3f}:'
            f'saturation={saturation:.3f}'
        )

    filters.append('format=yuv420p')
    return ','.join(filters)


def _build_clip_audio_chain(edit, target_audio_rate, loudnorm=None):
    """Build the audio filter chain string for one clip.

    When ``loudnorm`` is a dict with ``enabled: True`` we append the
    EBU R128 ``loudnorm`` filter with the supplied target LUFS / true
    peak / loudness range. This is the single-pass form — adequate
    for the "fast merge" workflow at the cost of slightly less
    accurate LUFS targeting compared to a measure-then-normalize
    two-pass.
    """
    filters = []

    # Trim handled by input-level -ss/-t. Filter only rebases PTS.
    start = max(float(edit.get('trimStart', 0) or 0), 0.0)
    end_trim = max(float(edit.get('trimEnd', 0) or 0), 0.0)
    if start > 0 or end_trim > 0:
        filters.append('asetpts=PTS-STARTPTS')

    filters.append(
        f'aformat=sample_rates={target_audio_rate}:channel_layouts=stereo'
    )

    try:
        volume = float(edit.get('volume', 1.0) or 1.0)
    except (TypeError, ValueError):
        volume = 1.0
    if abs(volume - 1.0) > 1e-6:
        volume = max(0.0, min(volume, 8.0))
        filters.append(f'volume={volume:.3f}')

    if loudnorm and loudnorm.get('enabled'):
        try:
            target_lufs = float(loudnorm.get('targetLufs', -16) or -16)
        except (TypeError, ValueError):
            target_lufs = -16.0
        try:
            true_peak = float(loudnorm.get('truePeak', -1.5) or -1.5)
        except (TypeError, ValueError):
            true_peak = -1.5
        try:
            lra = float(loudnorm.get('loudnessRange', 11) or 11)
        except (TypeError, ValueError):
            lra = 11.0
        # Clamp to ffmpeg-supported ranges so a malformed UI input
        # does not crash the filter graph.
        target_lufs = max(-70.0, min(-5.0, target_lufs))
        true_peak = max(-9.0, min(0.0, true_peak))
        lra = max(1.0, min(50.0, lra))
        filters.append(
            f'loudnorm=I={target_lufs:.2f}:TP={true_peak:.2f}:LRA={lra:.2f}'
        )

    return ','.join(filters)


def merge_videos(
    input_paths,
    output_path,
    quality='medium',
    codec='H.264',
    overwrite=False,
    disable_hwaccel=True,
    clip_edits=None,
    loudnorm=None,
    auto_silence_trim=False,
    silence_threshold_db=-50.0,
    silence_min_duration=0.5,
):
    """Normalize clips and concatenate them into a single output video."""
    if len(input_paths) < 2:
        print('ERROR: At least 2 videos required', file=sys.stderr)
        return False

    # Keep absolute output path before changing the working directory.
    output_path = os.path.abspath(output_path)

    print('INFO: Analyzing videos to find optimal baseline...')
    lowest_area = float('inf')
    target_width, target_height, target_fps = 1920, 1080, 60.0

    for path in input_paths:
        width, height, fps = _get_video_properties(path)
        if (width * height) < lowest_area:
            lowest_area = width * height
            target_width, target_height = width, height
        if fps < target_fps:
            target_fps = fps

    target_width -= target_width % 2
    target_height -= target_height % 2
    target_fps = round(target_fps, 2)
    target_audio_rate = 48000

    print(
        f'INFO: Baseline set to {target_width}x{target_height} '
        f'@ {target_fps} fps'
    )

    # Maintain smooth 0-100 progress tracking across all clips.
    raw_durations = [_get_duration(path) for path in input_paths]
    if clip_edits is None:
        clip_edits = [{} for _ in input_paths]

    if auto_silence_trim:
        _augment_edits_with_silence_trim(
            input_paths,
            clip_edits,
            raw_durations,
            threshold_db=silence_threshold_db,
            min_duration=silence_min_duration,
        )

    durations = [
        _clip_effective_duration(raw_durations[i], clip_edits[i])
        for i in range(len(input_paths))
    ]
    total_duration = sum(durations)
    accumulated_duration = 0.0

    codec_map = {
        'H.264': 'libx264',
        'H.265': 'libx265',
        'VP8': 'libvpx',
        'VP9': 'libvpx-vp9',
        'AV1': 'libaom-av1',
    }
    ffmpeg_codec = codec_map.get(codec, 'libx264')
    quality_settings = {
        'low': ['-crf', '28', '-preset', 'ultrafast'],
        'medium': ['-crf', '23', '-preset', 'medium'],
        'high': ['-crf', '18', '-preset', 'slow'],
    }

    temp_dir = tempfile.mkdtemp(prefix='video_proc_')
    normalized_files = []

    try:
        print('INFO: Starting Pass 1 (Normalizing clips sequentially)...')

        for index, path in enumerate(input_paths):
            temp_filename = f'norm_{index}.mp4'
            temp_filepath = os.path.join(temp_dir, temp_filename)
            normalized_files.append(temp_filename)

            edit = clip_edits[index] if index < len(clip_edits) else {}
            filter_v = _build_clip_video_chain(
                edit, target_width, target_height, target_fps
            )
            filter_a_chain = _build_clip_audio_chain(
                edit, target_audio_rate, loudnorm=loudnorm,
            )

            cmd = ['ffmpeg', '-y', '-hide_banner', '-nostdin']
            if disable_hwaccel:
                cmd.extend(['-hwaccel', 'none'])

            # Input-level trim: -ss seeks before -i (fast), -t caps duration.
            # Combined with setpts/asetpts in filter chain to rebase PTS.
            try:
                trim_start = max(float(edit.get('trimStart', 0) or 0), 0.0)
            except (TypeError, ValueError):
                trim_start = 0.0
            if trim_start > 0:
                cmd.extend(['-ss', f'{trim_start:.3f}'])

            cmd.extend(['-i', path])

            effective = durations[index]
            if effective > 0 and effective < raw_durations[index]:
                cmd.extend(['-t', f'{effective:.3f}'])

            has_audio = _has_audio(path)
            if has_audio:
                filter_str = (
                    f'[0:v]{filter_v}[outv]; [0:a]{filter_a_chain}[outa]'
                )
            else:
                # Synthesize silent stereo track at target rate; volume in
                # filter_a_chain still applies (no-op when source missing).
                filter_str = (
                    f'[0:v]{filter_v}[outv]; '
                    f'anullsrc=r={target_audio_rate}:cl=stereo[outa]'
                )

            cmd.extend([
                '-filter_complex',
                filter_str,
                '-map',
                '[outv]',
                '-map',
                '[outa]',
            ])
            cmd.extend(['-c:v', ffmpeg_codec])
            cmd.extend(
                quality_settings.get(quality, quality_settings['medium'])
            )
            cmd.extend(['-c:a', 'aac', '-b:a', '192k'])

            # If we synthesize audio via anullsrc, stop output when video ends.
            if not has_audio:
                cmd.append('-shortest')

            cmd.extend(['-progress', 'pipe:1', temp_filepath])

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                universal_newlines=True,
                encoding='utf-8',
            )

            for line in process.stdout:
                current_time = _parse_time_from_progress(line)
                if current_time is not None and total_duration > 0:
                    overall_time = accumulated_duration + current_time
                    percentage = min(
                        int((overall_time / total_duration) * 100),
                        100,
                    )
                    print(f'PROGRESS: {percentage}', flush=True)

            process.wait()
            if process.returncode != 0:
                print(
                    f'ERROR: Failed to normalize video {path}',
                    file=sys.stderr,
                )
                return False

            accumulated_duration += durations[index]

        print('\nINFO: Starting Pass 2 (Zero-RAM fast concatenation)...')
        list_file_path = os.path.join(temp_dir, 'files.txt')

        with open(list_file_path, 'w', encoding='utf-8') as file_obj:
            for normalized in normalized_files:
                file_obj.write(f"file '{normalized}'\n")

        concat_cmd = [
            'ffmpeg',
            '-y',
            '-hide_banner',
            '-nostdin',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            'files.txt',
            '-c',
            'copy',
            output_path,
        ]

        result = subprocess.run(
            concat_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            cwd=temp_dir,
        )

        if result.returncode == 0:
            print('PROGRESS: 100', flush=True)
            print(f'\nSUCCESS: Merged videos to {output_path}')
            return True

        print(
            f'\nERROR: Concat failed with exit code {result.returncode}',
            file=sys.stderr,
        )
        return False

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def main():
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description='Video processor CLI')
    parser.add_argument('--ffmpeg-path', help='Path to FFmpeg executable')
    parser.add_argument(
        '--check-ffmpeg',
        action='store_true',
        help='Check if FFmpeg is available',
    )
    parser.add_argument(
        '--version',
        action='store_true',
        help='Get FFmpeg version',
    )
    parser.add_argument('--merge', action='store_true', help='Merge videos')
    parser.add_argument('--inputs', nargs='+', help='Input video files')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument(
        '--quality',
        choices=['low', 'medium', 'high'],
        default='medium',
        help='Output quality',
    )
    parser.add_argument(
        '--codec',
        default='H.264',
        help='Video codec (e.g., H.264, H.265, VP9)',
    )
    parser.add_argument(
        '--overwrite',
        action='store_true',
        help='Overwrite output file',
    )
    parser.add_argument(
        '--allow-hwaccel',
        action='store_true',
        help=(
            'Allow FFmpeg hardware acceleration '
            '(less stable on some systems)'
        ),
    )
    parser.add_argument(
        '--clips-json',
        help=(
            'Path to a JSON file describing per-clip edits '
            '(trim, crop, aspect, volume, color). Schema: '
            '{"clips": [{"path": "...", "edits": {...}}, ...]}'
        ),
    )
    parser.add_argument(
        '--loudnorm',
        action='store_true',
        help='Apply EBU R128 audio loudness normalization to every clip',
    )
    parser.add_argument(
        '--loudnorm-target',
        type=float,
        default=-16.0,
        help='Integrated loudness target in LUFS (default -16, streaming-friendly)',
    )
    parser.add_argument(
        '--loudnorm-true-peak',
        type=float,
        default=-1.5,
        help='True peak ceiling in dBTP (default -1.5)',
    )
    parser.add_argument(
        '--loudnorm-lra',
        type=float,
        default=11.0,
        help='Target loudness range in LU (default 11)',
    )
    parser.add_argument(
        '--auto-silence-trim',
        action='store_true',
        help=(
            'Auto-detect leading and trailing silence in each clip via '
            'silencedetect and add the detected duration to trimStart / '
            'trimEnd before merging'
        ),
    )
    parser.add_argument(
        '--silence-threshold-db',
        type=float,
        default=-50.0,
        help='Silence threshold in dB for silencedetect (default -50)',
    )
    parser.add_argument(
        '--silence-min-duration',
        type=float,
        default=0.5,
        help='Minimum silence duration in seconds (default 0.5)',
    )

    args = parser.parse_args()

    if args.ffmpeg_path:
        ffmpeg_dir = os.path.dirname(os.path.abspath(args.ffmpeg_path))
        os.environ['PATH'] = (
            ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
        )

    if args.check_ffmpeg:
        sys.exit(0 if check_ffmpeg() else 1)

    if args.version:
        get_ffmpeg_version()
        sys.exit(0)

    if args.merge:
        if not args.inputs or not args.output:
            print(
                'ERROR: --inputs and --output are required for merge',
                file=sys.stderr,
            )
            sys.exit(1)

        clip_edits = _load_clip_edits(args.clips_json, args.inputs)
        loudnorm = (
            {
                'enabled': True,
                'targetLufs': args.loudnorm_target,
                'truePeak': args.loudnorm_true_peak,
                'loudnessRange': args.loudnorm_lra,
            }
            if args.loudnorm
            else None
        )
        success = merge_videos(
            args.inputs,
            args.output,
            args.quality,
            args.codec,
            args.overwrite,
            disable_hwaccel=not args.allow_hwaccel,
            clip_edits=clip_edits,
            loudnorm=loudnorm,
            auto_silence_trim=args.auto_silence_trim,
            silence_threshold_db=args.silence_threshold_db,
            silence_min_duration=args.silence_min_duration,
        )
        sys.exit(0 if success else 1)

    parser.print_help()
    sys.exit(1)


if __name__ == '__main__':
    main()
