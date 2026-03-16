import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { execFile, execSync } from 'child_process';
import Store from 'electron-store';
import { container } from '../core/container';
import { PythonFFmpegAdapter } from '../core/adapters/PythonFFmpegAdapter';
import { NodeProcessSpawner } from '../core/adapters/NodeProcessSpawner';
import { FileSystemVideoRepository } from '../core/repositories/FileSystemVideoRepository';
import { FFmpegProcessingStrategy } from '../core/strategies/VideoProcessingStrategies';
import { VideoProcessingService } from '../core/services/VideoProcessingService';
import { MergeVideosCommand } from '../core/commands/MergeVideosCommand';
import { getGoogleOAuthConfig } from './oauthConfig';
import {
  IVideoProcessingService,
  IVideoMergeOptions,
  IAppConfig,
  IProcessingObserver,
  IProcessingEvent,
} from '../core/interfaces/IVideoProcessing';

let mainWindow: BrowserWindow | null = null;
const store = new Store();

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
      // Forward byte-range requests so HTML5 video seeking/switching remains stable.
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        return net.fetch(fileUrl, {
          headers: {
            range: rangeHeader,
          },
        });
      }

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
    const cmd = process.platform === 'win32' ? 'where ffmpeg 2>nul' : 'which ffmpeg 2>/dev/null';
    const result = execSync(cmd, { encoding: 'utf-8' }).trim();
    return result.split('\n')[0].trim();
  } catch {
    return null;
  }
}

function getFFprobeSystemPath(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where ffprobe 2>nul' : 'which ffprobe 2>/dev/null';
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

function resolveAppIconPath(): string | undefined {
  const ext = process.platform === 'win32' ? '.ico' : '.png';
  const fallbackExt = process.platform === 'win32' ? '.png' : '.ico';
  const candidates = [
    path.join(process.resourcesPath || '', `icon${ext}`),
    path.join(process.resourcesPath || '', `icon${fallbackExt}`),
    path.join(process.resourcesPath || '', 'resources', `icon${ext}`),
    path.join(process.resourcesPath || '', 'resources', `icon${fallbackExt}`),
    path.join(__dirname, '../../resources', `icon${ext}`),
    path.join(__dirname, '../../resources', `icon${fallbackExt}`),
  ];

  return candidates.find((candidate) => !!candidate && fs.existsSync(candidate));
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

function getVideoStreamInfo(filePath: string): Promise<{
  width: number | null;
  height: number | null;
  fps: number | null;
}> {
  return new Promise((resolve) => {
    const ffprobePath = getBundledFFprobePath() || getFFprobeSystemPath() || 'ffprobe';
    execFile(
      ffprobePath,
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate',
        '-of', 'json',
        filePath,
      ],
      { timeout: 15000 },
      (error, stdout) => {
        if (error) {
          resolve({ width: null, height: null, fps: null });
          return;
        }

        try {
          const parsed = JSON.parse(stdout || '{}');
          const stream = Array.isArray(parsed?.streams) ? parsed.streams[0] : null;
          const width = Number.isFinite(Number(stream?.width)) ? Number(stream.width) : null;
          const height = Number.isFinite(Number(stream?.height)) ? Number(stream.height) : null;

          let fps: number | null = null;
          const rate = typeof stream?.r_frame_rate === 'string' ? stream.r_frame_rate : '';
          if (rate.includes('/')) {
            const [numStr, denStr] = rate.split('/');
            const num = Number(numStr);
            const den = Number(denStr);
            if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
              const value = num / den;
              fps = Number.isFinite(value) ? value : null;
            }
          }

          resolve({ width, height, fps });
        } catch {
          resolve({ width: null, height: null, fps: null });
        }
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
  
  // Resolve Python script path
  let pythonScriptPath = path.join(__dirname, '../../src/videomerger/video_processor_cli.py');
  
  // In packaged app, check for the script in resources or unpacked asar
  const packagedScriptPath = path.join(process.resourcesPath || '', 'video_processor_cli.py');
  const unpackedScriptPath = pythonScriptPath.replace('app.asar', 'app.asar.unpacked');
  
  if (fs.existsSync(packagedScriptPath)) {
    pythonScriptPath = packagedScriptPath;
    console.log('[DEBUG] Using packaged Python script:', pythonScriptPath);
  } else if (fs.existsSync(unpackedScriptPath)) {
    pythonScriptPath = unpackedScriptPath;
    console.log('[DEBUG] Using unpacked ASAR Python script:', pythonScriptPath);
  } else {
    console.log('[DEBUG] Using development Python script:', pythonScriptPath);
  }

  console.log('[DEBUG] FFmpeg Bundled Path:', bundledPath);
  console.log('[DEBUG] Resources Path:', process.resourcesPath);

  return {
    pythonPath: 'python',
    pythonScriptPath,
    supportedFormats: [
      'mp4', 'mov', 'avi', 'mkv', 'webm',
      'm4v', 'mpg', 'mpeg', 'ts', 'm2ts',
      'flv', 'wmv', '3gp', 'ogv', 'vob', 'mxf',
    ],
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
  const appIconPath = resolveAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)',
      symbolColor: '#747474',
      height: 44
    },
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '',
    backgroundColor: '#1e1e1e',
    icon: appIconPath,
  });

  mainWindow.setMenuBarVisibility(false);

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
  const config = getGoogleOAuthConfig();

  return new Promise((resolve, reject) => {
    const postData = new url.URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const req = https.request(config.tokenUrl, {
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

function fetchGoogleApiJson(apiPath: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: apiPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (res.statusCode && res.statusCode >= 400) {
            const message = parsed?.error?.message || `Google API error (${res.statusCode})`;
            reject(new Error(message));
            return;
          }
          resolve(parsed);
        } catch {
          reject(new Error('Failed to parse Google API response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getYouTubeAccountSummary(accessToken: string): Promise<any> {
  const channelData = await fetchGoogleApiJson(
    '/youtube/v3/channels?part=snippet&mine=true',
    accessToken
  );

  const channel = channelData?.items?.[0];
  if (!channel) {
    return {
      channel: null,
      recentVideos: [],
    };
  }

  const channelId = channel?.id;
  const customUrl = channel?.snippet?.customUrl as string | undefined;
  const channelUrl = customUrl
    ? `https://www.youtube.com/${customUrl.startsWith('@') ? customUrl : `@${customUrl}`}`
    : `https://www.youtube.com/channel/${channelId}`;

  let recentVideos: any[] = [];
  try {
    const searchData = await fetchGoogleApiJson(
      '/youtube/v3/search?part=snippet&forMine=true&type=video&order=date&maxResults=6',
      accessToken
    );

    recentVideos = (searchData?.items || []).map((item: any) => {
      const videoId = item?.id?.videoId;
      return {
        id: videoId,
        title: item?.snippet?.title || 'Untitled video',
        publishedAt: item?.snippet?.publishedAt || null,
        thumbnailUrl:
          item?.snippet?.thumbnails?.medium?.url ||
          item?.snippet?.thumbnails?.default?.url ||
          null,
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      };
    }).filter((video: any) => Boolean(video?.id));
  } catch {
    // Keep summary available even if recent videos cannot be fetched for this token.
    recentVideos = [];
  }

  return {
    channel: {
      id: channelId,
      title: channel?.snippet?.title || 'Your Channel',
      url: channelUrl,
      thumbnailUrl:
        channel?.snippet?.thumbnails?.default?.url ||
        channel?.snippet?.thumbnails?.medium?.url ||
        null,
    },
    recentVideos,
  };
}

/**
 * Upload a video to YouTube using the YouTube Data API v3
 */
function uploadVideoToYouTube(
  accessToken: string,
  filePath: string,
  title: string,
  description: string,
  privacy: string,
  options?: {
    categoryId?: string;
    tags?: string[];
    defaultLanguage?: string;
    madeForKids?: boolean;
    notifySubscribers?: boolean;
    license?: 'youtube' | 'creativeCommon';
    embeddable?: boolean;
    publicStatsViewable?: boolean;
  }
): Promise<any> {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(filePath).size;
    const categoryId = (options?.categoryId || '22').trim() || '22';
    const tags = Array.isArray(options?.tags) ? options.tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [];
    const defaultLanguage = typeof options?.defaultLanguage === 'string' ? options.defaultLanguage.trim() : '';
    const notifySubscribers = options?.notifySubscribers !== false;
    const metadata = JSON.stringify({
      snippet: {
        title,
        description,
        categoryId,
        ...(tags.length > 0 ? { tags } : {}),
        ...(defaultLanguage ? { defaultLanguage } : {}),
      },
      status: {
        privacyStatus: privacy,
        ...(typeof options?.madeForKids === 'boolean' ? { selfDeclaredMadeForKids: options.madeForKids } : {}),
        ...(options?.license ? { license: options.license } : {}),
        ...(typeof options?.embeddable === 'boolean' ? { embeddable: options.embeddable } : {}),
        ...(typeof options?.publicStatsViewable === 'boolean' ? { publicStatsViewable: options.publicStatsViewable } : {}),
      },
    });

    const notifySubscribersParam = notifySubscribers ? 'true' : 'false';

    // Step 1: Initiate resumable upload
    const initReq = https.request({
      hostname: 'www.googleapis.com',
      path: `/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${notifySubscribersParam}`,
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

  ipcMain.handle('select-save-location', async (event, initialDirectory?: string) => {
    const defaultFileName = `merged_video_${Date.now()}.mp4`;
    const defaultPath = initialDirectory
      ? path.join(initialDirectory, defaultFileName)
      : defaultFileName;
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'Videos', extensions: ['mp4'] }],
    });
    return result.filePath;
  });

  ipcMain.handle('select-output-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }
    return result.filePaths[0];
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
        const [stats, duration, streamInfo] = await Promise.all([
          fs.promises.stat(filePath),
          getVideoDurationSeconds(filePath),
          getVideoStreamInfo(filePath),
        ]);
        return [filePath, {
          duration,
          modifiedMs: stats.mtimeMs,
          size: stats.size,
          width: streamInfo.width,
          height: streamInfo.height,
          fps: streamInfo.fps,
        }];
      } catch {
        return [filePath, {
          duration: null,
          modifiedMs: null,
          size: null,
          width: null,
          height: null,
          fps: null,
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

  ipcMain.handle('open-external', async (event, targetUrl: string) => {
    await shell.openExternal(targetUrl);
    return true;
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

  ipcMain.handle('export-preset-pack', async (event, presetPack: any) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `videomerger_preset_pack_${Date.now()}.json`,
      filters: [{ name: 'Preset Packs', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      await fs.promises.writeFile(result.filePath, JSON.stringify(presetPack, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-preset-pack', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Preset Packs', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    try {
      const content = await fs.promises.readFile(result.filePaths[0], 'utf-8');
      const parsed = JSON.parse(content);
      return { success: true, data: parsed, path: result.filePaths[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- Google OAuth2 handlers ---

  ipcMain.handle('google-oauth-login', async () => {
    console.log('[Auth][Main] google-oauth-login invoked');
    let config;
    try {
      config = getGoogleOAuthConfig();
    } catch (err: any) {
      console.error('[Auth][Main] OAuth config error:', err?.message || err);
      return { success: false, error: err?.message || 'Google OAuth not configured.' };
    }

    return new Promise((resolve, reject) => {
      console.log('[Auth][Main] Starting OAuth flow', {
        redirectUri: config.redirectUri,
        hasClientId: Boolean(config.clientId),
        hasClientSecret: Boolean(config.clientSecret),
      });
      const authUrl = `${config.authUrl}?` +
        `client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(config.scopes.join(' '))}` +
        `&access_type=offline` +
        `&prompt=consent`;

      // Create a local HTTP server to catch the redirect
      const server = http.createServer(async (req, res) => {
        try {
          console.log('[Auth][Main] OAuth callback received:', req.url || '/');
          const reqUrl = new url.URL(req.url || '', `http://localhost:8976`);
          const code = reqUrl.searchParams.get('code');

          if (code) {
            console.log('[Auth][Main] Authorization code received; exchanging for tokens');
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
            console.error('[Auth][Main] OAuth callback without code');
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Login failed. Please try again.</h2></body></html>');
            server.close();
            authWindow?.close();
            resolve({ success: false, error: 'No authorization code received' });
          }
        } catch (err: any) {
          console.error('[Auth][Main] OAuth callback handler error:', err?.message || err);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Login error. Please try again.</h2></body></html>');
          server.close();
          authWindow?.close();
          resolve({ success: false, error: err.message });
        }
      });

      server.listen(8976, () => {
        console.log('[Auth][Main] OAuth callback server listening on http://localhost:8976');
      });

      // Open OAuth2 popup
      let authWindow: BrowserWindow | null = new BrowserWindow({
        width: 600,
        height: 700,
        parent: mainWindow || undefined,
        modal: true,
        autoHideMenuBar: true,
        icon: resolveAppIconPath(),
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      authWindow.setMenuBarVisibility(false);

      authWindow.loadURL(authUrl);
      authWindow.on('closed', () => {
        console.log('[Auth][Main] OAuth window closed by user');
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
    categoryId?: string;
    tags?: string[];
    defaultLanguage?: string;
    madeForKids?: boolean;
    notifySubscribers?: boolean;
    license?: 'youtube' | 'creativeCommon';
    embeddable?: boolean;
    publicStatsViewable?: boolean;
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
        options.privacy || 'private',
        {
          categoryId: options.categoryId,
          tags: options.tags,
          defaultLanguage: options.defaultLanguage,
          madeForKids: options.madeForKids,
          notifySubscribers: options.notifySubscribers,
          license: options.license,
          embeddable: options.embeddable,
          publicStatsViewable: options.publicStatsViewable,
        }
      );
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('youtube-account-summary', async () => {
    const auth = store.get('googleAuth') as any;
    if (!auth || !auth.accessToken) {
      return { success: false, error: 'Not authenticated with Google' };
    }

    try {
      const summary = await getYouTubeAccountSummary(auth.accessToken);
      return { success: true, ...summary };
    } catch (err: any) {
      const rawMessage = String(err?.message || 'Failed to load YouTube account details');
      const needsReauth = /scope|insufficient|permission|forbidden|unauthorized|invalid credentials/i.test(rawMessage);
      const friendlyMessage = needsReauth
        ? 'YouTube details need refreshed Google permissions. Please sign out and sign in again.'
        : rawMessage;
      return { success: false, error: friendlyMessage, needsReauth };
    }
  });

  ipcMain.handle('youtube-online-presets-save', async (event, payload: {
    defaults: Record<string, any>;
    presets: Array<Record<string, any>>;
  }) => {
    const auth = store.get('googleAuth') as any;
    const userEmail = String(auth?.user?.email || '').trim().toLowerCase();
    if (!auth || !auth.accessToken || !userEmail) {
      return { success: false, error: 'Not authenticated with Google' };
    }

    const existing = (store.get('youtubeOnlinePresetsByUser') as Record<string, any>) || {};
    existing[userEmail] = {
      userEmail,
      updatedAt: new Date().toISOString(),
      defaults: payload?.defaults || {},
      presets: Array.isArray(payload?.presets) ? payload.presets : [],
    };
    store.set('youtubeOnlinePresetsByUser', existing);
    return { success: true, updatedAt: existing[userEmail].updatedAt };
  });

  ipcMain.handle('youtube-online-presets-load', async () => {
    const auth = store.get('googleAuth') as any;
    const userEmail = String(auth?.user?.email || '').trim().toLowerCase();
    if (!auth || !auth.accessToken || !userEmail) {
      return { success: false, error: 'Not authenticated with Google' };
    }

    const existing = (store.get('youtubeOnlinePresetsByUser') as Record<string, any>) || {};
    const accountData = existing[userEmail];
    if (!accountData) {
      return {
        success: true,
        defaults: {},
        presets: [],
        updatedAt: null,
      };
    }

    return {
      success: true,
      defaults: accountData.defaults || {},
      presets: Array.isArray(accountData.presets) ? accountData.presets : [],
      updatedAt: accountData.updatedAt || null,
    };
  });
}

app.whenReady().then(() => {
  console.log('App ready, initializing...');
  registerLocalVideoProtocol();
  setupDependencies();
  console.log('Dependencies setup, creating window...');
  createWindow();
  setupIPC();
  console.log('IPC setup complete.');

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
