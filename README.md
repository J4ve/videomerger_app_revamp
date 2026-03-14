# Video Merger Application

A hybrid video merging solution with both a **web application** and a **desktop application** for merging multiple video files. The project demonstrates clean architecture principles with a shared Python backend for FFmpeg video processing.

## 📖 Table of Contents

- [Two Applications in One](#-two-applications-in-one)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment-web-application-only)
- [Architecture & Project Structure](#️-architecture--project-structure)
- [Running Tests](#-running-tests)
- [Development](#-development)
- [API Documentation](#-api-documentation-web-application)
- [Configuration](#️-configuration)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Two Applications in One

This repository contains two distinct applications:

1. **Web Application** - Flask-based web server with a browser interface
2. **Desktop Application** - Electron app with React UI showcasing clean architecture patterns

Both applications use the same Python backend for video processing with FFmpeg.

### Which Application Should I Use?

| Use Case | Recommended App |
|----------|----------------|
| Learning clean architecture patterns | Desktop App |
| Local video processing with native UI | Desktop App |
| Deploying to a server for team use | Web App |
| API integration with other services | Web App |
| Docker/container deployment | Web App |
| Studying design patterns (DI, Repository, etc.) | Desktop App |

## ✨ Features

### Common Features
- 🎬 **Multiple Video Support**: Merge 2 or more videos seamlessly
- 📦 **Multiple Formats**: Support for MP4, AVI, MOV, MKV, and WebM
- 🧪 **Well Tested**: Comprehensive unit and integration tests
- 🔒 **Secure**: File validation and sanitization built-in

### Web Application Features
- 🌐 **Browser-based UI**: Clean, intuitive web interface
- 🐳 **Dockerized**: Easy deployment with Docker and Docker Compose
- 🔌 **RESTful API**: Full API for programmatic access

### Desktop Application Features  
- 🖥️ **Native Desktop App**: Built with Electron + React + Vite
- 🏗️ **Clean Architecture**: Framework-agnostic core with dependency injection
- 🔄 **Modular Design**: Swappable components using design patterns
- 📐 **Design Patterns**: Repository, Command, Strategy, Observer, and Adapter patterns

## 📋 Prerequisites

### For Web Application
- Python 3.8 or higher
- FFmpeg (for video processing)
- Docker (optional, for containerized deployment)

### For Desktop Application
- Python 3.8 or higher
- FFmpeg (for video processing)
- Node.js 18 or higher
- npm (comes with Node.js)

## 🚀 Quick Start

Choose the application you want to run:

### Option 1: Desktop Application (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/J4ve/videomerger_app_revamp.git
   cd videomerger_app_revamp
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the desktop app**
   ```bash
   npm run dev
   ```

   This starts the Vite dev server and Electron in development mode.

   **Or build and run in production mode:**
   ```bash
   npm run build
   npm start
   ```

### Option 2: Web Application

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

## 🐳 Docker Usage

> **Note:** You must have **Docker Desktop** installed and running if you are on Windows. On Linux or macOS, the standard **Docker** engine is sufficient.

### Building the Desktop Application Executable

If you don't have Node.js or `npm` installed on your host system (e.g., on Windows), you can compile the Desktop Application into a standalone `.exe` using Docker Compose.

1. Open a standard Windows Command Prompt (cmd) or PowerShell.
2. Navigate to your project folder:
   ```bash
   cd C:\path\to\videomerger_app_revamp
   ```
3. Ensure Docker Desktop is running in the background.
4. Run the builder service:
   ```bash
   docker compose run --rm builder
   ```
   *(If `docker compose` is not recognized, try `docker-compose run --rm builder`)*

Docker will automatically download the necessary tools, build the app, and output your `VideoMerger Setup X.X.X.exe` into a new `dist-bin/` folder inside your project.

### Running the Web Application using Docker directly

If you prefer to run the Flask Web Application instead, you can build and run it using the Docker CLI:

```bash
docker build -t videomerger .
docker run -p 5000:5000 -v $(pwd)/uploads:/app/src/videomerger/static/uploads videomerger
```

The web application will be available at `http://localhost:5000`

## 🏗️ Architecture & Project Structure

### Desktop Application Architecture

The desktop app demonstrates **clean architecture** with clear separation of concerns and dependency injection throughout:

```
┌─────────────────────────────────────────┐
│     RENDERER (React/Vite)               │  ← UI Layer (swappable)
├─────────────────────────────────────────┤
│     MAIN PROCESS (Electron IPC)         │  ← Orchestration Layer
├─────────────────────────────────────────┤
│     CORE (Business Logic)               │  ← Framework-agnostic
│  - Interfaces, Services, Commands       │
│  - Dependency Injection Container       │
├─────────────────────────────────────────┤
│     ADAPTERS (External Integration)     │  ← Integration Layer  
│  - Python FFmpeg, File System           │
└─────────────────────────────────────────┘
```

#### Design Patterns Implemented

1. **Dependency Injection**: All services receive dependencies via constructors
2. **Repository Pattern**: File operations abstracted behind `IVideoRepository` interface
3. **Command Pattern**: Operations encapsulated as `ICommand` objects  
4. **Observer Pattern**: Processing events emit to subscribers via `IProcessingObserver`
5. **Strategy Pattern**: Pluggable processing strategies via `IVideoProcessingStrategy`
6. **Adapter Pattern**: Python process communication wrapped in `IFFmpegAdapter`

#### Key Architecture Principles

**Framework-Agnostic Core:**
- The `core/` directory has **zero** imports from Electron, React, or any UI framework
- All external dependencies are injected via interfaces
- Business logic is completely testable without Electron runtime

**Clear Layer Boundaries:**
- **Renderer**: Only UI concerns, communicates via `window.electronAPI`
- **Main**: Orchestration, IPC, window management - minimal business logic
- **Core**: All business logic, framework-agnostic
- **Adapters**: External integration points (Python, file system)

**Dependency Injection Everywhere:**
```typescript
// ❌ Bad: Hardcoded dependencies
class Service {
  private repo = new FileRepository();
}

// ✅ Good: Injected dependencies
class Service {
  constructor(private repo: IVideoRepository) {}
}
```

#### How to Swap Components

**Swap Frontend (React → Vue/Svelte):**
1. Replace `renderer/` directory with your framework
2. Keep same `window.electronAPI` interface in new framework
3. No changes needed in `core/` or `main/`

**Swap Python Communication (Child Process → HTTP API):**
1. Create new adapter implementing `IFFmpegAdapter`
2. Update DI registration in `main/main.ts`:
   ```typescript
   container.register('FFmpegAdapter', () => new HttpAPIAdapter(config), true);
   ```
3. No changes needed in business logic

**Swap File Operations (Local → Cloud Storage):**
1. Create new repository implementing `IVideoRepository`
2. Update DI registration:
   ```typescript
   container.register('VideoRepository', () => new CloudVideoRepository(config), true);
   ```

**Add New Processing Strategy:**
1. Implement `IVideoProcessingStrategy` interface
2. Register in container
3. Swap at runtime or via config

#### Future Extensibility

The desktop app's core business logic is designed to be reusable beyond Electron:

**Future Web API (Planned):**

The same TypeScript core from the desktop app could power a Node.js/Express web API:

```typescript
// Desktop App: Electron with DI container
container.register('VideoProcessingService', () => new VideoProcessingService(...));

// Future: Node.js/Express API using same core business logic
app.post('/merge', async (req, res) => {
  const service = new VideoProcessingService(httpRepository, cloudStrategy);
  const result = await service.mergeVideos(req.body);
  res.json(result);
});
```

**Mobile Apps (Planned):**

Mobile apps can call a cloud-based API built with the desktop app's core logic, enabling server-side video processing.

*Note: The existing Flask web app (in `src/videomerger/`) is separate from this planned architecture. The goal is to demonstrate how the desktop app's clean architecture enables code reuse across multiple platforms.*

See [DESKTOP_README.md](DESKTOP_README.md) for detailed architecture documentation and pattern explanations.

### Project Structure

```
videomerger_app_revamp/
├── core/                           # Desktop app: Framework-agnostic business logic
│   ├── interfaces/                 # TypeScript interface contracts
│   ├── services/                   # Business logic services
│   ├── commands/                   # Command pattern implementations
│   ├── strategies/                 # Strategy pattern implementations
│   ├── adapters/                   # Adapter pattern implementations
│   ├── repositories/               # Repository pattern implementations
│   ├── observers/                  # Observer pattern implementations
│   └── container.ts                # Dependency injection container
├── main/                           # Desktop app: Electron main process
│   ├── main.ts                     # Application entry, DI setup, IPC
│   └── preload.ts                  # IPC bridge to renderer
├── renderer/                       # Desktop app: React UI
│   ├── src/
│   │   ├── App.tsx                 # Main React component
│   │   ├── index.tsx               # React entry point
│   │   └── styles.css              # UI styles
│   └── index.html
├── src/videomerger/                # Web app: Flask application
│   ├── api/                        # API endpoints
│   ├── core/                       # Core video processing logic
│   ├── utils/                      # Utility functions
│   ├── static/                     # Static files (CSS, JS, uploads)
│   ├── templates/                  # HTML templates
│   ├── app.py                      # Main Flask application
│   └── video_processor_cli.py      # Shared: FFmpeg CLI wrapper (used by both apps)
├── tests/
│   ├── unit/                       # Unit tests
│   └── integration/                # Integration tests
├── docs/                           # Documentation
│   ├── API.md                      # Web API documentation
│   └── DEVELOPMENT.md              # Development guide
├── scripts/                        # Utility scripts
├── .github/workflows/              # CI/CD pipelines
├── Dockerfile                      # Docker config for web app
├── docker-compose.yml              # Docker Compose config
├── package.json                    # Node.js dependencies (desktop app)
├── vite.config.ts                  # Vite configuration (desktop app)
├── tsconfig.json                   # TypeScript config (renderer)
├── tsconfig.main.json              # TypeScript config (main process)
├── requirements.txt                # Python dependencies
├── setup.py                        # Python package setup
├── README.md                       # This file
└── DESKTOP_README.md               # Detailed desktop app architecture
```

## 🧪 Running Tests

### Web Application Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/videomerger

# Run specific test file
pytest tests/unit/test_app.py
```

### Desktop Application Tests

```bash
# Run tests with Vitest
npm test

# Run with watch mode
npm test -- --watch
```

## 💻 Development

### Desktop App Development

**Available Scripts:**

| Script | Description |
|--------|-------------|
| `npm run dev` | Run in development mode with hot reload (Vite + Electron) |
| `npm run dev:renderer` | Run only the Vite dev server (port 3000) |
| `npm run dev:main` | Build and run only the Electron main process |
| `npm run build` | Build both renderer and main for production |
| `npm run build:renderer` | Build only the renderer (Vite) |
| `npm run build:main` | Build only the main process (TypeScript) |
| `npm run preview` | Preview Vite build |
| `npm start` | Build and run in production mode |
| `npm test` | Run tests with Vitest |
| `npm run lint` | Lint TypeScript code with ESLint |
| `npm run format` | Format code with Prettier |

**Development Workflow:**
```bash
# Start development (hot reload enabled)
npm run dev

# This runs concurrently:
# - Vite dev server (renderer) on port 3000
# - Electron main process with auto-reload

# Build for production
npm run build

# Run production build
npm start
```

### Web App Development

```bash
# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run development server
python src/videomerger/app.py

# Or using Flask CLI
export FLASK_APP=src/videomerger/app.py
export FLASK_ENV=development
flask run
```

### Code Quality (Web App)

```bash
# Format code
black src/videomerger tests

# Sort imports
isort src/videomerger tests

# Lint code
flake8 src/videomerger tests

# Run all quality checks
black src/videomerger tests && isort src/videomerger tests && flake8 src/videomerger tests
```

## 📚 API Documentation (Web Application)

The Flask web application provides a RESTful API. For complete API documentation, see [docs/API.md](docs/API.md).

### Key Endpoints

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

## ⚙️ Configuration

### Desktop Application

The desktop app is configured via `main/main.ts`:

```typescript
const appConfig: IAppConfig = {
  pythonPath: 'python',
  pythonScriptPath: path.join(__dirname, '../../src/videomerger/video_processor_cli.py'),
  supportedFormats: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
};
```

### Web Application

Configuration is managed through environment variables. See `.env.example` for available options:

- `FLASK_ENV`: Environment (development/production)
- `SECRET_KEY`: Flask secret key
- `MAX_CONTENT_LENGTH`: Maximum file upload size
- `UPLOAD_FOLDER`: Directory for uploaded files
- `OUTPUT_FOLDER`: Directory for output files

## 🤝 Contributing

We welcome contributions to both the web and desktop applications!

### Contribution Guidelines

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Follow existing code style and patterns
   - Add tests for new features
   - Update documentation as needed
4. **Run tests and quality checks**
   ```bash
   # For Python/web app
   pytest
   black src/videomerger tests
   flake8 src/videomerger tests
   
   # For TypeScript/desktop app
   npm test
   npm run lint
   npm run format
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Areas for Contribution

- **Desktop App**: Enhance UI components, add new design patterns, improve architecture
- **Web App**: Add new API endpoints, improve error handling, enhance security
- **Testing**: Increase test coverage, add integration tests
- **Documentation**: Improve guides, add examples, fix typos
- **Performance**: Optimize video processing, reduce memory usage

For detailed development guidelines, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- SE2 Project Team
- **Web App**: Flask Framework
- **Desktop App**: Electron, React, Vite
- **Video Processing**: FFmpeg Community
- Clean Architecture principles by Robert C. Martin

## 💬 Support

For issues and questions, please open an issue on the [GitHub repository](https://github.com/J4ve/videomerger_app_revamp/issues).

## 🔗 Additional Resources

- [DESKTOP_README.md](DESKTOP_README.md) - Detailed desktop app architecture and design patterns
- [docs/API.md](docs/API.md) - Complete web API documentation
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide for contributors
