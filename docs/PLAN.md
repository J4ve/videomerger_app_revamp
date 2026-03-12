# Video Merger Desktop Application — Development Plan

> **Status:** Initial Planning  
> **Last Updated:** 2026-03-12  
> **Scope:** Desktop-first (Electron + React + Python). Web API planned for Phase 3.

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Technology Stack](#2-technology-stack)
3. [Software Design Principles](#3-software-design-principles)
4. [Architecture Overview](#4-architecture-overview)
5. [Design Patterns](#5-design-patterns)
6. [TypeScript Interface Contracts](#6-typescript-interface-contracts)
7. [Project Structure](#7-project-structure)
8. [Phased Development Plan](#8-phased-development-plan)
9. [Testing Strategy](#9-testing-strategy)
10. [Future Extensibility (Phase 2+)](#10-future-extensibility-phase-2)
11. [Definition of Done](#11-definition-of-done)

---

## 1. Vision & Goals

### Primary Goal — Desktop Application (Phase 1)

Build a **native desktop application** (in the style of Steam or Discord) that allows users to merge video files locally on their machine. The application must:

- Present a polished native window using **Electron**.
- Render its UI with **React** inside the Electron window (never in a browser).
- Spawn a **Python child process** to drive **FFmpeg** locally, keeping all video data on the user's machine.
- Follow **clean architecture** so that no layer is coupled to another's concrete implementation.

### Secondary Goal — Future Web API (Phase 2, planned)

Design the **core video-processing domain** to be framework-agnostic so that the exact same business logic can later power a **FastAPI / Flask web API** consumed by mobile clients — without rewriting domain code.

---

## 2. Technology Stack

| Concern | Technology | Rationale |
|---|---|---|
| Native window / OS integration | **Electron** | Full file-system access, native menus, system notifications |
| UI rendering | **React + TypeScript** | Component model, typed props, large ecosystem |
| Build / hot-reload | **Vite** | Fast HMR for renderer; esbuild for production |
| Core business logic | **TypeScript** | Type-safe interfaces shared across renderer and main |
| Video processing | **Python + FFmpeg** | Mature, cross-platform video toolchain |
| Python ↔ Electron bridge | **child_process (IPC)** | Electron main process spawns Python as a child; JSON over stdio |
| Testing (TS) | **Vitest** | Native ESM support, compatible with Vite |
| Testing (Python) | **pytest** | Standard; supports async and mocking |
| Linting / formatting (TS) | **ESLint + Prettier** | Consistent code style |
| Linting / formatting (Py) | **flake8 + black + isort** | PEP 8 compliance |

---

## 3. Software Design Principles

The following principles guide every design decision in this project.

### SOLID

| Principle | Applied As |
|---|---|
| **S** — Single Responsibility | Each class/module has one reason to change. `VideoProcessingService` only orchestrates; `PythonFFmpegAdapter` only communicates with Python. |
| **O** — Open/Closed | Core interfaces are stable. New behaviour is added by creating new implementations (e.g. `CloudVideoRepository`) not by modifying existing ones. |
| **L** — Liskov Substitution | Every concrete class implementing an interface must be substitutable without breaking callers. Enforced via TypeScript's structural typing. |
| **I** — Interface Segregation | Interfaces are small and focused: `IFFmpegAdapter`, `IVideoRepository`, `IProcessSpawner` are separate rather than one large "IVideoSystem". |
| **D** — Dependency Inversion | High-level modules (`VideoProcessingService`) depend only on abstractions (`IVideoRepository`, `IFFmpegAdapter`). Concrete bindings happen in the DI container. |

### Additional Principles

- **DRY** — Domain logic written once in `core/`; consumed by both Electron and any future web layer.
- **Separation of Concerns** — Four layers (Renderer, Main, Core, Adapters) with strict import rules: lower layers never import from higher layers.
- **Fail Fast** — Validate inputs at the entry points (IPC handlers, CLI argument parser) rather than deep in business logic.
- **Principle of Least Knowledge (Law of Demeter)** — Services talk to their direct dependencies only; they do not reach through objects.

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  RENDERER  (React + Vite)                                    │
│  • Displays UI, handles user interaction                     │
│  • Communicates ONLY via window.electronAPI (preload bridge) │
│  • No direct access to Node.js, file system, or Python      │
├──────────────────────────────────────────────────────────────┤
│  MAIN PROCESS  (Electron + Node.js)                          │
│  • Creates BrowserWindow, registers IPC handlers            │
│  • Bootstraps the DI container                              │
│  • Delegates all business logic to Core                     │
│  • Minimal: no business rules live here                     │
├──────────────────────────────────────────────────────────────┤
│  CORE  (Pure TypeScript — framework-agnostic)                │
│  • Interfaces / contracts (IVideoRepository, IFFmpegAdapter) │
│  • Services  (VideoProcessingService)                        │
│  • Commands  (MergeVideosCommand)                            │
│  • Strategies (LocalMergeStrategy, ConcatDemuxerStrategy)   │
│  • Observers (ProcessingEventEmitter)                        │
│  • DI Container                                             │
│  ⚠ Zero imports from Electron, React, or Node built-ins    │
├──────────────────────────────────────────────────────────────┤
│  ADAPTERS  (Integration Layer — may use Node built-ins)      │
│  • PythonFFmpegAdapter      — spawns & communicates w/ Python│
│  • FileSystemVideoRepository — local file I/O via Node fs   │
│  • NodeProcessSpawner        — wraps child_process.spawn     │
│  Implements interfaces from Core; never imported by Core    │
└──────────────────────────────────────────────────────────────┘
         │  JSON over stdio (IPC)
         ▼
┌──────────────────────────────────────────────────────────────┐
│  PYTHON BACKEND  (video_processor_cli.py)                    │
│  • Receives commands as JSON arguments                       │
│  • Invokes FFmpeg via subprocess                             │
│  • Reports progress / errors back to stdout                  │
└──────────────────────────────────────────────────────────────┘
```

### Import Direction Rules (enforced by ESLint)

```
Renderer  →  (only window.electronAPI)
Main      →  Core, Adapters
Adapters  →  Core (interfaces only); Node built-ins allowed
Core      →  nothing external (no Node, no Electron, no React)
Python    →  stdlib + FFmpeg
```

---

## 5. Design Patterns

### 5.1 Dependency Injection

All services receive dependencies through their constructors; the DI container wires them together at startup.

```typescript
// core/container.ts
container.register('ProcessSpawner',       () => new NodeProcessSpawner(),                   true);
container.register('FFmpegAdapter',        () => new PythonFFmpegAdapter(spawner, config),    true);
container.register('VideoRepository',      () => new FileSystemVideoRepository(config),       true);
container.register('EventEmitter',         () => new ProcessingEventEmitter(),                true);
container.register('MergeStrategy',        () => new LocalMergeStrategy(ffmpegAdapter),       true);
container.register('VideoProcessingService',
  () => new VideoProcessingService(repository, strategy, eventEmitter), true);
```

**Why:** makes every component unit-testable in isolation using mocks; swap any component without touching business logic.

### 5.2 Repository Pattern

All file-system interactions are behind `IVideoRepository`. Business logic never calls `fs` directly.

```typescript
interface IVideoRepository {
  saveUploadedFile(buffer: Buffer, filename: string): Promise<string>;
  getFilePath(filename: string): string;
  deleteFile(path: string): Promise<void>;
  listOutputFiles(): Promise<string[]>;
}
```

**Why:** easy to swap local storage for cloud storage (S3, GCS) without changing `VideoProcessingService`.

### 5.3 Command Pattern

Each user operation is encapsulated as a command object. Commands are composable, loggable, and undoable.

```typescript
interface ICommand<TResult = void> {
  execute(): Promise<TResult>;
}

class MergeVideosCommand implements ICommand<IMergeResult> {
  constructor(
    private readonly params: IMergeParams,
    private readonly service: IVideoProcessingService,
  ) {}

  async execute(): Promise<IMergeResult> {
    return this.service.mergeVideos(this.params);
  }
}
```

**Why:** decouples the *request* from the *handler*; enables command queuing, undo stacks, and audit logs.

### 5.4 Strategy Pattern

FFmpeg processing can be performed via different strategies (concat demuxer, filter-complex, re-encode) that are interchangeable at runtime.

```typescript
interface IVideoProcessingStrategy {
  merge(inputPaths: string[], outputPath: string): Promise<void>;
}

class ConcatDemuxerStrategy implements IVideoProcessingStrategy { ... }
class FilterComplexStrategy  implements IVideoProcessingStrategy { ... }
```

**Why:** add new processing modes without modifying existing code (Open/Closed Principle).

### 5.5 Adapter Pattern

The Python child process is wrapped behind `IFFmpegAdapter`. Electron's `child_process` details are hidden inside `NodeProcessSpawner`.

```typescript
interface IFFmpegAdapter {
  mergeVideos(inputPaths: string[], outputPath: string): Promise<IFFmpegResult>;
  getVersion(): Promise<string>;
}

interface IProcessSpawner {
  spawn(command: string, args: string[]): IChildProcess;
}
```

**Why:** the adapter can be swapped for an HTTP adapter (calling a remote API) without changing any core logic.

### 5.6 Observer Pattern

Processing progress events flow from the core outward through registered observers. The renderer subscribes via IPC.

```typescript
interface IProcessingObserver {
  onProgress(event: IProgressEvent): void;
  onComplete(event: ICompleteEvent): void;
  onError(event: IErrorEvent): void;
}

// Core emits → Main's IPCProcessingObserver → preload bridge → Renderer
```

**Why:** decouples progress reporting from the processing logic; multiple observers can be registered (logging, UI, analytics).

---

## 6. TypeScript Interface Contracts

All cross-layer contracts are defined in `core/interfaces/IVideoProcessing.ts`.

```typescript
// ── Configuration ────────────────────────────────────────────
export interface IAppConfig {
  pythonPath: string;
  pythonScriptPath: string;
  supportedFormats: string[];
  uploadDir: string;
  outputDir: string;
  maxFileSizeMb: number;
}

// ── Video domain ─────────────────────────────────────────────
export interface IVideoFile {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  format: string;
}

export interface IMergeParams {
  inputFiles: IVideoFile[];
  outputName: string;
  strategy?: 'concat-demuxer' | 'filter-complex';
}

export interface IMergeResult {
  success: boolean;
  outputPath: string;
  durationMs: number;
  error?: string;
}

// ── Repository ───────────────────────────────────────────────
export interface IVideoRepository {
  saveUploadedFile(buffer: Buffer, filename: string): Promise<string>;
  getFilePath(filename: string): string;
  deleteFile(path: string): Promise<void>;
  listOutputFiles(): Promise<string[]>;
}

// ── Processing ───────────────────────────────────────────────
export interface IVideoProcessingStrategy {
  merge(inputPaths: string[], outputPath: string): Promise<void>;
  readonly name: string;
}

export interface IVideoProcessingService {
  mergeVideos(params: IMergeParams): Promise<IMergeResult>;
}

// ── FFmpeg Adapter ───────────────────────────────────────────
export interface IFFmpegResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface IFFmpegAdapter {
  mergeVideos(inputPaths: string[], outputPath: string): Promise<IFFmpegResult>;
  getVersion(): Promise<string>;
}

// ── Process Spawner ──────────────────────────────────────────
export interface IChildProcess {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  /** 'close' fires after stdio streams close; use instead of 'exit' to guarantee all output is flushed. */
  on(event: 'close', listener: (code: number) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}

export interface IProcessSpawner {
  spawn(command: string, args: string[], options?: object): IChildProcess;
}

// ── Commands ─────────────────────────────────────────────────
export interface ICommand<TResult = void> {
  execute(): Promise<TResult>;
}

// ── Observers ────────────────────────────────────────────────
export interface IProgressEvent {
  percent: number;
  currentFile: string;
  elapsedMs: number;
}

export interface ICompleteEvent {
  outputPath: string;
  totalDurationMs: number;
}

export interface IErrorEvent {
  message: string;
  code?: string;
}

export interface IProcessingObserver {
  onProgress(event: IProgressEvent): void;
  onComplete(event: ICompleteEvent): void;
  onError(event: IErrorEvent): void;
}

export interface IProcessingEventEmitter {
  subscribe(observer: IProcessingObserver): void;
  unsubscribe(observer: IProcessingObserver): void;
  emitProgress(event: IProgressEvent): void;
  emitComplete(event: ICompleteEvent): void;
  emitError(event: IErrorEvent): void;
}

// ── Electron IPC (preload bridge) ────────────────────────────
export interface IElectronAPI {
  selectFiles(): Promise<string[]>;
  mergeVideos(params: IMergeParams): Promise<IMergeResult>;
  onProgress(callback: (event: IProgressEvent) => void): void;
  onMergeComplete(callback: (event: ICompleteEvent) => void): void;
  onMergeError(callback: (event: IErrorEvent) => void): void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

---

## 7. Project Structure

```
videomerger_app_revamp/
│
├── core/                                  # Pure TypeScript — ZERO external imports
│   ├── interfaces/
│   │   └── IVideoProcessing.ts            # All cross-layer type contracts
│   ├── services/
│   │   └── VideoProcessingService.ts      # Orchestrates merge workflow
│   ├── commands/
│   │   └── MergeVideosCommand.ts          # Command encapsulating a merge request
│   ├── strategies/
│   │   ├── ConcatDemuxerStrategy.ts       # Fast concat (same codec/resolution)
│   │   └── FilterComplexStrategy.ts       # Re-encode (different codecs)
│   ├── observers/
│   │   └── ProcessingEventEmitter.ts      # Observable progress events
│   └── container.ts                       # DI wiring
│
├── adapters/                              # Integration Layer — may import Node built-ins
│   ├── PythonFFmpegAdapter.ts             # Speaks to Python child process
│   ├── NodeProcessSpawner.ts              # Wraps child_process.spawn
│   └── FileSystemVideoRepository.ts       # Local file I/O via Node fs
│
├── main/                                  # Electron main process
│   ├── main.ts                            # App entry, window creation, IPC handlers
│   └── preload.ts                         # contextBridge — exposes electronAPI to renderer
│
├── renderer/                              # React UI
│   ├── index.html
│   └── src/
│       ├── index.tsx                      # ReactDOM.createRoot entry
│       ├── App.tsx                        # Root component, routing
│       ├── components/
│       │   ├── FileSelector.tsx           # Drag-and-drop / open-dialog
│       │   ├── MergeButton.tsx            # Triggers merge command
│       │   ├── ProgressBar.tsx            # Listens to onProgress events
│       │   └── OutputViewer.tsx           # Shows result, open-folder button
│       └── styles.css
│
├── src/videomerger/                       # Python backend (shared with web app)
│   ├── video_processor_cli.py             # CLI entry: reads JSON args, calls FFmpeg
│   └── ...                               # (existing Flask web app files)
│
├── tests/
│   ├── unit/
│   │   ├── core/                          # Tests for services, commands, strategies
│   │   └── python/                        # Tests for video_processor_cli
│   └── integration/
│       ├── ipc/                           # Tests for IPC handlers (mocked Electron)
│       └── python/                        # Tests for Python ↔ FFmpeg flow
│
├── docs/
│   ├── PLAN.md                            # This file
│   ├── API.md                             # Web API reference
│   └── DEVELOPMENT.md                     # Developer setup guide
│
├── package.json
├── vite.config.ts
├── tsconfig.json                          # Renderer TypeScript config
├── tsconfig.main.json                     # Main process TypeScript config
├── requirements.txt
└── pytest.ini
```

---

## 8. Phased Development Plan

### Phase 0 — Foundation & Setup ✅ (completed)

- [x] Repository structure established
- [x] Electron + React + Vite scaffold
- [x] Python FFmpeg CLI wrapper (`video_processor_cli.py`)
- [x] Core interfaces defined in `IVideoProcessing.ts`
- [x] DI container implemented
- [x] `PythonFFmpegAdapter` and `NodeProcessSpawner` (in `adapters/`)
- [x] `FileSystemVideoRepository` (in `adapters/`)
- [x] `VideoProcessingService` with constructor injection
- [x] `MergeVideosCommand`
- [x] `ProcessingEventEmitter`
- [x] `ConcatDemuxerStrategy` (basic)
- [x] IPC handlers in `main.ts`
- [x] Preload bridge (`contextBridge`)
- [x] Basic React UI (`App.tsx`)

---

### Phase 1 — Desktop MVP 🚧 (current focus)

**Goal:** A fully usable desktop app where users can select video files, merge them, and see progress — all locally, no internet required.

#### Milestone 1.1 — File Selection & Validation

| Task | Owner Layer | Acceptance Criteria |
|---|---|---|
| Native file-open dialog via `dialog.showOpenDialog` | Main | Returns array of valid file paths |
| File format validation against `supportedFormats` config | Core / Service | Rejects unsupported extensions with typed error |
| File size validation against `maxFileSizeMb` config | Core / Service | Rejects oversized files before spawning Python |
| Display selected files list in UI | Renderer | Shows filename, size, format badge |
| Allow reordering files (drag-and-drop) | Renderer | Order persists when merge is triggered |
| Allow removing individual files | Renderer | File removed from list; merge button disabled if < 2 files |

#### Milestone 1.2 — Merge Workflow

| Task | Owner Layer | Acceptance Criteria |
|---|---|---|
| `MergeVideosCommand.execute()` triggers full pipeline | Core | Command resolves with `IMergeResult` |
| Python child process spawned with correct arguments | Adapters | `video_processor_cli.py` receives JSON-encoded params |
| stdout parsed for progress events | Adapters | `IProgressEvent` emitted per FFmpeg progress line |
| Merge result returned via IPC | Main | Renderer receives `ICompleteEvent` or `IErrorEvent` |
| Progress bar updates in real-time | Renderer | Smooth percent increment from 0–100 |
| Output filename configurable | Renderer / Core | User can set output name; defaults to `merged_<timestamp>.mp4` |

#### Milestone 1.3 — Output & Error Handling

| Task | Owner Layer | Acceptance Criteria |
|---|---|---|
| "Open in folder" button after success | Renderer | Opens OS file manager at output directory |
| Error messages surfaced to UI | Renderer | Typed `IErrorEvent.message` shown in toast/alert |
| Python process crash handled gracefully | Adapters | Non-zero exit code → `IErrorEvent` emitted |
| FFmpeg not found handled | Adapters | Friendly error: "FFmpeg is not installed. Please install it." |
| Cleanup of temp files on error | Core / Repository | `deleteFile` called on partial outputs |

#### Milestone 1.4 — Settings & Configuration

| Task | Owner Layer | Acceptance Criteria |
|---|---|---|
| Settings panel (output directory, Python path) | Renderer | Values persist to `electron-store` or config file |
| `IAppConfig` loaded from persisted settings | Main | DI container re-initialised on settings save |
| Strategy selector (concat vs. re-encode) | Renderer | DI container swaps strategy; no restart required |

#### Milestone 1.5 — Testing & Quality

| Task | Tooling | Acceptance Criteria |
|---|---|---|
| Unit tests for all Core classes | Vitest | 90%+ coverage on `core/` |
| Unit tests for Python CLI | pytest | All processing paths covered, FFmpeg mocked |
| Integration test: full IPC merge flow | Vitest + mocked Electron | End-to-end command → result with mock Python |
| ESLint passes with zero errors | ESLint | CI gate |
| flake8 / black / isort passes | Python toolchain | CI gate |

---

### Phase 2 — Polish & Packaging 📋 (planned)

**Goal:** Distribute the app as a standalone installer for Windows, macOS, and Linux.

| Task | Notes |
|---|---|
| Bundle Python with PyInstaller or embed system Python | Avoids "Python not found" for end-users |
| Electron Builder / Forge packaging | Produces `.exe`, `.dmg`, `.AppImage` installers |
| Auto-update mechanism (electron-updater) | Notify user when new version is available |
| Application icon and branding | Native window icon, About dialog |
| Dark / light mode support | Follows OS preference via `prefers-color-scheme` |
| Multi-language support (i18n) | Optional; add `react-i18next` scaffolding |
| Crash reporting | Optional; sentry-electron or custom logger |

---

### Phase 3 — Web API for Mobile (planned, not started)

**Goal:** Expose the same core domain logic via a FastAPI / Flask HTTP API so that mobile clients can submit merge jobs to a server.

#### Design Reuse Strategy

The TypeScript `core/` layer is already framework-agnostic. For a Python-only API, the same logic is reimplemented in `src/videomerger/` (already exists as Flask). The interface contracts serve as the specification.

```
Desktop App
  core/VideoProcessingService.ts
  └── IVideoRepository (FileSystemVideoRepository)
  └── IFFmpegAdapter   (PythonFFmpegAdapter)

Web API (Phase 3)
  src/videomerger/core/video_processor.py   ← same domain logic, Python
  └── IVideoRepository → LocalRepository or S3Repository
  └── IFFmpegAdapter   → LocalFFmpegAdapter or CloudTranscodeAdapter
```

#### Planned Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/jobs` | Submit a merge job; returns `job_id` |
| `GET` | `/api/v1/jobs/{job_id}` | Poll job status and progress |
| `GET` | `/api/v1/jobs/{job_id}/download` | Download merged output |
| `DELETE` | `/api/v1/jobs/{job_id}` | Cancel / clean up a job |

#### Architecture for Phase 3

```
Mobile Client  →  FastAPI  →  Python VideoProcessor  →  FFmpeg
                     ↑
               Same domain interfaces
               (reimplemented in Python)
```

---

## 9. Testing Strategy

### Layers of Tests

```
E2E (optional, Phase 2)
  └── Playwright / Spectron — full Electron app

Integration
  └── IPC handlers with mocked child_process
  └── Python CLI with mocked FFmpeg binary

Unit
  └── Core services, commands, strategies (Vitest)
  └── Python processor, validators (pytest)
```

### Core Unit Test Pattern

```typescript
// tests/unit/core/VideoProcessingService.test.ts
import { VideoProcessingService } from '../../../core/services/VideoProcessingService';

const mockRepository: IVideoRepository = {
  saveUploadedFile: vi.fn().mockResolvedValue('/tmp/test.mp4'),
  getFilePath: vi.fn().mockReturnValue('/tmp/test.mp4'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  listOutputFiles: vi.fn().mockResolvedValue([]),
};

const mockStrategy: IVideoProcessingStrategy = {
  name: 'mock',
  merge: vi.fn().mockResolvedValue(undefined),
};

const mockEmitter: IProcessingEventEmitter = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emitProgress: vi.fn(),
  emitComplete: vi.fn(),
  emitError: vi.fn(),
};

test('mergeVideos resolves with output path', async () => {
  const service = new VideoProcessingService(mockRepository, mockStrategy, mockEmitter);
  const result = await service.mergeVideos({
    inputFiles: [
      { id: '1', name: 'a.mp4', path: '/tmp/a.mp4', sizeBytes: 1024, format: 'mp4' },
      { id: '2', name: 'b.mp4', path: '/tmp/b.mp4', sizeBytes: 2048, format: 'mp4' },
    ],
    outputName: 'merged.mp4',
  });
  expect(result.success).toBe(true);
  expect(mockStrategy.merge).toHaveBeenCalledOnce();
});
```

### Python Test Pattern

```python
# tests/unit/python/test_video_processor_cli.py
from unittest.mock import patch, MagicMock
from src.videomerger.video_processor_cli import merge_videos

def test_merge_calls_ffmpeg(tmp_path):
    input_files = [str(tmp_path / 'a.mp4'), str(tmp_path / 'b.mp4')]
    output_file = str(tmp_path / 'out.mp4')

    with patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout='', stderr='')
        merge_videos(input_files, output_file)
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert 'ffmpeg' in args[0]
```

---

## 10. Future Extensibility (Phase 2+)

### Swapping the Frontend (React → Vue / Svelte)

1. Replace `renderer/` with the new framework.
2. Implement `window.electronAPI` calls using the same `IElectronAPI` interface.
3. Zero changes to `core/` or `main/`.

### Swapping Python Communication (Child Process → REST API)

```typescript
// Option A (current): local child process
container.register('FFmpegAdapter', () =>
  new PythonFFmpegAdapter(spawner, config), true);

// Option B (Phase 3+): remote HTTP API
container.register('FFmpegAdapter', () =>
  new HttpFFmpegAdapter('https://api.example.com', authToken), true);
```

### Swapping Storage (Local → Cloud)

```typescript
// Option A (current): local file system
container.register('VideoRepository', () =>
  new FileSystemVideoRepository(config), true);

// Option B (future): S3 storage
container.register('VideoRepository', () =>
  new S3VideoRepository(s3Client, bucketName), true);
```

### Adding a New Processing Strategy

1. Create `core/strategies/GpuAcceleratedStrategy.ts` implementing `IVideoProcessingStrategy`.
2. Register in the container:
   ```typescript
   container.register('MergeStrategy', () =>
     new GpuAcceleratedStrategy(ffmpegAdapter), true);
   ```
3. No changes to `VideoProcessingService` or any other class.

---

## 11. Definition of Done

A feature is considered **done** when all of the following are true:

| Criterion | How Verified |
|---|---|
| Implements stated acceptance criteria | Manual smoke test |
| All existing tests still pass | `npm test && pytest` in CI |
| New logic has unit tests | Coverage report in CI |
| No new ESLint / flake8 violations | Lint step in CI |
| No new TypeScript compiler errors | `tsc --noEmit` in CI |
| Code follows DI pattern (no `new` in services) | PR review |
| No cross-layer imports violated | ESLint `no-restricted-imports` rule |
| Updated in relevant docs if interfaces changed | PR checklist |

---

*This plan is a living document. Update it as decisions are made, milestones are completed, or requirements change.*
