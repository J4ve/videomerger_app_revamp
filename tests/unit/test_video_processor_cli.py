"""Unit tests for per-clip edit helpers in video_processor_cli (Phase 1)."""
import json
import os
import sys
import tempfile

import pytest

# video_processor_cli lives in src/videomerger/ and is imported as a top-level
# module by the Electron host. Insert that directory on the path so tests can
# import it directly without going through the legacy package.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'src', 'videomerger'))

import video_processor_cli as vp  # noqa: E402


@pytest.mark.unit
class TestEffectiveDuration:
    def test_no_trim(self):
        assert vp._clip_effective_duration(60.0, {}) == 60.0

    def test_trim_start_only(self):
        assert vp._clip_effective_duration(60.0, {'trimStart': 5}) == 55.0

    def test_trim_end_only(self):
        assert vp._clip_effective_duration(60.0, {'trimEnd': 10}) == 50.0

    def test_trim_both(self):
        assert vp._clip_effective_duration(
            60.0, {'trimStart': 5, 'trimEnd': 10}
        ) == 45.0

    def test_over_trim_clamps_to_zero(self):
        assert vp._clip_effective_duration(
            60.0, {'trimStart': 100, 'trimEnd': 10}
        ) == 0.0

    def test_negative_values_treated_as_zero(self):
        assert vp._clip_effective_duration(
            60.0, {'trimStart': -5, 'trimEnd': -10}
        ) == 60.0


@pytest.mark.unit
class TestAspectTargetDims:
    def test_original_returns_baseline(self):
        assert vp._aspect_target_dims(
            {'aspectRatio': 'original'}, 1920, 1080
        ) == (1920, 1080)

    def test_unknown_falls_back(self):
        assert vp._aspect_target_dims(
            {'aspectRatio': 'banana'}, 1920, 1080
        ) == (1920, 1080)

    def test_9_16_vertical(self):
        w, h = vp._aspect_target_dims({'aspectRatio': '9:16'}, 1920, 1080)
        assert w == 1080
        assert h == 1920
        assert w / h == pytest.approx(9 / 16, abs=0.01)

    def test_1_1_square(self):
        w, h = vp._aspect_target_dims({'aspectRatio': '1:1'}, 1920, 1080)
        assert w == h

    def test_custom_aspect(self):
        w, h = vp._aspect_target_dims(
            {'aspectRatio': 'custom', 'aspectWidth': 21, 'aspectHeight': 9},
            1920, 1080,
        )
        assert w / h == pytest.approx(21 / 9, abs=0.02)
        # Must be even (yuv420p requirement)
        assert w % 2 == 0
        assert h % 2 == 0

    def test_custom_missing_dims_falls_back(self):
        assert vp._aspect_target_dims(
            {'aspectRatio': 'custom'}, 1920, 1080
        ) == (1920, 1080)


@pytest.mark.unit
class TestBuildClipVideoChain:
    def test_default_filter_chain(self):
        chain = vp._build_clip_video_chain({}, 1920, 1080, 30)
        assert 'scale=1920:1080' in chain
        assert 'pad=1920:1080' in chain
        assert 'fps=30' in chain
        assert 'format=yuv420p' in chain
        # No setpts / eq / crop for default edits
        assert 'setpts' not in chain
        assert 'eq=' not in chain
        assert 'crop=' not in chain

    def test_trim_adds_setpts(self):
        chain = vp._build_clip_video_chain(
            {'trimStart': 1.5}, 1920, 1080, 30,
        )
        assert 'setpts=PTS-STARTPTS' in chain

    def test_crop_inserted_before_scale(self):
        chain = vp._build_clip_video_chain(
            {'crop': {'x': 10, 'y': 20, 'width': 640, 'height': 480}},
            1920, 1080, 30,
        )
        assert 'crop=640:480:10:20' in chain
        assert chain.index('crop=') < chain.index('scale=')

    def test_aspect_override(self):
        chain = vp._build_clip_video_chain(
            {'aspectRatio': '9:16'}, 1920, 1080, 30,
        )
        assert 'scale=1080:1920' in chain
        assert 'pad=1080:1920' in chain

    def test_color_eq_filter(self):
        chain = vp._build_clip_video_chain(
            {'brightness': 0.1, 'contrast': 1.2, 'saturation': 1.5},
            1920, 1080, 30,
        )
        assert 'eq=brightness=0.100' in chain
        assert 'contrast=1.200' in chain
        assert 'saturation=1.500' in chain

    def test_color_clamped_to_valid_range(self):
        chain = vp._build_clip_video_chain(
            {'brightness': 5.0, 'contrast': -1.0, 'saturation': 100.0},
            1920, 1080, 30,
        )
        assert 'brightness=1.000' in chain
        assert 'contrast=0.000' in chain
        assert 'saturation=3.000' in chain

    def test_full_edit_order(self):
        chain = vp._build_clip_video_chain(
            {
                'trimStart': 2.0,
                'crop': {'x': 0, 'y': 0, 'width': 1280, 'height': 720},
                'aspectRatio': '9:16',
                'brightness': 0.05,
            },
            1920, 1080, 30,
        )
        # Expected order: setpts, crop, scale, pad, fps, eq, format
        i_setpts = chain.index('setpts')
        i_crop = chain.index('crop=')
        i_scale = chain.index('scale=')
        i_eq = chain.index('eq=')
        i_format = chain.index('format=yuv420p')
        assert i_setpts < i_crop < i_scale < i_eq < i_format


@pytest.mark.unit
class TestBuildClipAudioChain:
    def test_default(self):
        chain = vp._build_clip_audio_chain({}, 48000)
        assert 'aformat=sample_rates=48000' in chain
        assert 'channel_layouts=stereo' in chain
        assert 'volume=' not in chain
        assert 'asetpts' not in chain

    def test_trim_rebases_pts(self):
        chain = vp._build_clip_audio_chain({'trimStart': 1.0}, 48000)
        assert 'asetpts=PTS-STARTPTS' in chain

    def test_volume_filter(self):
        chain = vp._build_clip_audio_chain({'volume': 0.5}, 48000)
        assert 'volume=0.500' in chain

    def test_volume_clamped(self):
        chain = vp._build_clip_audio_chain({'volume': 50}, 48000)
        assert 'volume=8.000' in chain

    def test_unity_volume_omits_filter(self):
        chain = vp._build_clip_audio_chain({'volume': 1.0}, 48000)
        assert 'volume=' not in chain


@pytest.mark.unit
class TestLoudnorm:
    def test_default_audio_chain_has_no_loudnorm(self):
        chain = vp._build_clip_audio_chain({}, 48000)
        assert 'loudnorm' not in chain

    def test_disabled_loudnorm_is_noop(self):
        chain = vp._build_clip_audio_chain(
            {}, 48000, loudnorm={'enabled': False},
        )
        assert 'loudnorm' not in chain

    def test_enabled_loudnorm_appends_filter_with_defaults(self):
        chain = vp._build_clip_audio_chain(
            {}, 48000, loudnorm={'enabled': True},
        )
        assert 'loudnorm=I=-16.00:TP=-1.50:LRA=11.00' in chain

    def test_enabled_loudnorm_custom_targets(self):
        chain = vp._build_clip_audio_chain(
            {}, 48000,
            loudnorm={
                'enabled': True,
                'targetLufs': -23,
                'truePeak': -2,
                'loudnessRange': 7,
            },
        )
        assert 'loudnorm=I=-23.00:TP=-2.00:LRA=7.00' in chain

    def test_loudnorm_clamps_out_of_range_values(self):
        chain = vp._build_clip_audio_chain(
            {}, 48000,
            loudnorm={
                'enabled': True,
                'targetLufs': 50,        # absurdly high -> clamp to -5
                'truePeak': 10,          # above 0 -> clamp to 0
                'loudnessRange': 9999,   # above 50 -> clamp to 50
            },
        )
        assert 'loudnorm=I=-5.00:TP=0.00:LRA=50.00' in chain

    def test_loudnorm_handles_malformed_inputs(self):
        chain = vp._build_clip_audio_chain(
            {}, 48000,
            loudnorm={
                'enabled': True,
                'targetLufs': 'banana',
                'truePeak': None,
                'loudnessRange': None,
            },
        )
        # Fall back to default LUFS / TP / LRA when inputs are malformed
        assert 'loudnorm=I=-16.00:TP=-1.50:LRA=11.00' in chain

    def test_loudnorm_composes_with_volume_and_trim(self):
        chain = vp._build_clip_audio_chain(
            {'trimStart': 1.5, 'volume': 0.5},
            48000,
            loudnorm={'enabled': True},
        )
        # Order matters: asetpts -> aformat -> volume -> loudnorm
        i_pts = chain.index('asetpts')
        i_fmt = chain.index('aformat')
        i_vol = chain.index('volume=')
        i_loud = chain.index('loudnorm')
        assert i_pts < i_fmt < i_vol < i_loud


@pytest.mark.unit
class TestSilenceEventParsing:
    def test_empty_log_returns_empty_list(self):
        assert vp._parse_silence_events('') == []

    def test_no_silence_lines_returns_empty(self):
        log = 'ffmpeg version 6.x\nframe= 100 fps=30\n'
        assert vp._parse_silence_events(log) == []

    def test_single_complete_silence_event(self):
        log = (
            '[silencedetect @ 0xaa] silence_start: 0\n'
            '[silencedetect @ 0xaa] silence_end: 2.34 | silence_duration: 2.34\n'
        )
        assert vp._parse_silence_events(log) == [(0.0, 2.34)]

    def test_multiple_silence_events(self):
        log = (
            '[silencedetect @ 0xaa] silence_start: 0\n'
            '[silencedetect @ 0xaa] silence_end: 1.5 | silence_duration: 1.5\n'
            'random ffmpeg output\n'
            '[silencedetect @ 0xaa] silence_start: 100.0\n'
            '[silencedetect @ 0xaa] silence_end: 101.2 | silence_duration: 1.2\n'
        )
        assert vp._parse_silence_events(log) == [(0.0, 1.5), (100.0, 101.2)]

    def test_unclosed_trailing_silence_keeps_none_end(self):
        log = (
            '[silencedetect @ 0xaa] silence_start: 0\n'
            '[silencedetect @ 0xaa] silence_end: 1.0 | silence_duration: 1.0\n'
            '[silencedetect @ 0xaa] silence_start: 295.0\n'
        )
        events = vp._parse_silence_events(log)
        assert events == [(0.0, 1.0), (295.0, None)]

    def test_negative_start_times_are_preserved(self):
        # Older ffmpeg builds occasionally emit small negative starts; the
        # caller is responsible for clamping, not the parser.
        log = '[silencedetect @ 0xaa] silence_start: -0.001\n'
        assert vp._parse_silence_events(log) == [(-0.001, None)]


@pytest.mark.unit
class TestAugmentEditsWithSilenceTrim:
    def test_clip_without_silence_is_unchanged(self, monkeypatch):
        monkeypatch.setattr(
            vp, 'detect_silence_boundaries', lambda *a, **kw: (0.0, 0.0),
        )
        edits = [{}, {}]
        vp._augment_edits_with_silence_trim(
            ['a.mp4', 'b.mp4'], edits, [10.0, 20.0],
            threshold_db=-50, min_duration=0.5,
        )
        assert edits == [{}, {}]

    def test_leading_and_trailing_silence_adds_to_trim(self, monkeypatch):
        monkeypatch.setattr(
            vp, 'detect_silence_boundaries',
            lambda path, **kw: (1.5, 0.8),
        )
        edits = [{}]
        vp._augment_edits_with_silence_trim(
            ['a.mp4'], edits, [60.0],
            threshold_db=-50, min_duration=0.5,
        )
        assert edits[0]['trimStart'] == 1.5
        assert edits[0]['trimEnd'] == 0.8

    def test_silence_is_added_on_top_of_manual_trim(self, monkeypatch):
        monkeypatch.setattr(
            vp, 'detect_silence_boundaries',
            lambda path, **kw: (2.0, 1.0),
        )
        edits = [{'trimStart': 0.5, 'trimEnd': 0.5}]
        vp._augment_edits_with_silence_trim(
            ['a.mp4'], edits, [60.0],
            threshold_db=-50, min_duration=0.5,
        )
        assert edits[0]['trimStart'] == 2.5
        assert edits[0]['trimEnd'] == 1.5

    def test_malformed_existing_trim_treated_as_zero(self, monkeypatch):
        monkeypatch.setattr(
            vp, 'detect_silence_boundaries',
            lambda path, **kw: (1.0, 1.0),
        )
        edits = [{'trimStart': 'oops', 'trimEnd': None}]
        vp._augment_edits_with_silence_trim(
            ['a.mp4'], edits, [60.0],
            threshold_db=-50, min_duration=0.5,
        )
        assert edits[0]['trimStart'] == 1.0
        assert edits[0]['trimEnd'] == 1.0


@pytest.mark.unit
class TestLoadClipEdits:
    def test_missing_path_returns_none(self):
        assert vp._load_clip_edits(None, ['a.mp4']) is None
        assert vp._load_clip_edits('/nonexistent.json', ['a.mp4']) is None

    def test_malformed_json_returns_none(self, tmp_path):
        bad = tmp_path / 'bad.json'
        bad.write_text('not json {', encoding='utf-8')
        assert vp._load_clip_edits(str(bad), ['a.mp4']) is None

    def test_length_mismatch_returns_none(self, tmp_path):
        p = tmp_path / 'mismatch.json'
        p.write_text(
            json.dumps({'clips': [{'path': 'a.mp4', 'edits': {}}]}),
            encoding='utf-8',
        )
        assert vp._load_clip_edits(str(p), ['a.mp4', 'b.mp4']) is None

    def test_valid_returns_edit_list(self, tmp_path):
        p = tmp_path / 'ok.json'
        p.write_text(
            json.dumps({
                'clips': [
                    {'path': 'a.mp4', 'edits': {'trimStart': 1}},
                    {'path': 'b.mp4', 'edits': {'volume': 2}},
                ],
            }),
            encoding='utf-8',
        )
        edits = vp._load_clip_edits(str(p), ['a.mp4', 'b.mp4'])
        assert edits == [{'trimStart': 1}, {'volume': 2}]

    def test_missing_edits_defaults_to_empty(self, tmp_path):
        p = tmp_path / 'partial.json'
        p.write_text(
            json.dumps({
                'clips': [
                    {'path': 'a.mp4'},
                    {'path': 'b.mp4', 'edits': None},
                ],
            }),
            encoding='utf-8',
        )
        edits = vp._load_clip_edits(str(p), ['a.mp4', 'b.mp4'])
        assert edits == [{}, {}]
