# Video Merger Application

A modern web application for merging multiple video files into a single output video. Built with Python Flask and designed for ease of use.

## Features

- 🎬 **Multiple Video Support**: Merge 2 or more videos seamlessly
- 🌐 **Web Interface**: Clean, intuitive web-based UI
- 📦 **Multiple Formats**: Support for MP4, AVI, MOV, MKV, and WebM
- 🐳 **Dockerized**: Easy deployment with Docker and Docker Compose
- 🧪 **Well Tested**: Comprehensive unit and integration tests
- 🔒 **Secure**: File validation and sanitization built-in

## Quick Start

### Prerequisites

- Python 3.8 or higher
- FFmpeg (for video processing)
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/J4ve/videomerger_app_revamp.git
   cd videomerger_app_revamp
   ```

2. **Create and activate a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   pip install -e .
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

5. **Run the application**
   ```bash
   python src/videomerger/app.py
   ```

6. **Open your browser**
   Navigate to `http://localhost:5000`

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Using Docker directly

```bash
docker build -t videomerger .
docker run -p 5000:5000 -v $(pwd)/uploads:/app/src/videomerger/static/uploads videomerger
```

## Development

### Project Structure

```
videomerger_app_revamp/
├── src/
│   └── videomerger/
│       ├── api/              # API endpoints
│       ├── core/             # Core video processing logic
│       ├── utils/            # Utility functions
│       ├── static/           # Static files (CSS, JS, uploads)
│       ├── templates/        # HTML templates
│       └── app.py           # Main application
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
├── .github/workflows/       # CI/CD pipelines
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── setup.py
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/videomerger

# Run specific test file
pytest tests/unit/test_app.py
```

### Code Quality

```bash
# Format code
black src/videomerger

# Sort imports
isort src/videomerger

# Lint code
flake8 src/videomerger
```

## API Documentation

### Endpoints

#### `GET /`
Returns the main web interface.

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

#### `POST /api/upload`
Upload video files for merging.

**Request:** multipart/form-data with `videos` field containing files

**Response:**
```json
{
  "message": "Files uploaded successfully",
  "files": ["path/to/video1.mp4", "path/to/video2.mp4"],
  "count": 2
}
```

#### `POST /api/merge`
Merge uploaded videos.

**Request:**
```json
{
  "files": ["path/to/video1.mp4", "path/to/video2.mp4"],
  "output_name": "merged_video.mp4"
}
```

**Response:**
```json
{
  "message": "Videos merged successfully",
  "output_file": "path/to/merged_video.mp4"
}
```

#### `GET /api/download/<filename>`
Download a merged video file.

## Configuration

Configuration is managed through environment variables. See `.env.example` for available options:

- `FLASK_ENV`: Environment (development/production)
- `SECRET_KEY`: Flask secret key
- `MAX_CONTENT_LENGTH`: Maximum file upload size
- `UPLOAD_FOLDER`: Directory for uploaded files
- `OUTPUT_FOLDER`: Directory for output files

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- SE2 Project Team
- Flask Framework
- FFmpeg Community

## Support

For issues and questions, please open an issue on the [GitHub repository](https://github.com/J4ve/videomerger_app_revamp/issues).
