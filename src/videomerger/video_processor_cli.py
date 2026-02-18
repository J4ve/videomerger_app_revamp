#!/usr/bin/env python
"""
Video processor CLI for Electron integration
Handles FFmpeg operations via command line
"""
import argparse
import sys
import os
import subprocess


def check_ffmpeg():
    """Check if FFmpeg is available"""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print('FFmpeg available')
            return True
        else:
            print('FFmpeg not available')
            return False
    except Exception:
        print('FFmpeg not available')
        return False


def get_ffmpeg_version():
    """Get FFmpeg version"""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(version_line)
            return version_line
        else:
            print('unknown')
            return 'unknown'
    except Exception:
        print('unknown')
        return 'unknown'


def merge_videos(input_paths, output_path, quality='medium', overwrite=False):
    """Merge multiple videos using FFmpeg"""
    if len(input_paths) < 2:
        print('Error: At least 2 videos required', file=sys.stderr)
        return False

    for path in input_paths:
        if not os.path.exists(path):
            print(f'Error: File not found: {path}', file=sys.stderr)
            return False

    concat_file = 'concat_list.txt'
    try:
        with open(concat_file, 'w') as f:
            for path in input_paths:
                f.write(f"file '{path}'\n")

        quality_settings = {
            'low': ['-crf', '28'],
            'medium': ['-crf', '23'],
            'high': ['-crf', '18']
        }

        cmd = [
            'ffmpeg',
            '-f', 'concat',
            '-safe', '0',
            '-i', concat_file,
            '-c:v', 'libx264',
            '-preset', 'medium',
        ]

        cmd.extend(quality_settings.get(quality, quality_settings['medium']))
        cmd.extend(['-c:a', 'aac'])

        if overwrite:
            cmd.append('-y')

        cmd.append(output_path)

        result = subprocess.run(cmd, capture_output=True, text=True)

        if os.path.exists(concat_file):
            os.remove(concat_file)

        if result.returncode == 0:
            print(f'Successfully merged videos to {output_path}')
            return True
        else:
            print(f'Error merging videos: {result.stderr}', file=sys.stderr)
            return False

    except Exception as e:
        if os.path.exists(concat_file):
            os.remove(concat_file)
        print(f'Error: {str(e)}', file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Video processor CLI')
    parser.add_argument('--check-ffmpeg', action='store_true', help='Check if FFmpeg is available')
    parser.add_argument('--version', action='store_true', help='Get FFmpeg version')
    parser.add_argument('--merge', action='store_true', help='Merge videos')
    parser.add_argument('--inputs', nargs='+', help='Input video files')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument('--quality', choices=['low', 'medium', 'high'], default='medium', help='Output quality')
    parser.add_argument('--overwrite', action='store_true', help='Overwrite output file')

    args = parser.parse_args()

    if args.check_ffmpeg:
        sys.exit(0 if check_ffmpeg() else 1)

    elif args.version:
        get_ffmpeg_version()
        sys.exit(0)

    elif args.merge:
        if not args.inputs or not args.output:
            print('Error: --inputs and --output are required for merge', file=sys.stderr)
            sys.exit(1)

        success = merge_videos(args.inputs, args.output, args.quality, args.overwrite)
        sys.exit(0 if success else 1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
