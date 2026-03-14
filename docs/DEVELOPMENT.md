# Development Guide

## Getting Started

### Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/J4ve/videomerger_app_revamp.git
   cd videomerger_app_revamp
   ```

2. **Set up Python virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install development dependencies**
   ```bash
   pip install -r requirements.txt
   pip install -e ".[dev]"
   ```

4. **Install FFmpeg** (for video processing)
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Project Structure

```
videomerger_app_revamp/
├── src/videomerger/        # Main application code
│   ├── api/               # API route handlers
│   ├── core/              # Business logic & video processing
│   ├── utils/             # Utility functions & helpers
│   ├── static/            # Static assets (CSS, JS, uploads)
│   ├── templates/         # Jinja2 HTML templates
│   └── app.py            # Flask application factory
├── tests/                 # Test suite
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── conftest.py       # Test fixtures & configuration
├── docs/                  # Documentation
├── scripts/               # Utility scripts
└── .github/workflows/     # CI/CD workflows
```

## Development Workflow

### Running the Development Server

```bash
# Using Flask development server
python src/videomerger/app.py

# Or using Flask CLI
export FLASK_APP=src/videomerger/app.py
export FLASK_ENV=development
flask run
```

The application will be available at `http://localhost:5000`

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=src/videomerger --cov-report=html

# Run specific test file
pytest tests/unit/test_app.py

# Run tests matching a pattern
pytest -k "test_upload"

# Run with verbose output
pytest -v
```

### Code Style and Linting

We follow PEP 8 style guidelines with some modifications.

```bash
# Format code with Black
black src/videomerger tests

# Sort imports with isort
isort src/videomerger tests

# Check code style with flake8
flake8 src/videomerger tests

# Run all quality checks
black src/videomerger tests && isort src/videomerger tests && flake8 src/videomerger tests
```

### Pre-commit Checks

Before committing code, ensure:

1. All tests pass
2. Code is formatted with Black
3. Imports are sorted with isort
4. No flake8 violations
5. Coverage is maintained or improved

## Adding New Features

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Implement Your Feature

- Write code following existing patterns
- Add appropriate error handling
- Update documentation as needed

### 3. Write Tests

Create tests in the appropriate directory:

```python
# tests/unit/test_your_feature.py
def test_your_new_function():
    """Test description."""
    result = your_new_function()
    assert result == expected_value
```

### 4. Update Documentation

- Update README.md if needed
- Add/update API documentation in docs/API.md
- Add docstrings to new functions/classes

### 5. Run Quality Checks

```bash
pytest
black src/videomerger tests
isort src/videomerger tests
flake8 src/videomerger tests
```

### 6. Commit and Push

```bash
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 7. Create Pull Request

Open a PR on GitHub with:
- Clear description of changes
- Link to related issues
- Screenshots if UI changes

## Code Organization

### Flask Application Structure

We use the **Application Factory Pattern**:

```python
# app.py
def create_app(config=None):
    app = Flask(__name__)
    # Configure app
    # Register routes
    return app
```

### Route Handlers

Keep route handlers thin - delegate logic to core modules:

```python
@app.route('/api/merge', methods=['POST'])
def merge_videos():
    data = request.get_json()
    # Validate input
    # Call core business logic
    return jsonify(result)
```

### Core Business Logic

Place business logic in the `core` module:

```python
# core/video_processor.py
class VideoProcessor:
    def merge_videos(self, files, output):
        # Implementation here
        pass
```

### Utilities

Reusable helpers go in the `utils` module:

```python
# utils/file_utils.py
def sanitize_filename(filename):
    return secure_filename(filename)
```

## Testing Guidelines

### Unit Tests

- Test individual functions/methods in isolation
- Mock external dependencies
- Focus on edge cases and error handling

```python
def test_merge_videos_insufficient_files():
    processor = VideoProcessor()
    with pytest.raises(ValueError):
        processor.merge_videos(['single_video.mp4'], 'output.mp4')
```

### Integration Tests

- Test multiple components working together
- Use test fixtures for setup/teardown
- Test actual API endpoints

```python
def test_upload_and_merge_flow(client, sample_videos):
    # Upload videos
    upload_response = client.post('/api/upload', data=sample_videos)
    # Merge videos
    merge_response = client.post('/api/merge', json=upload_data)
    assert merge_response.status_code == 200
```

## Debugging

### Enable Debug Mode

```python
# .env
DEBUG=True
```

### Using Python Debugger

```python
import pdb; pdb.set_trace()  # Set breakpoint
```

### Logging

```python
import logging
logger = logging.getLogger(__name__)
logger.debug('Debug message')
logger.info('Info message')
logger.error('Error message')
```

## Docker Development

> **Note:** You must have **Docker Desktop** installed and running to use these features on Windows. If you are on Linux or macOS, the standard **Docker** engine setup is sufficient.

### Building the Desktop Application Executable (Windows/No-Node)

If you need to build the Windows `.exe` standalone application but don't have Node.js installed locally, use the Docker Builder service (which runs `electron-builder` under Wine):

```bash
docker compose run --rm builder
```

The resulting executable will be saved in the `dist-bin/` directory. Note: You must run this from a standard Windows command prompt, not inside the Docker Desktop VM.

### Web Application Development (Flask)

If you are developing the Flask api, you can build and run it via Compose:

```bash
docker-compose up --build
```

### Access Container

```bash
docker-compose exec web bash
```

### View Logs

```bash
docker-compose logs -f web
```

## Common Issues

### Issue: Import Errors

**Solution:** Ensure the package is installed in editable mode:
```bash
pip install -e .
```

### Issue: FFmpeg Not Found

**Solution:** Install FFmpeg for your OS (see setup section)

### Issue: Port Already in Use

**Solution:** Change the port in .env or stop the conflicting process:
```bash
lsof -ti:5000 | xargs kill -9  # macOS/Linux
```

## Performance Optimization

### Video Processing

- Process videos asynchronously for large files
- Implement progress tracking
- Add caching for repeated operations

### File Storage

- Implement automatic cleanup of old files
- Consider cloud storage for production
- Add file size validation before processing

## Security Considerations

- Validate all file uploads
- Sanitize filenames
- Implement rate limiting
- Add authentication for production
- Use HTTPS in production
- Never commit secrets to version control

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Python Best Practices](https://docs.python-guide.org/)
- [Testing with Pytest](https://docs.pytest.org/)

---

## Desktop Application Features (Electron + React)

### Architecture

The desktop app uses **Electron** (main process) + **React** (renderer) + **Python** (FFmpeg subprocess). All communication is via IPC with `contextBridge`. Core business logic is framework-agnostic using TypeScript interfaces with DI, Repository, Command, Adapter, and Strategy patterns.

### Running the Desktop App

```bash
npm install
npm run dev         # Run renderer (Vite) + main (Electron) concurrently
npm run test        # Run vitest
npm run build       # Production build
```

### 4-Step Wizard

| Step | Name | Description |
|------|------|-------------|
| 0 | Auth | Google sign-in or skip |
| 1 | Add Videos | Drag-and-drop or browse; set resolution/FPS |
| 2 | Arrange | Sort, duplicate, drag-and-drop reorder |
| 3 | Preview | Review all settings before merge |
| 4 | Finalize | Choose output path, start merge, track progress |

### Drag-and-Drop (Step 1)

Drop video files directly onto the dropzone area. Supported formats: `MP4`, `MOV`, `AVI`, `MKV`, `WEBM`. Visual feedback (blue glow, icon change) on drag-over. Unsupported files are silently skipped with a status message.

### Video Standardization (Step 1)

Two dropdowns below the dropzone:
- **Resolution**: Original, 720p, 1080p, 4K
- **FPS**: Original, 24, 30, 60

These settings are passed via `standardization` field in merge options to ensure uniform output.

### FFmpeg Availability Indicator

The header shows an FFmpeg status chip with a colored dot:
- **Green dot** = Installed
- **Red dot** = Not Installed

Click the chip to open a dialog showing version, path, and whether it's bundled or from system PATH.

### Arrange Screen Enhancements (Step 2)

- **Sorting**: Sort by Name (ascending/descending) via toolbar
- **Duplicate**: Click "Dup" to clone a video entry in the sequence
- **Drag-and-drop reorder**: Drag items by the handle (⠿) to rearrange
- **Up/Down/Remove**: Standard reorder and removal buttons

### Preview Step (Step 3)

Shows a summary of:
- Ordered file list
- Selected standardization settings
- Auth status and YouTube availability

### YouTube Upload

After a successful merge, logged-in users see a YouTube upload form:
- Title (required), Description, Privacy (private/unlisted/public)
- Uses YouTube Data API v3 resumable upload
- Upload result shows direct video URL

### Google OAuth2

- Auth prompt on first launch: "Sign in with Google" or "Continue without account"
- Opens native OAuth popup (Electron BrowserWindow) → local HTTP redirect callback
- Tokens stored in `electron-store`
- When not logged in: YouTube config/upload features are disabled

### Dashboard & Settings

Accessible via ⚙ button in the header. Tabs:
- **General**: Max file size, default resolution/FPS
- **Presets**: Save/load standardization presets
- **YouTube**: Default title, description, privacy (requires login)
- **FFmpeg**: Status, version, path display
- **Account**: Google account info, sign out

### FFmpeg Bundling

See [ffmpeg-bundling.md](./ffmpeg-bundling.md) for details on including FFmpeg binaries with the installer.

### TypeScript Tests

```bash
npm test                    # Run vitest
npx vitest run --reporter verbose  # Verbose output
```

Tests use **vitest** + **@testing-library/react** with **jsdom** environment. The setup file (`renderer/src/__tests__/setup.ts`) mocks all `window.electronAPI` methods.

Test coverage:
- Auth prompt rendering and interactions
- Drag-and-drop file acceptance/rejection
- Standardization dropdown defaults and changes
- FFmpeg indicator display and dialog
- Arrange screen sorting, duplication, reordering
- Preview step content verification
- YouTube auth-gated UI elements
- Dashboard tabs and navigation
- Wizard step validation and navigation
