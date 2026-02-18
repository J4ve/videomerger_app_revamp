"""Unit tests for the VideoProcessor class."""
import pytest
import os
from videomerger.core.video_processor import VideoProcessor


def test_video_processor_init():
    """Test VideoProcessor initialization."""
    processor = VideoProcessor()
    assert processor is not None
    assert len(processor.supported_formats) > 0


def test_merge_videos_insufficient_files(sample_video_file):
    """Test merging with insufficient video files."""
    processor = VideoProcessor()
    
    with pytest.raises(ValueError):
        processor.merge_videos([sample_video_file], 'output.mp4')


def test_merge_videos_nonexistent_file():
    """Test merging with nonexistent file."""
    processor = VideoProcessor()
    
    with pytest.raises(FileNotFoundError):
        processor.merge_videos(['fake1.mp4', 'fake2.mp4'], 'output.mp4')


def test_validate_video(sample_video_file):
    """Test video validation."""
    processor = VideoProcessor()
    assert processor.validate_video(sample_video_file) is True


def test_validate_nonexistent_video():
    """Test validation of nonexistent video."""
    processor = VideoProcessor()
    assert processor.validate_video('nonexistent.mp4') is False


def test_get_video_info(sample_video_file):
    """Test getting video information."""
    processor = VideoProcessor()
    info = processor.get_video_info(sample_video_file)
    
    assert info is not None
    assert 'path' in info
    assert 'exists' in info
    assert info['exists'] is True
