import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { container } from '../core/container';
import { PythonFFmpegAdapter } from '../core/adapters/PythonFFmpegAdapter';
import { NodeProcessSpawner } from '../core/adapters/NodeProcessSpawner';
import { FileSystemVideoRepository } from '../core/repositories/FileSystemVideoRepository';
import { FFmpegProcessingStrategy } from '../core/strategies/VideoProcessingStrategies';
import { VideoProcessingService } from '../core/services/VideoProcessingService';
import { MergeVideosCommand } from '../core/commands/MergeVideosCommand';
import {
  IVideoProcessingService,
  IVideoMergeOptions,
  IAppConfig,
  IProcessingObserver,
  IProcessingEvent,
} from '../core/interfaces/IVideoProcessing';

let mainWindow: BrowserWindow | null = null;

/**
 * Application configuration
 * Injected into services for framework-agnostic design
 */
const appConfig: IAppConfig = {
  pythonPath: 'python',
  pythonScriptPath: path.join(
    __dirname,
    '../../src/videomerger/video_processor_cli.py'
  ),
  supportedFormats: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
};

/**
 * Setup dependency injection container
 * Demonstrates how all dependencies are injected, not hardcoded
 */
function setupDependencies(): void {
  container.register('AppConfig', () => appConfig, true);

  container.register('ProcessSpawner', () => new NodeProcessSpawner(), true);

  container.register('FFmpegAdapter', () => {
    const spawner = container.resolve<NodeProcessSpawner>('ProcessSpawner');
    const config = container.resolve<IAppConfig>('AppConfig');
    return new PythonFFmpegAdapter(spawner, config);
  }, true);

  container.register('VideoRepository', () => {
    const config = container.resolve<IAppConfig>('AppConfig');
    return new FileSystemVideoRepository(config);
  }, true);

  container.register('VideoProcessingStrategy', () => {
    const adapter = container.resolve<PythonFFmpegAdapter>('FFmpegAdapter');
    return new FFmpegProcessingStrategy(adapter);
  });

  container.register('VideoProcessingService', () => {
    const repository = container.resolve<FileSystemVideoRepository>('VideoRepository');
    const strategy = container.resolve<FFmpegProcessingStrategy>('VideoProcessingStrategy');
    return new VideoProcessingService(repository, strategy);
  }, true);
}

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Video Merger',
    backgroundColor: '#1e1e1e',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Observer for processing events
 * Forwards events to renderer process via IPC
 */
class IPCProcessingObserver implements IProcessingObserver {
  onEvent(event: IProcessingEvent): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('processing-event', event);
    }
  }
}

/**
 * Setup IPC handlers for communication with renderer
 * This is the IPC abstraction layer
 */
function setupIPC(): void {
  const observer = new IPCProcessingObserver();
  const service = container.resolve<IVideoProcessingService>('VideoProcessingService');
  service.subscribe(observer);

  ipcMain.handle('select-video-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Videos', extensions: appConfig.supportedFormats },
      ],
    });
    return result.filePaths;
  });

  ipcMain.handle('select-save-location', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'merged_video.mp4',
      filters: [{ name: 'Videos', extensions: ['mp4'] }],
    });
    return result.filePath;
  });

  ipcMain.handle('validate-videos', async (event, paths: string[]) => {
    return await service.validateVideos(paths);
  });

  ipcMain.handle('get-video-info', async (event, path: string) => {
    return await service.getVideoInfo(path);
  });

  ipcMain.handle('merge-videos', async (event, options: IVideoMergeOptions) => {
    const ffmpegAdapter = container.resolve<PythonFFmpegAdapter>('FFmpegAdapter');
    const repository = container.resolve<FileSystemVideoRepository>('VideoRepository');
    const command = new MergeVideosCommand(options, ffmpegAdapter, repository);
    return await command.execute();
  });

  ipcMain.handle('check-ffmpeg', async () => {
    const adapter = container.resolve<PythonFFmpegAdapter>('FFmpegAdapter');
    const available = await adapter.isAvailable();
    const version = available ? await adapter.getVersion() : 'not found';
    return { available, version };
  });
}

app.whenReady().then(() => {
  setupDependencies();
  createWindow();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  container.clear();
});
