"""Configuration settings for the Video Merger application."""
import os
from pathlib import Path


# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Config:
    """Base configuration class."""
    
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'True') == 'True'
    
    # Upload settings
    UPLOAD_FOLDER = os.getenv(
        'UPLOAD_FOLDER',
        str(BASE_DIR / 'src' / 'videomerger' / 'static' / 'uploads')
    )
    OUTPUT_FOLDER = os.getenv(
        'OUTPUT_FOLDER',
        str(BASE_DIR / 'src' / 'videomerger' / 'static' / 'outputs')
    )
    
    # File size limits (in bytes)
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 500 * 1024 * 1024))  # 500MB default
    
    # Allowed video file extensions
    ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
    
    # Video processing settings
    MAX_VIDEOS_PER_MERGE = int(os.getenv('MAX_VIDEOS_PER_MERGE', 10))
    DEFAULT_OUTPUT_FORMAT = os.getenv('DEFAULT_OUTPUT_FORMAT', 'mp4')
    
    # Application settings
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))


class DevelopmentConfig(Config):
    """Development environment configuration."""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production environment configuration."""
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv('SECRET_KEY')  # Must be set in production


class TestingConfig(Config):
    """Testing environment configuration."""
    TESTING = True
    DEBUG = True
    # Use temporary directories for testing
    UPLOAD_FOLDER = '/tmp/test_uploads'
    OUTPUT_FOLDER = '/tmp/test_outputs'


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(env=None):
    """Get configuration based on environment."""
    if env is None:
        env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])
