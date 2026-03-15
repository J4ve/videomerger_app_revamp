# Bulk video merging app

A professional desktop solution for merging multiple video files with ease. Featuring a clean architecture built with **Electron**, **React**, and **TypeScript**, powered by high-performance **FFmpeg** processing via Python.

## 📖 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Docker Development](#-docker-development)
- [Architecture & Project Structure](#️-architecture--project-structure)
- [Running Tests](#-running-tests)
- [Development Workflow](#-development-workflow)
- [Configuration](#️-configuration)
- [Future: Web Implementation](#-future-web-implementation)
- [License](#-license)

## ✨ Features

- 🎬 **Multiple Video Support**: Merge 2 or more videos seamlessly.
- 📦 **Cross-Platform Formats**: Support for `MP4`, `AVI`, `MOV`, `MKV`, and `WEBM`.
- 🖥️ **Native Desktop Experience**: Built with Electron + React + Vite for a premium look and feel.
- 🏗️ **Clean Architecture**: A framework-agnostic core with industry-standard design patterns (DI, Repository, Command, Strategy, Observer, and Adapter).
- 🧪 **Reliable & Tested**: Comprehensive unit and integration tests using Vitest and Pytest.
- 🔒 **Secure**: Robust file validation and sanitization.
- 🐳 **Docker-Ready**: Complete containerized environment for both development and building production installers.

## 📋 Prerequisites

- **Python 3.8+** (for video processing)
- **Node.js 18+** & **npm** (for desktop UI)
- **FFmpeg** (packaged with the app, but optional for system-wide use)
- **Docker Desktop** (optional, recommended for isolated builds)

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/J4ve/videomerger_app_revamp.git
   cd videomerger_app_revamp
   ```

2. **Install Dependencies**
   ```bash
   npm install        # Node.js
   pip install -r requirements.txt  # Python
   ```

3. **Run the App (Development Mode)**
   ```bash
   npm run dev
   ```

4. **Build & Package (Production)**
   ```bash
   npm run dist        # Native build
   # OR use Docker for a clean environment-free build:
   docker compose run builder
   ```

## 🐳 Docker Development & Deployment

We provide a robust Docker setup to simplify your workflow:

### Build Standalone Windows Installer
Compile the Windows `.exe` without installing Node.js or Wine on your host machine:
```bash
docker compose run --rm builder
```
Output located in: `dist-bin/`

### isolated Development Environment
Run the live development environment (Vite + Electron) inside a container:
```bash
docker compose run --rm -p 3000:3000 dev-desktop
```
*(Note: requires an X-Server like VcXsrv to see the GUI popup)*

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

### Desktop Application Tests
```bash
npm test          # Run Vitest suite
npm test -- --watch  # Continuous testing
```

### Python/Core Tests
```bash
pytest            # Run Python logic tests
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

The application is configured via `main/main.ts` for Electron settings and environment variables for specific production flags.

## 🚀 Future: Web Implementation

While the current focus is on a native desktop experience, the shared Python backend and clean architecture interfaces are designed to support a future **Flask/Web implementation**. This is currently preserved for legacy/experimental use in the `src/videomerger/` folder.

- **Current Status**: Development Focused on Desktop.
- **Legacy API Documentation**: Available in [docs/API.md](docs/API.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Core**: Electron, React, Vite
- **Processing**: FFmpeg Community
- **Architecture**: Robert C. Martin (Uncle Bob)

---
*Developed by J4ve*
