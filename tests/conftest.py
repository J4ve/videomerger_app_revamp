"""Test configuration and fixtures."""
import pytest
import os
import tempfile
from videomerger.app import create_app
from videomerger.utils.config import TestingConfig


@pytest.fixture
def app():
    """Create and configure a test application instance."""
    app = create_app(TestingConfig)
    
    # Create temporary directories for testing
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
    
    yield app
    
    # Cleanup
    import shutil
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        shutil.rmtree(app.config['UPLOAD_FOLDER'])
    if os.path.exists(app.config['OUTPUT_FOLDER']):
        shutil.rmtree(app.config['OUTPUT_FOLDER'])


@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create a test CLI runner for the app."""
    return app.test_cli_runner()


@pytest.fixture
def sample_video_file():
    """Create a temporary sample video file for testing."""
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
        f.write(b'fake video content')
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.remove(temp_path)
