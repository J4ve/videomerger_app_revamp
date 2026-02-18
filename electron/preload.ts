import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFiles: () => ipcRenderer.invoke('select-video-files'),
  selectSaveLocation: () => ipcRenderer.invoke('select-save-location'),
  validateVideos: (paths: string[]) => ipcRenderer.invoke('validate-videos', paths),
  getVideoInfo: (path: string) => ipcRenderer.invoke('get-video-info', path),
  mergeVideos: (options: any) => ipcRenderer.invoke('merge-videos', options),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
});
