import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFiles: () => ipcRenderer.invoke('select-video-files'),
  selectSaveLocation: (initialDirectory?: string) => ipcRenderer.invoke('select-save-location', initialDirectory),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  validateVideos: (paths: string[]) => ipcRenderer.invoke('validate-videos', paths),
  getVideoInfo: (path: string) => ipcRenderer.invoke('get-video-info', path),
  getArrangeVideoMetadata: (paths: string[]) => ipcRenderer.invoke('get-arrange-video-metadata', paths),
  mergeVideos: (options: any) => ipcRenderer.invoke('merge-videos', options),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  checkFFmpegDetails: () => ipcRenderer.invoke('check-ffmpeg-details'),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  exportPresetPack: (presetPack: any) => ipcRenderer.invoke('export-preset-pack', presetPack),
  importPresetPack: () => ipcRenderer.invoke('import-preset-pack'),
  googleOAuthLogin: () => ipcRenderer.invoke('google-oauth-login'),
  googleOAuthLogout: () => ipcRenderer.invoke('google-oauth-logout'),
  getGoogleAuthStatus: () => ipcRenderer.invoke('google-auth-status'),
  getYouTubeAccountSummary: () => ipcRenderer.invoke('youtube-account-summary'),
  uploadToYouTube: (options: any) => ipcRenderer.invoke('upload-to-youtube', options),
  onProcessingEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('processing-event', (_event, data) => callback(data));
  },
});
