# Video Merger Desktop Application

Clean architecture desktop application for merging videos using Electron + React/Vite + Python.

## Architecture Overview

This application demonstrates **clean architecture** principles with clear separation of concerns and dependency injection throughout.

### Design Patterns Implemented

1. **Dependency Injection**: All services receive dependencies via constructors
2. **Repository Pattern**: File operations abstracted behind `IVideoRepository`
3. **Command Pattern**: Operations encapsulated as `ICommand` objects  
4. **Observer Pattern**: Processing events emit to subscribers via `IProcessingObserver`
5. **Strategy Pattern**: Pluggable processing strategies via `IVideoProcessingStrategy`
6. **Adapter Pattern**: Python process communication wrapped in `IFFmpegAdapter`

### Layer Separation

```
┌─────────────────────────────────────────┐
│          RENDERER (React/Vite)          │  ← UI Layer (swappable)
├─────────────────────────────────────────┤
│      MAIN PROCESS (Electron IPC)        │  ← Orchestration Layer
├─────────────────────────────────────────┤
│      CORE (Business Logic)              │  ← Framework-agnostic
│  - Interfaces                           │
│  - Services (with DI)                   │
│  - Commands, Strategies, Observers      │
├─────────────────────────────────────────┤
│      ADAPTERS (External Integration)    │  ← Integration Layer
│  - Python FFmpeg Adapter                │
│  - File System Repository               │
│  - Process Spawner                      │
└─────────────────────────────────────────┘
```

## Project Structure

```
videomerger_app_revamp/
├── core/                           # Framework-agnostic business logic
│   ├── interfaces/                 # TypeScript interface contracts
│   │   └── IVideoProcessing.ts    # All core interfaces
│   ├── services/                   # Business logic services
│   │   └── VideoProcessingService.ts
│   ├── commands/                   # Command pattern implementations
│   │   └── MergeVideosCommand.ts
│   ├── strategies/                 # Strategy pattern implementations
│   │   └── VideoProcessingStrategies.ts
│   ├── adapters/                   # Adapter pattern implementations
│   │   ├── PythonFFmpegAdapter.ts
│   │   └── NodeProcessSpawner.ts
│   ├── repositories/               # Repository pattern implementations
│   │   └── FileSystemVideoRepository.ts
│   ├── observers/                  # Observer pattern implementations
│   │   └── ProcessingEventEmitter.ts
│   └── container.ts                # Dependency injection container
├── main/                           # Electron main process
│   ├── main.ts                     # Application entry, DI setup, IPC
│   └── preload.ts                  # IPC bridge to renderer
├── renderer/                       # React UI (swappable frontend)
│   ├── src/
│   │   ├── App.tsx                 # Main React component
│   │   ├── index.tsx               # React entry point
│   │   └── styles.css              # UI styles
│   └── index.html
├── src/videomerger/                # Python backend
│   └── video_processor_cli.py      # FFmpeg CLI wrapper
├── package.json                    # Node dependencies
├── vite.config.ts                  # Vite configuration
├── tsconfig.json                   # TypeScript config (renderer)
└── tsconfig.main.json              # TypeScript config (main)
```

## How to Swap Components

### Swap Frontend (React → Vue/Svelte)

1. Replace `renderer/` directory with your framework
2. Keep same `window.electronAPI` interface in new framework
3. No changes needed in `core/` or `main/`

### Swap Python Communication (Child Process → HTTP API)

1. Create new adapter implementing `IFFmpegAdapter`
2. Update DI registration in `main/main.ts`:
```typescript
container.register('FFmpegAdapter', () => new HttpAPIAdapter(config), true);
```
3. No changes needed in business logic

### Swap File Operations (Local → Cloud)

1. Create new repository implementing `IVideoRepository`
2. Update DI registration:
```typescript
container.register('VideoRepository', () => new CloudVideoRepository(config), true);
```

### Add New Processing Strategy

1. Implement `IVideoProcessingStrategy`
2. Register in container
3. Swap at runtime or via config

## Prerequisites

- Node.js 18+
- Python 3.8+
- FFmpeg installed on system

## Installation

```bash
npm install
pip install -r requirements.txt
```

## Development

```bash
npm run dev
```

This starts Vite dev server (port 3000) and Electron in development mode.

## Building

```bash
npm run build
npm start
```

## Key Principles

### 1. No Framework Dependencies in Core

`core/` directory has **zero** imports from Electron, React, or any UI framework.  
All external dependencies are injected via interfaces.

### 2. Testable Without Electron

Core business logic can be tested with plain TypeScript:

```typescript
const mockSpawner: IProcessSpawner = { /* mock implementation */ };
const config: IAppConfig = { /* test config */ };
const adapter = new PythonFFmpegAdapter(mockSpawner, config);
```

### 3. Clear Boundaries

- **Renderer**: Only UI concerns, communicates via `window.electronAPI`
- **Main**: Orchestration, IPC, window management - minimal business logic
- **Core**: All business logic, framework-agnostic
- **Adapters**: External integration points

### 4. Dependency Injection Everywhere

```typescript
// Bad: Hardcoded dependencies
class Service {
  private repo = new FileRepository();  // ❌
}

// Good: Injected dependencies
class Service {
  constructor(private repo: IVideoRepository) {}  // ✅
}
```

### 5. Observer Pattern for Events

Processing events flow from core → main → renderer:

```
Core Service → ProcessingEventEmitter → IPCProcessingObserver → Renderer
```

## Future Extensibility

### Web API (FastAPI/Flask)

The core business logic is designed to be reusable:

```typescript
// Desktop: Electron DI container
container.register('VideoProcessingService', () => new VideoProcessingService(...));

// Web API: Express/FastAPI uses same core
app.post('/merge', async (req, res) => {
  const service = new VideoProcessingService(httpRepository, cloudStrategy);
  const result = await service.mergeVideos(req.body);
  res.json(result);
});
```

### Mobile Apps

Mobile apps can use the same Python backend or call a web API built with the same core logic.

## License

MIT

