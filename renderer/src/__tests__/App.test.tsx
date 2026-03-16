import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';
import { mockElectronAPI } from './setup';

// Helper to create a mock File with a path property
function createMockFile(name: string, type: string = 'video/mp4'): File {
  const file = new File(['dummy content'], name, { type });
  Object.defineProperty(file, 'path', { value: `C:\\Videos\\${name}`, writable: false });
  return file;
}

// Helper to create a mock DataTransfer-like object
function createMockDataTransfer(files: File[]) {
  return {
    files,
    items: files.map(f => ({ kind: 'file', type: f.type, getAsFile: () => f })),
    types: ['Files'],
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not logged in
    mockElectronAPI.getGoogleAuthStatus.mockResolvedValue({ isLoggedIn: false });
    mockElectronAPI.checkFFmpegDetails.mockResolvedValue({
      available: true,
      version: '6.0',
      path: 'C:\\ffmpeg\\ffmpeg.exe',
      isBundled: false,
    });
  });

  async function skipAuth() {
    await waitFor(() => expect(screen.getByText('Continue without account')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Continue without account'));
    await waitFor(() => expect(screen.getByText('Add your videos')).toBeInTheDocument());
  }

  // ─── Auth Prompt ───

  describe('Auth Prompt (Step 0)', () => {
    it('shows the welcome/auth prompt on initial load', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument();
      });
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
      expect(screen.getByText('Continue without account')).toBeInTheDocument();
    });

    it('skips to step 1 when clicking Continue without account', async () => {
      render(<App />);
      await skipAuth();
      expect(screen.getByText('Add your videos')).toBeInTheDocument();
    });
  });

  // ─── Step 1: Add Videos ───

  describe('Add Videos (Step 1)', () => {
    it('shows visual feedback on drag over', async () => {
      render(<App />);
      await skipAuth();
      const dropzone = screen.getByTestId('dropzone');
      fireEvent.dragEnter(dropzone);
      expect(dropzone.classList.contains('dropzone-drag-over')).toBe(true);
    });

    it('accepts supported video files on drop', async () => {
      render(<App />);
      await skipAuth();
      const dropzone = screen.getByTestId('dropzone');
      const mp4File = createMockFile('video1.mp4');

      fireEvent.drop(dropzone, {
        dataTransfer: createMockDataTransfer([mp4File]),
      });

      await waitFor(() => {
        expect(screen.getByText('video1.mp4')).toBeInTheDocument();
      });
    });
  });

  // ─── Info Tab ───

  describe('Info Tab', () => {
    it('shows FFmpeg details and developer names in Settings > Info', async () => {
      render(<App />);
      await skipAuth();
      const dashBtn = document.getElementById('dashboard-btn');
      fireEvent.click(dashBtn!);
      await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Info'));
      await waitFor(() => expect(screen.getByText('App Info')).toBeInTheDocument());
      expect(screen.getByText('FFmpeg')).toBeInTheDocument();
      expect(screen.getByText(/Version:/)).toBeInTheDocument();
      expect(screen.getByText('Jave Bacsain')).toBeInTheDocument();
      expect(screen.getByText('Carl Gerald Parro')).toBeInTheDocument();
      expect(screen.getByText('Marc Justin Prestado')).toBeInTheDocument();
    });
  });

  // ─── Step 2: Arrange ───

  describe('Arrange Screen (Step 2)', () => {
    async function goToStep2() {
      mockElectronAPI.selectVideoFiles.mockResolvedValue([
        'C:\\Videos\\alpha.mp4',
        'C:\\Videos\\beta.mp4',
      ]);
      await skipAuth();
      fireEvent.click(screen.getByTestId('dropzone'));
      await waitFor(() => expect(screen.getByText('alpha.mp4')).toBeInTheDocument(), { timeout: 3000 });
      fireEvent.click(screen.getByText('Proceed'));
      await waitFor(() => expect(screen.getByText('Arrange sequence')).toBeInTheDocument());
    }

    it('duplicates a video', async () => {
      render(<App />);
      await goToStep2();
      const dupBtn = document.getElementById('dup-btn-0');
      fireEvent.click(dupBtn!);
      await waitFor(() => {
        const items = screen.getAllByText('alpha.mp4');
        expect(items.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('moves a video up', async () => {
      const { container } = render(<App />);
      await goToStep2();
      
      const betaItem = screen.getByText('beta.mp4').closest('.sequence-item');
      const upBtn = Array.from((betaItem as HTMLElement).querySelectorAll('button')).find(b => b.title === 'Move up');
      fireEvent.click(upBtn!);
      
      await waitFor(() => {
        const fileNames = Array.from(container.querySelectorAll('.sequence-list .file-name')).map(el => el.textContent);
        expect(fileNames[0]).toBe('beta.mp4');
      });
    });

    it('toggles arrangement lock', async () => {
      render(<App />);
      await goToStep2();
      const lockToggle = document.getElementById('lock-arrangement-toggle');
      fireEvent.click(lockToggle!);
      await waitFor(() => {
        expect(lockToggle?.textContent).toContain('ON');
      });
    });
  });

  // ─── Dashboard ───

  describe('Dashboard', () => {
    it('navigates dashboard tabs', async () => {
      render(<App />);
      await skipAuth();
      const dashBtn = document.getElementById('dashboard-btn');
      fireEvent.click(dashBtn!);
      await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('YouTube Defaults')).toBeInTheDocument());
      
      fireEvent.click(screen.getByText('Account'));
      await waitFor(() => expect(screen.getByText('Google Account')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Info'));
      await waitFor(() => expect(screen.getByText('App Info')).toBeInTheDocument());
      expect(screen.getByText(/Version:/)).toBeInTheDocument();
      expect(screen.getByText('Jave Bacsain')).toBeInTheDocument();
      expect(screen.getByText('Carl Gerald Parro')).toBeInTheDocument();
      expect(screen.getByText('Marc Justin Prestado')).toBeInTheDocument();
    });
  });

  // ─── Step 3: Finalize ───

  describe('Finalize (Step 3)', () => {
    it('reaches merge screen and shows output path', async () => {
      mockElectronAPI.selectVideoFiles.mockResolvedValue(['C:\\a.mp4', 'C:\\b.mp4']);
      render(<App />);
      await skipAuth();
      fireEvent.click(screen.getByTestId('dropzone'));
      await waitFor(() => expect(screen.getByText('a.mp4')).toBeInTheDocument());
      
      fireEvent.click(screen.getByText('Proceed'));
      await waitFor(() => expect(screen.getByText('Arrange sequence')).toBeInTheDocument());
      
      fireEvent.click(screen.getByText('Finalize'));
      await waitFor(() => expect(screen.getByText('Finalize and merge')).toBeInTheDocument());
      
      expect(screen.getByText('Save destination')).toBeInTheDocument();
    });

    it('uses output name template for suggested save destination', async () => {
      mockElectronAPI.getSettings.mockResolvedValue({
        maxFileSizeMb: 500,
        defaultOutputDir: 'C:\\Exports',
        outputNameTemplate: 'final_cut',
      });
      mockElectronAPI.selectVideoFiles.mockResolvedValue(['C:\\a.mp4', 'C:\\b.mp4']);

      render(<App />);
      await skipAuth();
      fireEvent.click(screen.getByTestId('dropzone'));
      await waitFor(() => expect(screen.getByText('a.mp4')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Proceed'));
      await waitFor(() => expect(screen.getByText('Arrange sequence')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Finalize'));
      await waitFor(() => expect(screen.getByText('Finalize and merge')).toBeInTheDocument());

      expect(screen.getByText('C:\\Exports\\final_cut.mp4')).toBeInTheDocument();
    });
  });
});
