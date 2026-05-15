# Development Guide

## Getting Started

### Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/J4ve/videomerger_app_revamp.git
   cd videomerger_app_revamp
   ```git reset
   

2. **Install Node.js 18+ & npm 9+** (required for Desktop App development)
    - **Windows**: Download the LTS version from [nodejs.org](https://nodejs.org/) and install it.
    - **macOS**: `brew install node`
    - **Ubuntu/Debian**: `sudo apt-get install nodejs npm`
   
    *(Verify installation: `node -v` should report 18.x or newer; `npm -v` 9.x or newer)*

3. **Set up Python 3.8+ virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

4. **Install development dependencies**
   ```bash
   pip install -r requirements.txt
   pip install -e ".[dev]"
   
   # Also install npm dependencies:
   npm install
   ```

5. **FFmpeg** (for video processing)

   For the **Electron desktop app**, no separate FFmpeg install is needed.
   `npm install` automatically pulls `ffmpeg-static` + `ffprobe-static`
   (devDependencies) and the `postinstall` hook (`scripts/install-ffmpeg.js`)
   copies the binaries into `resources/ffmpeg/`. The app's bundled-binary
   detection picks them up at boot.

   For the **legacy Flask web app**, a system-wide FFmpeg install is still
   recommended:
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use `winget install ffmpeg`

   See [ffmpeg-bundling.md](./ffmpeg-bundling.md) for full detection priority and packaged-installer notes.

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

### FFmpeg bundling (desktop build)

- Place the `ffmpeg.zip` archive in the repository root **before** running any packaging or the `builder` Compose service. The build scripts unzip it and copy the binaries into `resources/ffmpeg/` so FFmpeg is shipped inside the app. Without `ffmpeg.zip` at the root, packaged builds will miss FFmpeg and video processing will fail.
- What goes in `ffmpeg.zip`: a Windows static FFmpeg bundle containing `ffmpeg.exe`, `ffprobe.exe` (and optionally `ffplay.exe`) plus the matching DLLs from the same build. The standard layout from [gyan.dev FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) "ffmpeg-release-essentials" works unchanged; keep the zip intact in the repo root and the build will pick up `ffmpeg/bin/*.exe` automatically.

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

### Issue: FFmpeg Not Found (red banner in app)

**Most common cause:** `npm install` was interrupted before the `postinstall`
hook ran, or `scripts/install-ffmpeg.js` failed silently.

**Solution:**
```bash
# Re-run the postinstall step manually
node scripts/install-ffmpeg.js

# Verify the binaries landed
ls resources/ffmpeg/
# Should show ffmpeg.exe and ffprobe.exe (Windows) or ffmpeg/ffprobe (other OS)

# Kill and restart the dev loop so Electron picks them up
# (electronmon does not auto-reload on resources/ changes)
```

If `node_modules/ffmpeg-static` is missing entirely, re-run `npm install`.
If you prefer a system install for any reason (e.g. ARM Mac), `brew install ffmpeg` / `apt-get install ffmpeg` / `winget install ffmpeg` works as a fallback — the app probes the system PATH if both bundled and `ffmpeg-static` paths fail.

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
npm install         # Also fetches FFmpeg binaries via postinstall hook
npm run dev         # Run renderer (Vite) + tsc watch (main) + electronmon concurrently
npm run test        # Run vitest
npm run build       # Production build
```

`npm run dev` orchestrates three concurrent processes via `concurrently`:

| Stream  | Tool         | Behavior                                              |
|---------|--------------|-------------------------------------------------------|
| vite    | `vite`       | Renderer HMR on port 3000                             |
| tsc     | `tsc -w`     | Watches `main/` + `core/`, emits to `dist/main/`     |
| electron| `electronmon`| Boots Electron, restarts on `dist/main/main.js` change |

`wait-on` blocks `electronmon` until `dist/main/main.js` exists and the
Vite dev server is reachable, so the first launch is deterministic.

### Per-Clip Edits (Phase 1, arrange step)

Each clip in the arrange step exposes a **tune** button that opens an
inline edit panel with sliders/controls for:

- Trim start / trim end (seconds, bounded by clip duration)
- Aspect ratio preset (`original`, `16:9`, `9:16`, `1:1`, `4:5`, `4:3`, custom W:H)
- Optional crop rectangle (`x`, `y`, `width`, `height` in pixels)
- Per-clip audio volume (0–2×)
- Brightness / contrast / saturation

Edits are keyed by file path (duplicate clips share edit state) and serialized
into a temp JSON file passed to the Python CLI as `--clips-json`. The Python
side builds a per-clip filter chain (`setpts` → `crop` → `scale+pad` →
`fps` → `eq` → `format=yuv420p` for video; `asetpts` → `aformat` → `volume`
for audio) and uses input-level `-ss` / `-t` for trim. Clips without edits
use the original normalize-and-concat pipeline unchanged.

See `core/interfaces/IVideoProcessing.ts` (`IClipEdit`, `IVideoMergeOptions.clipEdits`)
and `src/videomerger/video_processor_cli.py` (`_build_clip_video_chain`,
`_build_clip_audio_chain`) for implementation details.

### Audio Loudness Normalization (Phase 2, advanced settings)

The advanced settings panel exposes a single **Normalize audio loudness
across all clips (EBU R128)** toggle. When enabled, every clip in the
normalize pass gets an `loudnorm=I=<target>:TP=<peak>:LRA=<range>`
filter appended to its audio chain.

This is the single-pass form of `loudnorm` — adequate for the project's
"fast merge" workflow. Two-pass measure-then-normalize would be more
accurate but doubles processing time per clip; we trade some LUFS
precision for the speed contract the panel asked us to keep.

Available LUFS targets in the UI:

| Preset | Use case |
|--------|----------|
| -14 LUFS | YouTube, Spotify, Apple Music typical loudness |
| -16 LUFS | Apple Podcasts and streaming default (also the app default) |
| -18 LUFS | AES streaming recommendation |
| -23 LUFS | EBU R128 broadcast loudness |

The setting is opt-in and global (applies uniformly to all clips); per-clip
volume adjustments from the Phase 1 edit panel still run before
`loudnorm`, so a user can pre-shape relative levels and let `loudnorm`
land the final target.

Interface: `ILoudnessNormalization` on `IVideoMergeOptions.loudnorm`.
CLI: `--loudnorm` (master) + `--loudnorm-target` / `--loudnorm-true-peak`
/ `--loudnorm-lra` overrides.

### Auto-Trim Silence (Phase 3, advanced settings)

A second advanced toggle, **Auto-trim leading & trailing silence from
each clip**, runs an `ffmpeg -af silencedetect` pre-pass on every input
before the main merge. The detected leading + trailing silence duration
is added on top of any manual `trimStart` / `trimEnd` from the Phase 1
edit panel, so manual trims compose with detected ones.

Mid-clip silence is intentionally left alone. Cutting silence inside the
clip would require synchronized `select` / `aselect` filter expressions
for both video and audio and risk slicing natural speech pauses. Edge
trim re-uses the Phase 1 trim plumbing, keeps audio and video in sync,
and matches the panelist intent ("remove silent parts to improve
pacing") in the common case.

UI exposes one threshold preset:

| Preset | Behavior |
|--------|----------|
| -40 dB | Aggressive — also trims room tone and quiet breathing |
| -50 dB | Default — trims clearly silent regions only |
| -60 dB | Gentle — trims only true digital silence |

Interface: `IAutoSilenceTrim` on `IVideoMergeOptions.autoSilenceTrim`.
CLI: `--auto-silence-trim` (master) + `--silence-threshold-db`
/ `--silence-min-duration` overrides.

Probe cost: ~1.5 seconds per clip on a fast disk (real-world measurement
on a 42 s MP4 with `ffmpeg -af silencedetect -f null -`). Linear in clip
count, additive to total merge time but not multiplicative.

### 3-Step Wizard

| Step | Name | Description |
|------|------|-------------|
| 1 | Add Videos | Drag-and-drop or browse; set resolution/FPS |
| 2 | Arrange & Preview | Sort, duplicate, drag-and-drop reorder, and review settings before merge |
| 3 | Finalize & Merge | Choose output path, start merge, and track progress |

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

### Arrange & Preview (Step 2)

- **Sorting**: Sort by Name (ascending/descending) via toolbar
- **Duplicate**: Click "Dup" to clone a video entry in the sequence
- **Drag-and-drop reorder**: Drag items by the handle (⠿) to rearrange
- **Up/Down/Remove**: Standard reorder and removal buttons

Also shows a summary of:
- Ordered file list
- Selected standardization settings
- Auth status and YouTube availability

### Finalize & Merge (Step 3)

- Choose output path
- Start merge and monitor progress
- Includes a collapsible **Advanced settings** section under Merge Settings for custom target resolution and FPS standardization.
- Advanced settings display a warning because forcing custom values may increase processing time and introduce re-encoding differences.
- Resolution choices include **Vertical (Phone)** and **Custom** options.

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
- Configure via environment variables (see `.env.example`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` (add `http://localhost:8976/oauth2callback` as an authorized redirect in Google Cloud).
- If you downloaded a Google OAuth client JSON file, you can set `GOOGLE_OAUTH_CLIENT_JSON_FILE` to its path instead of manually copying client id/secret.
- Add this to `.env` (example): `GOOGLE_OAUTH_CLIENT_JSON_FILE=C:/Users/your-user/Downloads/client_secret_xxx.apps.googleusercontent.com.json`
- In Google Cloud Console, ensure the OAuth client has `http://localhost:8976/oauth2callback` in Authorized redirect URIs (your current JSON shows only `http://localhost`).
- Packaged installers now include optional `.env` and `.env.local` files (if present during `npm run package` / Docker builder run) in `resources/runtime-config`; OAuth config is resolved from packaged runtime paths as well as current working directory.
 - The sign-in button advances the wizard only after a successful Google OAuth login; failed or canceled logins leave you on the current screen with an error status.
- Debug tracing for login clicks and OAuth flow is available in devtools/terminal logs with `[Auth][Renderer]` and `[Auth][Main]` prefixes.

### Dashboard & Settings

Accessible via ⚙ button in the header. Tabs:
- **Settings**: General settings + YouTube defaults in one tab; includes a Google sign-in button when logged out
- **Account**: Google account info, sign out
- **Info**: FFmpeg version and app developer credits

UI guardrails and polish:
- Main app window has a minimum size of **1080 × 720** to prevent layout breakage on very small windows.
- Finalize step keeps the “Signed in as …” helper text subtle (smaller + muted gray tone).
- Wizard stepper connector lines are extended for clearer 1 → 2 → 3 progression.

Output name templates support these tokens:
- `{date}` (YYYY-MM-DD)
- `{time}` (HH-MM-SS)
- `{timestamp}` (YYYY-MM-DD_HH-MM-SS)

Example template: `project_merge_{date}` → `project_merge_2026-03-17.mp4`

### FFmpeg Bundling

For **development** (`npm install` + `npm run dev`), FFmpeg is fetched automatically from `ffmpeg-static` / `ffprobe-static` and copied into `resources/ffmpeg/` by `scripts/install-ffmpeg.js` (postinstall hook). No manual download required.

For **packaged installers** (`docker compose run builder` or `npm run package`), drop a Windows static `ffmpeg.zip` (e.g. gyan.dev "ffmpeg-release-essentials") at the repo root. The docker builder unpacks it into `resources/ffmpeg/` before the electron-builder run. The packaged `.exe` is built with **FFmpeg version 2026-03-12-git-9dc44b43b2-full_build-www.gyan.dev** when that bundle is provided.

See [ffmpeg-bundling.md](./ffmpeg-bundling.md) for the full bundling, detection-priority, and troubleshooting reference.

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
