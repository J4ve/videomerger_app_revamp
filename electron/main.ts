import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { container } from '../core/container';
import { PythonFFmpegAdapter } from '../core/adapters/PythonFFmpegAdapter';
import { FileSystemVideoRepository } from '../core/repositories/FileSystemVideoRepository';
import { FFmpegProcessingStrategy } from '../core/strategies/VideoProcessingStrategies';
import { VideoProcessingService } from '../core/services/VideoProcessingService';
import { MergeVideosCommand } from '../core/commands/MergeVideosCommand';
import {
  IVideoProcessingService,
  IVideoMergeOptions,
} from '../core/interfaces/IVideoProcessing';

let mainWindow: BrowserWindow | null = null;

function setupDependencies(): void {
  container.register(
    'FFmpegAdapter',
    () => new PythonFFmpegAdapter(),
    true
  );

  container.register(
    'VideoRepository',
    () => new FileSystemVideoRepository(),
    true
  );

  container.register('VideoProcessingStrategy', () => {
    const adapter = container.resolve<PythonFFmpegAdapter>('FFmpegAdapter');
    return new FFmpegProcessingStrategy(adapter);
  });

  container.register('VideoProcessingService', () => {
    const repository = container.resolve<FileSystemVideoRepository>('VideoRepository');
    const strategy = container.resolve<FFmpegProcessingStrategy>('VideoProcessingStrategy');
    return new VideoProcessingService(repository, strategy);
  });
}

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

function setupIPC(): void {
  ipcMain.handle('select-video-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
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
    const service = container.resolve<IVideoProcessingService>('VideoProcessingService');
    return await service.validateVideos(paths);
  });

  ipcMain.handle('get-video-info', async (event, path: string) => {
    const service = container.resolve<IVideoProcessingService>('VideoProcessingService');
    return await service.getVideoInfo(path);
  });

  ipcMain.handle('merge-videos', async (event, options: IVideoMergeOptions) => {
    const service = container.resolve<IVideoProcessingService>('VideoProcessingService');
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
