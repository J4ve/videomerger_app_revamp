# Video Merger Desktop Application

Desktop application for merging multiple videos using Electron + React + Python.

## Architecture

This application implements several design patterns for clean, maintainable code:

- **Dependency Injection**: Uses a DI container for service management
- **Repository Pattern**: Abstracts data access for video files
- **Command Pattern**: Encapsulates video processing operations
- **Adapter Pattern**: Integrates Python FFmpeg processing
- **Strategy Pattern**: Allows different processing strategies

## Tech Stack

- **Frontend**: React + TypeScript
- **Desktop**: Electron
- **Video Processing**: Python + FFmpeg
- **Build**: Webpack + TypeScript Compiler

## Prerequisites

- Node.js 18+
- Python 3.8+
- FFmpeg installed on system

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Ensure FFmpeg is installed:
```bash
ffmpeg -version
```

## Development

Run in development mode:
```bash
npm run dev
```

This starts both the React dev server and Electron.

## Building

Build the application:
```bash
npm run build
```

Run the built application:
```bash
npm start
```

## Project Structure

```
.
├── core/                    # Framework-agnostic core logic
│   ├── interfaces/          # TypeScript interfaces
│   ├── adapters/            # Adapter pattern implementations
│   ├── commands/            # Command pattern implementations
│   ├── repositories/        # Repository pattern implementations
│   ├── services/            # Business logic services
│   ├── strategies/          # Strategy pattern implementations
│   └── container.ts         # Dependency injection container
├── electron/                # Electron main process
│   ├── main.ts              # Main process entry
│   └── preload.ts           # Preload script for IPC
├── frontend/                # React frontend
│   ├── App.tsx              # Main React component
│   ├── index.tsx            # React entry point
│   └── styles.css           # Application styles
├── src/videomerger/         # Python backend
│   └── video_processor_cli.py  # FFmpeg CLI wrapper
└── package.json             # Node.js dependencies
```

## How It Works

1. **Electron Main Process** manages the application window and spawns Python child processes
2. **React Frontend** runs in the Electron renderer, providing the UI
3. **Python CLI** handles FFmpeg operations locally on the user's machine
4. **IPC Bridge** connects React to Electron main process using contextBridge
5. **Core Logic** is framework-agnostic and uses design patterns for flexibility

## Future Extensibility

The core architecture is designed to be reusable for web APIs (FastAPI/Flask) for mobile and other platforms. The business logic is decoupled from Electron, making it portable.
