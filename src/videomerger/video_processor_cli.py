#!/usr/bin/env python
"""
Video processor CLI for Electron integration
Handles FFmpeg operations via command line with robust merging and real-time progress
"""
import argparse
import sys
import os
import json
import subprocess


def check_ffmpeg():
    """Check if FFmpeg and FFprobe are available"""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5, check=True)
        subprocess.run(['ffprobe', '-version'], capture_output=True, text=True, timeout=5, check=True)
        print('FFmpeg and FFprobe available')
        return True
    except Exception:
        print('FFmpeg/FFprobe not available', file=sys.stderr)
        return False


def get_ffmpeg_version():
    """Get FFmpeg version"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(version_line)
            return version_line
    except Exception:
        pass
    print('unknown')
    return 'unknown'


def _get_total_duration(video_paths):
    """Get total duration of all videos in seconds using ffprobe"""
    total = 0.0
    for video_path in video_paths:
        try:
            cmd =[
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            duration = float(result.stdout.strip())
            total += duration
        except Exception as e:
            print(f"WARNING: Could not get duration for {video_path}: {e}", file=sys.stderr)
    return total


def _parse_time_from_ffmpeg(line):
    """Parse current time from FFmpeg stderr output"""
    try:
        if "time=" in line:
            time_str = line.split("time=")[1].split()[0]
            # Parse HH:MM:SS.ms format
            parts = time_str.split(":")
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
    except Exception:
        pass
    return None


def _get_video_properties(video_path):
    """Get width, height, and framerate of a video using ffprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,r_frame_rate',
            '-of', 'json',
            video_path,
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        info = json.loads(result.stdout)
        stream = info['streams'][0]

        width = int(stream['width'])
        height = int(stream['height'])

        fps_str = stream.get('r_frame_rate', '30/1')
        num, den = map(int, fps_str.split('/'))
        fps = num / den if den != 0 else 30.0

        return width, height, fps
    except Exception as e:
        print(f"WARNING: Could not read properties for {video_path}: {e}", file=sys.stderr)
        return 1920, 1080, 30.0


def _has_audio(video_path):
    """Return True if the input contains an audio stream"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_type',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video_path,
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return result.returncode == 0 and bool(result.stdout.strip())
    except Exception as e:
        print(f"WARNING: Could not detect audio stream for {video_path}: {e}", file=sys.stderr)
        return False


def merge_videos(input_paths, output_path, quality='medium', codec='H.264', overwrite=False, disable_hwaccel=True):
    """Merge multiple videos using a dynamically generated FFmpeg filtergraph"""
    if len(input_paths) < 2:
        print('ERROR: At least 2 videos required', file=sys.stderr)
        return False

    for path in input_paths:
        if not os.path.exists(path):
            print(f'ERROR: File not found: {path}', file=sys.stderr)
            return False

    print('INFO: Analyzing videos to find optimal baseline...')

    lowest_area = float('inf')
    target_width = 1920
    target_height = 1080
    target_fps = 60.0

    # Find the lowest resolution (by area) and lowest FPS across all inputs.
    for path in input_paths:
        width, height, fps = _get_video_properties(path)

        area = width * height
        if area < lowest_area:
            lowest_area = area
            target_width = width
            target_height = height

        if fps < target_fps:
            target_fps = fps

    # H.264/H.265 encoders generally require even dimensions.
    target_width = target_width - (target_width % 2)
    target_height = target_height - (target_height % 2)
    target_fps = round(target_fps, 2)

    print(f'INFO: Baseline set to {target_width}x{target_height} @ {target_fps} fps')

    # 1. Get total duration for progress calculation
    print("INFO: Calculating total duration...")
    total_duration = _get_total_duration(input_paths)
    print(f"INFO: Total duration: {total_duration:.2f}s")

    target_audio_rate = 48000

    cmd = ['ffmpeg', '-hide_banner', '-nostdin']

    if disable_hwaccel:
        # Avoid flaky GPU driver paths on some Windows systems.
        cmd.extend(['-hwaccel', 'none'])
    
    if overwrite:
        cmd.append('-y')

    # Add all input files
    for path in input_paths:
        cmd.extend(['-i', path])

    # 2. Dynamically generate the complex filter string
    filter_str = ""
    concat_inputs = ""
    
    for i, path in enumerate(input_paths):
        # Normalize Video: Scale to fit, pad with black bars, force FPS, force pixel format
        filter_str += (
            f"[{i}:v]scale={target_width}:{target_height}:force_original_aspect_ratio=decrease,"
            f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2,"
            f"fps={target_fps},format=yuv420p[v{i}]; "
        )

        # Normalize Audio when present; synthesize silent stereo when missing.
        if _has_audio(path):
            filter_str += f"[{i}:a]aformat=sample_rates={target_audio_rate}:channel_layouts=stereo[a{i}]; "
        else:
            filter_str += f"anullsrc=r={target_audio_rate}:cl=stereo[a{i}]; "

        concat_inputs += f"[v{i}][a{i}]"

    # Append the actual concat command to the end of the filter string
    filter_str += f"{concat_inputs}concat=n={len(input_paths)}:v=1:a=1[outv][outa]"

    cmd.extend(['-filter_complex', filter_str, '-map', '[outv]', '-map', '[outa]'])

    # 3. Map codec names
    codec_map = {
        "H.264": "libx264",
        "H.265": "libx265",
        "VP8": "libvpx",
        "VP9": "libvpx-vp9",
        "MPEG-4": "mpeg4",
        "AV1": "libaom-av1"
    }
    ffmpeg_codec = codec_map.get(codec, "libx264")

    # 4. Apply Quality Settings
    quality_settings = {
        'low':['-crf', '28', '-preset', 'ultrafast'],
        'medium':['-crf', '23', '-preset', 'medium'],
        'high':['-crf', '18', '-preset', 'slow']
    }
    
    cmd.extend(['-c:v', ffmpeg_codec])
    cmd.extend(quality_settings.get(quality, quality_settings['medium']))
    cmd.extend(['-c:a', 'aac', '-b:a', '192k', output_path])

    print(f"INFO: Executing FFmpeg command...")

    try:
        # Use Popen to read progress in real-time
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout to catch FFmpeg logs
            universal_newlines=True,
            encoding='utf-8'
        )

        for line in process.stdout:
            # Parse time and calculate percentage
            current_time = _parse_time_from_ffmpeg(line)
            if current_time is not None and total_duration > 0:
                percentage = min(int((current_time / total_duration) * 100), 100)
                # Print a clean string that Electron can easily regex/parse
                print(f"PROGRESS: {percentage}", flush=True)

        process.wait()

        if process.returncode == 0:
            print(f'\nSUCCESS: Merged videos to {output_path}')
            return True
        else:
            print(f'\nERROR: FFmpeg failed with exit code {process.returncode}', file=sys.stderr)
            return False

    except Exception as e:
        print(f'ERROR: Exception occurred: {str(e)}', file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Video processor CLI')
    parser.add_argument('--check-ffmpeg', action='store_true', help='Check if FFmpeg is available')
    parser.add_argument('--version', action='store_true', help='Get FFmpeg version')
    parser.add_argument('--merge', action='store_true', help='Merge videos')
    parser.add_argument('--inputs', nargs='+', help='Input video files')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument('--quality', choices=['low', 'medium', 'high'], default='medium', help='Output quality')
    parser.add_argument('--codec', default='H.264', help='Video codec (e.g., H.264, H.265, VP9)')
    parser.add_argument('--overwrite', action='store_true', help='Overwrite output file')
    parser.add_argument('--allow-hwaccel', action='store_true', help='Allow FFmpeg hardware acceleration (less stable on some systems)')

    args = parser.parse_args()

    if args.check_ffmpeg:
        sys.exit(0 if check_ffmpeg() else 1)

    elif args.version:
        get_ffmpeg_version()
        sys.exit(0)

    elif args.merge:
        if not args.inputs or not args.output:
            print('ERROR: --inputs and --output are required for merge', file=sys.stderr)
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

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()