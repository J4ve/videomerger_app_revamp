import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFiles: () => ipcRenderer.invoke('select-video-files'),
  selectSaveLocation: () => ipcRenderer.invoke('select-save-location'),
  validateVideos: (paths: string[]) => ipcRenderer.invoke('validate-videos', paths),
  getVideoInfo: (path: string) => ipcRenderer.invoke('get-video-info', path),
  getArrangeVideoMetadata: (paths: string[]) => ipcRenderer.invoke('get-arrange-video-metadata', paths),
  mergeVideos: (options: any) => ipcRenderer.invoke('merge-videos', options),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  checkFFmpegDetails: () => ipcRenderer.invoke('check-ffmpeg-details'),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  googleOAuthLogin: () => ipcRenderer.invoke('google-oauth-login'),
  googleOAuthLogout: () => ipcRenderer.invoke('google-oauth-logout'),
  getGoogleAuthStatus: () => ipcRenderer.invoke('google-auth-status'),
  uploadToYouTube: (options: any) => ipcRenderer.invoke('upload-to-youtube', options),
  onProcessingEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('processing-event', (_event, data) => callback(data));
  },
});
