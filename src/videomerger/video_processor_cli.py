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


def merge_videos(
    input_paths,
    output_path,
    quality='medium',
    codec='H.264',
    overwrite=False,
    disable_hwaccel=True,
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
    durations = [_get_duration(path) for path in input_paths]
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

            filter_v = (
                f'scale={target_width}:{target_height}:'
                'force_original_aspect_ratio=decrease,'
                f'pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2,'
                f'fps={target_fps},format=yuv420p'
            )

            cmd = ['ffmpeg', '-y', '-hide_banner', '-nostdin']
            if disable_hwaccel:
                cmd.extend(['-hwaccel', 'none'])

            cmd.extend(['-i', path])

            has_audio = _has_audio(path)
            if has_audio:
                filter_a = (
                    'aformat=sample_rates='
                    f'{target_audio_rate}:channel_layouts=stereo'
                )
                filter_str = f'[0:v]{filter_v}[outv]; [0:a]{filter_a}[outa]'
            else:
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

        success = merge_videos(
            args.inputs,
            args.output,
            args.quality,
            args.codec,
            args.overwrite,
            disable_hwaccel=not args.allow_hwaccel,
        )
        sys.exit(0 if success else 1)

    parser.print_help()
    sys.exit(1)


if __name__ == '__main__':
    main()
