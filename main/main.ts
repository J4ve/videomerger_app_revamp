import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { execFile, execSync } from 'child_process';
import Store = require('electron-store');
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
const store = new Store();

// Google OAuth2 configuration
const GOOGLE_OAUTH_CONFIG = {
  clientId: '133055670342-8u9o8ubglh1qqgnpheptqhimj5kl4ddn.apps.googleusercontent.com',
  clientSecret: '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',
  redirectUri: 'http://localhost:8976/oauth2callback',
  authUrl: 'https://accounts.google.com/o/oauth2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

if (
  process.platform === 'win32' &&
  process.env.VIDEOMERGER_FORCE_SOFTWARE_RENDERING !== '0'
) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

function registerLocalVideoProtocol(): void {
  protocol.handle('local-video', async (request) => {
    try {
      const reqUrl = new url.URL(request.url);
      const encodedPath = reqUrl.searchParams.get('path');
      if (!encodedPath) {
        return new Response('Missing path parameter', { status: 400 });
      }

      const filePath = decodeURIComponent(encodedPath);
      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      const fileUrl = url.pathToFileURL(filePath).toString();
      return net.fetch(fileUrl);
    } catch {
      return new Response('Invalid local video request', { status: 400 });
    }
  });
}

/**
 * Get the path to bundled FFmpeg binary
 * Checks resources/ffmpeg/ directory first (for packaged app)
 * Falls back to system PATH
 */
function getBundledFFmpegPath(): string | null {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const possiblePaths = [
    // In packaged app (asar unpacked)
    path.join(process.resourcesPath || '', 'ffmpeg', `ffmpeg${ext}`),
    // In development
    path.join(__dirname, '../../resources/ffmpeg', `ffmpeg${ext}`),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Detect FFmpeg installation path on the system
 */
function getFFmpegSystemPath(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const result = execSync(cmd, { encoding: 'utf-8' }).trim();
    return result.split('\n')[0].trim();
  } catch {
    return null;
  }
}

function getFFprobeSystemPath(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where ffprobe' : 'which ffprobe';
    const result = execSync(cmd, { encoding: 'utf-8' }).trim();
    return result.split('\n')[0].trim();
  } catch {
    return null;
  }
}

function getBundledFFprobePath(): string | null {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const possiblePaths = [
    path.join(process.resourcesPath || '', 'ffmpeg', `ffprobe${ext}`),
    path.join(__dirname, '../../resources/ffmpeg', `ffprobe${ext}`),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function getVideoDurationSeconds(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ffprobePath = getBundledFFprobePath() || getFFprobeSystemPath() || 'ffprobe';
    execFile(
      ffprobePath,
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 15000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const duration = Number.parseFloat((stdout || '').trim());
        if (Number.isFinite(duration)) {
          resolve(duration);
          return;
        }
        resolve(null);
      }
    );
  });
}

/**
 * Application configuration
 * Injected into services for framework-agnostic design
 */
function getAppConfig(): IAppConfig {
  const bundledPath = getBundledFFmpegPath();
  return {
    pythonPath: 'python',
    pythonScriptPath: path.join(__dirname, '../../src/videomerger/video_processor_cli.py'),
    supportedFormats: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
    maxFileSizeMb: store.get('maxFileSizeMb', 500) as number,
    ...(bundledPath ? { ffmpegPath: bundledPath } : {}),
  };
}

/**
 * Setup dependency injection container
 * Demonstrates how all dependencies are injected, not hardcoded
 */
function setupDependencies(): void {
  const config = getAppConfig();
  container.register('AppConfig', () => config, true);

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
 * Perform Google OAuth2 token exchange
 */
function exchangeCodeForTokens(code: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = new url.URLSearchParams({
      code,
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const req = https.request(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse token response'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Fetch Google user profile info
 */
function fetchGoogleUserInfo(accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse user info'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Upload a video to YouTube using the YouTube Data API v3
 */
function uploadVideoToYouTube(
  accessToken: string,
  filePath: string,
  title: string,
  description: string,
  privacy: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(filePath).size;
    const metadata = JSON.stringify({
      snippet: { title, description, categoryId: '22' },
      status: { privacyStatus: privacy },
    });

    // Step 1: Initiate resumable upload
    const initReq = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': fileSize.toString(),
        'X-Upload-Content-Type': 'video/*',
        'Content-Length': Buffer.byteLength(metadata),
      },
    }, (initRes) => {
      const uploadUrl = initRes.headers['location'];
      if (!uploadUrl) {
        let errData = '';
        initRes.on('data', (c) => { errData += c; });
        initRes.on('end', () => reject(new Error(`Upload init failed: ${errData}`)));
        return;
      }

      // Step 2: Upload the file
      const parsed = new url.URL(uploadUrl);
      const uploadReq = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/*',
        },
      }, (uploadRes) => {
        let data = '';
        uploadRes.on('data', (chunk) => { data += chunk; });
        uploadRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({
              success: true,
              videoId: result.id,
              url: `https://www.youtube.com/watch?v=${result.id}`,
            });
          } catch (e) {
            reject(new Error(`Upload response parse failed: ${data}`));
          }
        });
      });
      uploadReq.on('error', reject);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(uploadReq);
    });
    initReq.on('error', reject);
    initReq.write(metadata);
    initReq.end();
  });
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
    const config = getAppConfig();
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Videos', extensions: config.supportedFormats },
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

  ipcMain.handle('get-arrange-video-metadata', async (event, paths: string[]) => {
    const uniquePaths = Array.from(new Set((paths || []).filter(Boolean)));
    const entries = await Promise.all(uniquePaths.map(async (filePath) => {
      try {
        const stats = await fs.promises.stat(filePath);
        const duration = await getVideoDurationSeconds(filePath);
        return [filePath, {
          duration,
          modifiedMs: stats.mtimeMs,
          size: stats.size,
        }];
      } catch {
        return [filePath, {
          duration: null,
          modifiedMs: null,
          size: null,
        }];
      }
    }));
    return Object.fromEntries(entries);
  });

  ipcMain.handle('merge-videos', async (event, options: IVideoMergeOptions) => {
    return await service.mergeVideos(options);
  });

  ipcMain.handle('check-ffmpeg', async () => {
    const adapter = container.resolve<PythonFFmpegAdapter>('FFmpegAdapter');
    const available = await adapter.isAvailable();
    const version = available ? await adapter.getVersion() : 'not found';
    return { available, version };
  });

  // Enhanced FFmpeg details for the indicator dialog
  ipcMain.handle('check-ffmpeg-details', async () => {
    const adapter = container.resolve<PythonFFmpegAdapter>('FFmpegAdapter');
    const available = await adapter.isAvailable();
    const version = available ? await adapter.getVersion() : 'not found';
    const bundledPath = getBundledFFmpegPath();
    const systemPath = getFFmpegSystemPath();
    return {
      available,
      version,
      path: bundledPath || systemPath || 'Not found',
      isBundled: !!bundledPath,
    };
  });

  ipcMain.handle('open-folder', async (event, folderPath: string) => {
    await shell.showItemInFolder(folderPath);
  });

  ipcMain.handle('get-settings', async () => {
    return store.store;
  });

  ipcMain.handle('save-settings', async (event, settings: any) => {
    store.set(settings);
    // Re-initialize DI container to pick up new config
    container.clear();
    setupDependencies();
    return true;
  });

  // --- Google OAuth2 handlers ---

  ipcMain.handle('google-oauth-login', async () => {
    return new Promise((resolve, reject) => {
      const authUrl = `${GOOGLE_OAUTH_CONFIG.authUrl}?` +
        `client_id=${encodeURIComponent(GOOGLE_OAUTH_CONFIG.clientId)}` +
        `&redirect_uri=${encodeURIComponent(GOOGLE_OAUTH_CONFIG.redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(GOOGLE_OAUTH_CONFIG.scopes.join(' '))}` +
        `&access_type=offline` +
        `&prompt=consent`;

      // Create a local HTTP server to catch the redirect
      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new url.URL(req.url || '', `http://localhost:8976`);
          const code = reqUrl.searchParams.get('code');

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Login successful! You can close this window.</h2><script>window.close();</script></body></html>');

            const tokens = await exchangeCodeForTokens(code);
            const userInfo = await fetchGoogleUserInfo(tokens.access_token);

            store.set('googleAuth', {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: Date.now() + (tokens.expires_in * 1000),
              user: {
                id: userInfo.id,
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture,
              },
            });

            server.close();
            authWindow?.close();
            resolve({
              success: true,
              user: {
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture,
              },
            });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Login failed. Please try again.</h2></body></html>');
            server.close();
            authWindow?.close();
            resolve({ success: false, error: 'No authorization code received' });
          }
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Login error. Please try again.</h2></body></html>');
          server.close();
          authWindow?.close();
          resolve({ success: false, error: err.message });
        }
      });

      server.listen(8976, () => {
        // Server ready, now open auth window
      });

      // Open OAuth2 popup
      let authWindow: BrowserWindow | null = new BrowserWindow({
        width: 600,
        height: 700,
        parent: mainWindow || undefined,
        modal: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      authWindow.loadURL(authUrl);
      authWindow.on('closed', () => {
        authWindow = null;
        server.close();
      });
    });
  });

  ipcMain.handle('google-oauth-logout', async () => {
    store.delete('googleAuth');
    return { success: true };
  });

  ipcMain.handle('google-auth-status', async () => {
    const auth = store.get('googleAuth') as any;
    if (auth && auth.accessToken) {
      return {
        isLoggedIn: true,
        user: auth.user,
      };
    }
    return { isLoggedIn: false };
  });

  // --- YouTube upload handler ---

  ipcMain.handle('upload-to-youtube', async (event, options: {
    filePath: string;
    title: string;
    description?: string;
    privacy?: string;
  }) => {
    const auth = store.get('googleAuth') as any;
    if (!auth || !auth.accessToken) {
      return { success: false, error: 'Not authenticated with Google' };
    }

    try {
      const result = await uploadVideoToYouTube(
        auth.accessToken,
        options.filePath,
        options.title,
        options.description || '',
        options.privacy || 'private'
      );
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(() => {
  registerLocalVideoProtocol();
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
