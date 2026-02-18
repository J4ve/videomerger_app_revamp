"""Setup configuration for Video Merger application."""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="videomerger",
    version="0.1.0",
    author="Video Merger Team",
    description="A web application for merging multiple videos",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/J4ve/videomerger_app_revamp",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "Flask>=3.0.0",
        "Werkzeug>=3.0.1",
        "python-dotenv>=1.0.0",
        "gunicorn>=21.2.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.3",
            "pytest-cov>=4.1.0",
            "pytest-flask>=1.3.0",
            "black>=23.12.1",
            "flake8>=6.1.0",
            "isort>=5.13.2",
        ],
        "video": [
            "ffmpeg-python>=0.2.0",
            "moviepy>=1.0.3",
        ],
    },
    entry_points={
        "console_scripts": [
            "videomerger=videomerger.app:main",
        ],
    },
)
