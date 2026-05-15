#!/usr/bin/env python
"""Caption CLI — auto-transcribes a single audio/video clip into SRT.

Separate from video_processor_cli so the heavy faster-whisper import
does not pay the price during plain merges. Invoked from the main
process / video_processor when the user enables auto-captions.

Usage:
    python caption_cli.py --transcribe \\
        --input <path> --output <path.srt> \\
        [--model base] [--language auto] [--compute-type int8]
"""

import argparse
import math
import os
import sys


def _fmt_timestamp(seconds: float) -> str:
    """Format seconds as SRT timestamp ``HH:MM:SS,mmm``."""
    if seconds < 0 or math.isnan(seconds):
        seconds = 0.0
    millis = int(round(seconds * 1000))
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f'{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}'


def _segments_to_srt(segments) -> str:
    """Serialize a sequence of (start, end, text) tuples into an SRT string.

    Empty / whitespace-only segments are skipped, and the indices in the
    output are sequential 1..N after filtering so the resulting file is
    spec-compliant.
    """
    out = []
    index = 0
    for start, end, text in segments:
        text = (text or '').strip().replace('\r', '')
        if not text:
            continue
        index += 1
        out.append(str(index))
        out.append(f'{_fmt_timestamp(start)} --> {_fmt_timestamp(end)}')
        out.append(text)
        out.append('')
    return '\n'.join(out).rstrip() + '\n'


def transcribe_to_srt(
    input_path: str,
    output_path: str,
    model_name: str = 'base',
    language: str = 'auto',
    compute_type: str = 'int8',
) -> bool:
    """Transcribe ``input_path`` with faster-whisper, write SRT to ``output_path``."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            'ERROR: faster-whisper is not installed. '
            'Install via `pip install faster-whisper`.',
            file=sys.stderr,
        )
        return False

    if not os.path.exists(input_path):
        print(f'ERROR: input not found: {input_path}', file=sys.stderr)
        return False

    print(f'INFO: Loading Whisper model "{model_name}"...')
    try:
        model = WhisperModel(model_name, compute_type=compute_type)
    except Exception as exc:  # noqa: BLE001 — surface model-load error
        print(f'ERROR: Could not load Whisper model: {exc}', file=sys.stderr)
        return False

    lang_arg = None if language in ('auto', None, '') else language

    print(f'INFO: Transcribing {input_path}...')
    try:
        segments_iter, info = model.transcribe(
            input_path,
            language=lang_arg,
            vad_filter=True,
        )
    except Exception as exc:  # noqa: BLE001
        print(f'ERROR: Transcription failed: {exc}', file=sys.stderr)
        return False

    if info and getattr(info, 'language', None):
        print(
            f'INFO: Detected language: {info.language} '
            f'(probability {info.language_probability:.2f})'
        )

    segments = [(s.start, s.end, s.text) for s in segments_iter]
    srt_text = _segments_to_srt(segments)

    try:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or '.', exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as fh:
            fh.write(srt_text)
    except OSError as exc:
        print(f'ERROR: Could not write SRT: {exc}', file=sys.stderr)
        return False

    print(f'SUCCESS: Wrote SRT with {len(segments)} segments to {output_path}')
    return True


def main():
    parser = argparse.ArgumentParser(description='Auto-caption a clip into SRT')
    parser.add_argument('--transcribe', action='store_true', help='Transcribe a clip')
    parser.add_argument('--input', help='Input audio/video file path')
    parser.add_argument('--output', help='Output SRT file path')
    parser.add_argument(
        '--model',
        default='base',
        help='faster-whisper model size (tiny / base / small / medium / large-v3)',
    )
    parser.add_argument(
        '--language',
        default='auto',
        help='ISO language code (en, fil, es, ...) or "auto" to detect',
    )
    parser.add_argument(
        '--compute-type',
        default='int8',
        help='faster-whisper compute_type (int8, int8_float16, float16, float32)',
    )

    args = parser.parse_args()

    if args.transcribe:
        if not args.input or not args.output:
            print('ERROR: --input and --output are required', file=sys.stderr)
            sys.exit(1)
        success = transcribe_to_srt(
            args.input,
            args.output,
            model_name=args.model,
            language=args.language,
            compute_type=args.compute_type,
        )
        sys.exit(0 if success else 1)

    parser.print_help()
    sys.exit(1)


if __name__ == '__main__':
    main()
