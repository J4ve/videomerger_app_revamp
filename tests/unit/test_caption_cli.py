"""Unit tests for caption_cli SRT helpers (Phase 4).

These tests deliberately exercise only the SRT-formatting and segment
serialization helpers. The faster-whisper transcription path itself is
not tested here — it requires a real audio fixture and a model download.
The integration is covered indirectly by the video_processor_cli tests
for SRT concatenation.
"""
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'src', 'videomerger'))

import caption_cli as cc  # noqa: E402


@pytest.mark.unit
class TestFormatTimestamp:
    def test_zero(self):
        assert cc._fmt_timestamp(0) == '00:00:00,000'

    def test_subsecond(self):
        assert cc._fmt_timestamp(0.456) == '00:00:00,456'

    def test_mixed(self):
        assert cc._fmt_timestamp(3725.123) == '01:02:05,123'

    def test_negative_clamped_to_zero(self):
        assert cc._fmt_timestamp(-5) == '00:00:00,000'

    def test_rounds_to_ms(self):
        # 1.2345s rounds to 1234 ms not 1235; trust round(round-half-even)
        assert cc._fmt_timestamp(1.2345) in {'00:00:01,234', '00:00:01,235'}


@pytest.mark.unit
class TestSegmentsToSrt:
    def test_empty_input(self):
        assert cc._segments_to_srt([]) == '\n'

    def test_basic_two_segments(self):
        srt = cc._segments_to_srt([
            (0.0, 1.5, 'Hello'),
            (1.5, 3.0, 'World'),
        ])
        assert '1\n00:00:00,000 --> 00:00:01,500\nHello' in srt
        assert '2\n00:00:01,500 --> 00:00:03,000\nWorld' in srt

    def test_empty_text_segments_are_skipped(self):
        srt = cc._segments_to_srt([
            (0.0, 1.0, 'A'),
            (1.0, 2.0, '   '),
            (2.0, 3.0, ''),
            (3.0, 4.0, 'B'),
        ])
        # Indices stay sequential after skipping
        assert '1\n' in srt
        assert '2\n00:00:03,000 --> 00:00:04,000\nB' in srt
        assert '3\n' not in srt  # only two non-empty segments

    def test_strips_whitespace_and_cr(self):
        srt = cc._segments_to_srt([(0.0, 1.0, '  hi there \r')])
        assert 'hi there' in srt
        assert '  hi there' not in srt
        assert '\r' not in srt
