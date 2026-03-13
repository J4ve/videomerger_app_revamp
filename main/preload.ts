import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFiles: () => ipcRenderer.invoke('select-video-files'),
  selectSaveLocation: () => ipcRenderer.invoke('select-save-location'),
  validateVideos: (paths: string[]) => ipcRenderer.invoke('validate-videos', paths),
  getVideoInfo: (path: string) => ipcRenderer.invoke('get-video-info', path),
  mergeVideos: (options: any) => ipcRenderer.invoke('merge-videos', options),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  onProcessingEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('processing-event', (_event, data) => callback(data));
  },
});
