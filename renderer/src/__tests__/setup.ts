import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock window.electronAPI for all tests
const mockElectronAPI = {
  selectVideoFiles: vi.fn().mockResolvedValue([]),
  selectSaveLocation: vi.fn().mockResolvedValue(undefined),
  validateVideos: vi.fn().mockResolvedValue(true),
  getVideoInfo: vi.fn().mockResolvedValue({}),
  mergeVideos: vi.fn().mockResolvedValue({ success: true, outputPath: 'C:\\output.mp4' }),
  checkFFmpeg: vi.fn().mockResolvedValue({ available: true, version: '6.0' }),
  checkFFmpegDetails: vi.fn().mockResolvedValue({
    available: true,
    version: '6.0',
    path: 'C:\\ffmpeg\\ffmpeg.exe',
    isBundled: false,
  }),
  openFolder: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ maxFileSizeMb: 500 }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  googleOAuthLogin: vi.fn().mockResolvedValue({ success: true, user: { name: 'Test User', email: 'test@mail.com' } }),
  googleOAuthLogout: vi.fn().mockResolvedValue({ success: true }),
  getGoogleAuthStatus: vi.fn().mockResolvedValue({ isLoggedIn: false }),
  uploadToYouTube: vi.fn().mockResolvedValue({ success: true, videoId: 'abc123', url: 'https://youtube.com/watch?v=abc123' }),
  onProcessingEvent: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});

export { mockElectronAPI };
