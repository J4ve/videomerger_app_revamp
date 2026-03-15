import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';

declare global {
  interface Window {
    electronAPI: {
      selectVideoFiles: () => Promise<string[]>;
      selectSaveLocation: () => Promise<string | undefined>;
      validateVideos: (paths: string[]) => Promise<boolean>;
      getVideoInfo: (path: string) => Promise<any>;
      getArrangeVideoMetadata: (paths: string[]) => Promise<Record<string, {
        duration: number | null;
        modifiedMs: number | null;
        size: number | null;
      }>>;
      mergeVideos: (options: any) => Promise<any>;
      checkFFmpeg: () => Promise<{ available: boolean; version: string }>;
      checkFFmpegDetails: () => Promise<{
        available: boolean;
        version: string;
        path: string;
        isBundled: boolean;
      }>;
      openFolder: (path: string) => Promise<void>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      googleOAuthLogin: () => Promise<{ success: boolean; user?: any; error?: string }>;
      googleOAuthLogout: () => Promise<{ success: boolean }>;
      getGoogleAuthStatus: () => Promise<{ isLoggedIn: boolean; user?: any }>;
      uploadToYouTube: (options: any) => Promise<any>;
      onProcessingEvent: (callback: (event: any) => void) => void;
    };
  }
}

const SUPPORTED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

const RESOLUTION_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: '720p', label: '720p (1280×720)' },
  { value: '1080p', label: '1080p (1920×1080)' },
  { value: '4k', label: '4K (3840×2160)' },
];

const FPS_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: '24', label: '24 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
];

type SortField = 'none' | 'name' | 'size' | 'duration' | 'date';

interface ArrangeVideoMeta {
  duration: number | null;
  modifiedMs: number | null;
  size: number | null;
}

interface YouTubeQuickPreset {
  name: string;
  title: string;
  description: string;
  privacy: string;
}

const App: React.FC = () => {
  // Wizard state
  const [step, setStep] = useState<number>(0); // 0 = auth prompt
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeComplete, setMergeComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // FFmpeg state
  const [ffmpegStatus, setFFmpegStatus] = useState<string>('Checking...');
  const [ffmpegDetails, setFFmpegDetails] = useState<{
    available: boolean; version: string; path: string; isBundled: boolean;
  } | null>(null);
  const [showFFmpegDialog, setShowFFmpegDialog] = useState<boolean>(false);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Standardization state
  const [standardization, setStandardization] = useState<{
    resolution: string; fps: string;
  }>({ resolution: 'original', fps: 'original' });

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // YouTube config state
  const [ytTitle, setYtTitle] = useState<string>('');
  const [ytDescription, setYtDescription] = useState<string>('');
  const [ytPrivacy, setYtPrivacy] = useState<string>('private');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [finalizeConfigView, setFinalizeConfigView] = useState<'merge' | 'youtube'>('merge');
  const [ytPresetName, setYtPresetName] = useState<string>('');
  const [ytQuickPresets, setYtQuickPresets] = useState<YouTubeQuickPreset[]>([]);
  const [selectedYtPresetName, setSelectedYtPresetName] = useState<string>('');

  // Arrange sort state
  const [sortBy, setSortBy] = useState<SortField>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isArrangementLockMode, setIsArrangementLockMode] = useState<boolean>(false);
  const [allowDuplicate, setAllowDuplicate] = useState<boolean>(true);
  const [fileLocks, setFileLocks] = useState<boolean[]>([]);
  const [arrangeVideoMeta, setArrangeVideoMeta] = useState<Record<string, ArrangeVideoMeta>>({});
  const [previewVideoIndex, setPreviewVideoIndex] = useState<number>(0);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Dashboard state
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [dashboardInitialTab, setDashboardInitialTab] = useState<'general' | 'youtube' | 'ffmpeg' | 'account'>('general');

  useEffect(() => {
    checkFFmpeg();
    checkAuthStatus();

    window.electronAPI.onProcessingEvent((event) => {
      setStatus(event.message || event.type);
      if (event.type === 'progress') {
        setProgress(event.progress || 0);
      } else if (event.type === 'error') {
        setIsMerging(false);
        setStatus(event.error?.message || event.message || 'Merge failed.');
      } else if (event.type === 'complete') {
        setIsMerging(false);
        setMergeComplete(true);
        setProgress(100);
        if (event.result?.outputPath) {
          setOutputPath(event.result.outputPath);
        }
      }
    });
  }, []);

  useEffect(() => {
    const loadQuickPresets = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        const presets = settings?.ytQuickPresets;
        if (Array.isArray(presets)) {
          setYtQuickPresets(presets.filter((p: any) => p && typeof p.name === 'string'));
        }
      } catch {
        // noop
      }
    };
    loadQuickPresets();
  }, []);

  const canProceedStep1 = selectedFiles.length >= 2;
  const canProceedStep2 = selectedFiles.length >= 2;

  const selectedFileNames = useMemo(
    () => selectedFiles.map((file) => file.split('\\').pop() || file),
    [selectedFiles]
  );

  const previewVideoPath = selectedFiles[previewVideoIndex] || '';
  const previewVideoName = selectedFileNames[previewVideoIndex] || '';
  const previewVideoMeta = arrangeVideoMeta[previewVideoPath];
  const previewVideoSrc = useMemo(() => {
    if (!previewVideoPath) return '';
    if (/^(https?:|blob:|data:|local-video:)/i.test(previewVideoPath)) return previewVideoPath;
    return `local-video://preview?path=${encodeURIComponent(previewVideoPath)}`;
  }, [previewVideoPath]);

  useEffect(() => {
    setFileLocks((current) => {
      if (current.length === selectedFiles.length) return current;
      return selectedFiles.map((_, idx) => current[idx] || false);
    });
  }, [selectedFiles]);

  useEffect(() => {
    let active = true;
    const loadArrangeMeta = async () => {
      if (selectedFiles.length === 0) {
        if (active) setArrangeVideoMeta({});
        return;
      }

      const fallbackWithBasicInfo = async () => {
        const entries = await Promise.all(selectedFiles.map(async (filePath) => {
          try {
            const info = await window.electronAPI.getVideoInfo(filePath);
            return [filePath, {
              duration: null,
              modifiedMs: null,
              size: typeof info?.size === 'number' ? info.size : null,
            } as ArrangeVideoMeta] as const;
          } catch {
            return [filePath, {
              duration: null,
              modifiedMs: null,
              size: null,
            } as ArrangeVideoMeta] as const;
          }
        }));
        if (active) {
          setArrangeVideoMeta(Object.fromEntries(entries));
        }
      };

      try {
        const metadataFn = (window.electronAPI as any).getArrangeVideoMetadata;
        if (typeof metadataFn !== 'function') {
          await fallbackWithBasicInfo();
          return;
        }

        const data = await metadataFn(selectedFiles);
        if (active) {
          setArrangeVideoMeta(data || {});
        }
      } catch {
        await fallbackWithBasicInfo();
      }
    };
    loadArrangeMeta();
    return () => {
      active = false;
    };
  }, [selectedFiles]);

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviewVideoIndex(0);
      return;
    }
    if (previewVideoIndex >= selectedFiles.length) {
      setPreviewVideoIndex(selectedFiles.length - 1);
    }
  }, [previewVideoIndex, selectedFiles.length]);

  const checkFFmpeg = async () => {
    try {
      const result = await window.electronAPI.checkFFmpegDetails();
      setFFmpegDetails(result);
      setFFmpegStatus(result.available ? 'Installed' : 'Not Installed');
    } catch {
      const result = await window.electronAPI.checkFFmpeg();
      setFFmpegStatus(result.available ? 'Installed' : 'Not Installed');
    }
  };

  const checkAuthStatus = async () => {
    try {
      const result = await window.electronAPI.getGoogleAuthStatus();
      setIsLoggedIn(result.isLoggedIn);
      if (result.user) setGoogleUser(result.user);
    } catch {
      // Auth not available
    }
    setAuthChecked(true);
  };

  const handleGoogleLogin = async () => {
    const result = await window.electronAPI.googleOAuthLogin();
    if (result.success && result.user) {
      setIsLoggedIn(true);
      setGoogleUser(result.user);
    }
    setStep(1);
  };

  const handleSkipLogin = () => {
    setStep(1);
  };

  const handleLogout = async () => {
    await window.electronAPI.googleOAuthLogout();
    setIsLoggedIn(false);
    setGoogleUser(null);
  };

  // --- File Selection ---
  const handleSelectFiles = async () => {
    const files = await window.electronAPI.selectVideoFiles();
    if (files && files.length > 0) {
      const uniqueFiles = Array.from(new Set([...selectedFiles, ...files]));
      setSelectedFiles(uniqueFiles);
      setStatus(`Added ${files.length} file(s). Total: ${uniqueFiles.length}`);
      if (step === 1 && uniqueFiles.length >= 2) {
        setStatus('Files ready. Proceed to arrange sequence.');
      }
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    if (isArrangementLockMode && fileLocks[indexToRemove]) {
      setStatus('Unlock this clip before removing it.');
      return;
    }
    const nextFiles = selectedFiles.filter((_, index) => index !== indexToRemove);
    const nextLocks = fileLocks.filter((_, index) => index !== indexToRemove);
    setSelectedFiles(nextFiles);
    setFileLocks(nextLocks);
  };

  // --- Drag and Drop on Dropzone ---
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles
      .filter(f => SUPPORTED_EXTENSIONS.includes(getFileExtension(f.name)))
      .map(f => (f as any).path || f.name);

    const invalidCount = droppedFiles.length - validFiles.length;

    if (validFiles.length > 0) {
      setSelectedFiles(prev => {
        const unique = Array.from(new Set([...prev, ...validFiles]));
        return unique;
      });
      let msg = `Added ${validFiles.length} video(s)`;
      if (invalidCount > 0) msg += `. ${invalidCount} unsupported file(s) skipped.`;
      setStatus(msg);
    } else if (droppedFiles.length > 0) {
      setStatus('No supported video files found. Use MP4, MOV, AVI, MKV, or WEBM.');
    }
  }, []);

  // --- Arrange Reordering ---
  const handleReorderFiles = (startIndex: number, endIndex: number) => {
    if (startIndex === endIndex) return;
    if (isArrangementLockMode) {
      if (fileLocks[startIndex] || fileLocks[endIndex]) {
        setStatus('Locked clips cannot be moved.');
        return;
      }

      const min = Math.min(startIndex, endIndex);
      const max = Math.max(startIndex, endIndex);
      for (let idx = min; idx <= max; idx += 1) {
        if (idx !== startIndex && fileLocks[idx]) {
          setStatus('Cannot move a clip across a locked position.');
          return;
        }
      }
    }

    const result = Array.from(selectedFiles);
    const lockResult = Array.from(fileLocks);
    const [removed] = result.splice(startIndex, 1);
    const [removedLock] = lockResult.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    lockResult.splice(endIndex, 0, removedLock);
    setSelectedFiles(result);
    setFileLocks(lockResult);

    setPreviewVideoIndex((current) => {
      if (current === startIndex) return endIndex;
      if (startIndex < endIndex && current > startIndex && current <= endIndex) return current - 1;
      if (endIndex < startIndex && current >= endIndex && current < startIndex) return current + 1;
      return current;
    });
  };

  const handleMoveFileUp = (index: number) => {
    if (index === 0) return;
    handleReorderFiles(index, index - 1);
  };

  const handleMoveFileDown = (index: number) => {
    if (index >= selectedFiles.length - 1) return;
    handleReorderFiles(index, index + 1);
  };

  // Drag-and-drop reorder in arrange screen
  const handleSeqDragStart = (index: number) => {
    if (isArrangementLockMode && fileLocks[index]) return;
    dragItem.current = index;
  };

  const handleSeqDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleSeqDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      handleReorderFiles(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handlePreviewEnded = () => {
    setPreviewVideoIndex((current) => {
      if (selectedFiles.length === 0) return 0;
      if (current >= selectedFiles.length - 1) return 0;
      return current + 1;
    });
  };

  // Duplicate video in arrange
  const handleDuplicateFile = (index: number) => {
    if (!allowDuplicate) {
      setStatus('Duplicate is disabled. Enable it from the toolbar to use it.');
      return;
    }
    const newFiles = [...selectedFiles];
    const newLocks = [...fileLocks];
    newFiles.splice(index + 1, 0, selectedFiles[index]);
    newLocks.splice(index + 1, 0, false);
    setSelectedFiles(newFiles);
    setFileLocks(newLocks);
  };

  const toggleFileLock = (index: number) => {
    if (!isArrangementLockMode) {
      setStatus('Enable "Lock arrangement" to lock positions.');
      return;
    }
    setFileLocks((current) => current.map((locked, idx) => (idx === index ? !locked : locked)));
  };

  const getSortValue = (filePath: string, by: SortField): string | number | null => {
    if (by === 'name') return (filePath.split('\\').pop() || filePath).toLowerCase();
    if (by === 'size') return arrangeVideoMeta[filePath]?.size ?? null;
    if (by === 'duration') return arrangeVideoMeta[filePath]?.duration ?? null;
    if (by === 'date') return arrangeVideoMeta[filePath]?.modifiedMs ?? null;
    return null;
  };

  const compareSort = (aPath: string, bPath: string, by: SortField, order: 'asc' | 'desc'): number => {
    const aVal = getSortValue(aPath, by);
    const bVal = getSortValue(bPath, by);
    const direction = order === 'asc' ? 1 : -1;

    const aMissing = aVal === null || aVal === undefined;
    const bMissing = bVal === null || bVal === undefined;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * direction;
    }

    return String(aVal).localeCompare(String(bVal)) * direction;
  };

  const applySort = (by: SortField, order: 'asc' | 'desc') => {
    if (by === 'none') return;

    const currentPreviewPath = selectedFiles[previewVideoIndex] || '';

    if (isArrangementLockMode) {
      const unlocked = selectedFiles
        .map((file, idx) => ({ file, locked: fileLocks[idx] }))
        .filter((item) => !item.locked)
        .map((item) => item.file)
        .sort((a, b) => compareSort(a, b, by, order));

      let unlockedCursor = 0;
      const arranged = selectedFiles.map((file, idx) => {
        if (fileLocks[idx]) return file;
        const next = unlocked[unlockedCursor] || file;
        unlockedCursor += 1;
        return next;
      });

      setSelectedFiles(arranged);
      const nextIndex = currentPreviewPath ? arranged.findIndex((path) => path === currentPreviewPath) : -1;
      setPreviewVideoIndex(nextIndex >= 0 ? nextIndex : 0);
      return;
    }

    const paired = selectedFiles.map((file, idx) => ({ file, lock: fileLocks[idx] || false }));
    paired.sort((a, b) => compareSort(a.file, b.file, by, order));
    const sortedFiles = paired.map((item) => item.file);
    setSelectedFiles(sortedFiles);
    setFileLocks(paired.map((item) => item.lock));
    const nextIndex = currentPreviewPath ? sortedFiles.findIndex((path) => path === currentPreviewPath) : -1;
    setPreviewVideoIndex(nextIndex >= 0 ? nextIndex : 0);
  };

  // Sorting
  const handleSort = (by: SortField) => {
    setSortBy(by);
    applySort(by, sortOrder);
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    applySort(sortBy, newOrder);
  };

  const toggleArrangementMode = () => {
    setIsArrangementLockMode((current) => {
      const next = !current;
      if (!next) {
        setFileLocks((locks) => locks.map(() => false));
      }
      return next;
    });
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return 'Unknown';
    const total = Math.max(0, Math.round(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatDate = (millis: number | null | undefined): string => {
    if (!millis) return 'Unknown';
    return new Date(millis).toLocaleString();
  };

  const formatSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // --- Output & Merge ---
  const handleSelectOutput = async () => {
    const path = await window.electronAPI.selectSaveLocation();
    if (path) {
      setOutputPath(path);
      setStatus(`Output: ${path}`);
    }
  };

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      setStatus('Please select at least 2 videos');
      return;
    }
    if (!outputPath) {
      setStatus('Please select output location');
      return;
    }

    setIsMerging(true);
    setMergeComplete(false);
    setProgress(0);
    setStatus('Validating files...');

    const isValid = await window.electronAPI.validateVideos(selectedFiles);
    if (!isValid) {
      setStatus('Validation failed. Make sure files exist and are valid videos.');
      setIsMerging(false);
      return;
    }

    setStatus('Merging videos...');

    const result = await window.electronAPI.mergeVideos({
      inputPaths: selectedFiles,
      outputPath: outputPath,
      standardization: standardization,
    });

    if (!result.success) {
      setStatus(`Error: ${result.error}`);
      setIsMerging(false);
    } else if (result.outputPath) {
      setOutputPath(result.outputPath);
    }
  };

  const handleOpenFolder = () => {
    if (outputPath) {
      window.electronAPI.openFolder(outputPath);
    }
  };

  const handleUploadToYouTube = async () => {
    if (!outputPath || !ytTitle) {
      setStatus('Please provide a title for the YouTube upload.');
      return;
    }
    setIsUploading(true);
    setStatus('Uploading to YouTube...');
    const result = await window.electronAPI.uploadToYouTube({
      filePath: outputPath,
      title: ytTitle,
      description: ytDescription,
      privacy: ytPrivacy,
    });
    setIsUploading(false);
    setUploadResult(result);
    if (result.success) {
      setStatus(`Uploaded! Video URL: ${result.url}`);
    } else {
      setStatus(`Upload failed: ${result.error}`);
    }
  };

  const persistYtQuickPresets = async (presets: YouTubeQuickPreset[]) => {
    try {
      const settings = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({
        ...settings,
        ytQuickPresets: presets,
      });
    } catch {
      // noop
    }
  };

  const handleSaveYtQuickPreset = async () => {
    const name = ytPresetName.trim();
    if (!name) {
      setStatus('Preset name is required.');
      return;
    }

    const newPreset: YouTubeQuickPreset = {
      name,
      title: ytTitle,
      description: ytDescription,
      privacy: ytPrivacy,
    };

    const nextPresets = [
      ...ytQuickPresets.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase()),
      newPreset,
    ];
    setYtQuickPresets(nextPresets);
    setSelectedYtPresetName(name);
    await persistYtQuickPresets(nextPresets);
    setStatus(`YouTube preset saved: ${name}`);
  };

  const handleLoadYtQuickPreset = () => {
    const preset = ytQuickPresets.find((item) => item.name === selectedYtPresetName);
    if (!preset) {
      setStatus('Select a YouTube preset first.');
      return;
    }
    setYtTitle(preset.title);
    setYtDescription(preset.description);
    setYtPrivacy(preset.privacy);
    setStatus(`Loaded preset: ${preset.name}`);
  };

  const handleDeleteYtQuickPreset = async () => {
    if (!selectedYtPresetName) {
      setStatus('Select a YouTube preset to delete.');
      return;
    }

    const nextPresets = ytQuickPresets.filter((preset) => preset.name !== selectedYtPresetName);
    setYtQuickPresets(nextPresets);
    setSelectedYtPresetName('');
    await persistYtQuickPresets(nextPresets);
    setStatus('YouTube preset deleted.');
  };

  const handleReset = () => {
    setStep(1);
    setSelectedFiles([]);
    setOutputPath('');
    setIsMerging(false);
    setMergeComplete(false);
    setProgress(0);
    setStatus('Ready');
    setYtTitle('');
    setYtDescription('');
    setYtPrivacy('private');
    setUploadResult(null);
    setStandardization({ resolution: 'original', fps: 'original' });
    setFileLocks([]);
    setArrangeVideoMeta({});
    setIsArrangementLockMode(false);
    setAllowDuplicate(true);
  };

  const handleBack = () => {
    if (isMerging || step <= 1) return;
    setStep((prev) => prev - 1);
  };

  const handleNext = async () => {
    if (isMerging) return;

    if (step === 1) {
      if (!canProceedStep1) {
        setStatus('Select at least 2 videos to continue.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!canProceedStep2) {
        setStatus('At least 2 videos are required.');
        return;
      }
      setStep(3);
      return;
    }

    // Step 3: finalize and merge
    await handleMerge();
  };

  const getStepCircleClass = (stepNumber: number): string => {
    if (stepNumber < step) return 'step-circle step-circle-complete';
    if (stepNumber === step) return 'step-circle step-circle-active';
    return 'step-circle';
  };

  const nextLabel = step === 1 ? 'Proceed' : step === 2 ? 'Finalize' : isMerging ? 'Merging...' : 'Start Merge';

  const resolutionLabel = RESOLUTION_OPTIONS.find(o => o.value === standardization.resolution)?.label || 'Original';
  const fpsLabel = FPS_OPTIONS.find(o => o.value === standardization.fps)?.label || 'Original';

  // --- Auth Prompt (step 0) ---
  if (!authChecked) {
    return (
      <div className="wizard-app">
        <div className="wizard-shell">
          <main className="wizard-main" style={{ display: 'grid', placeItems: 'center' }}>
            <div className="panel" style={{ textAlign: 'center', maxWidth: 400 }}>
              <div className="dropzone-icon" style={{ margin: '0 auto 16px' }}>⏳</div>
              <p style={{ color: 'var(--olive-300)' }}>Loading...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="wizard-app">
        <div className="wizard-shell">
          <header className="wizard-header" style={{ justifyContent: 'center' }}>
            <div className="brand">
              <img src="/app-icon.svg" alt="Video Merger icon" className="brand-logo" />
              <div>
                <h1>VideoMerger</h1>
                <p>Desktop merge wizard</p>
              </div>
            </div>
          </header>
          <main className="wizard-main" style={{ display: 'grid', placeItems: 'center' }}>
            <section className="panel auth-prompt fade-in" style={{ maxWidth: 460, textAlign: 'center' }}>
              <h2>Welcome</h2>
              <p className="panel-subtitle">
                Sign in with Google to enable YouTube uploads, or continue without an account.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn btn-primary auth-btn" onClick={handleGoogleLogin}>
                  <span>🔑</span> Sign in with Google
                </button>
                <button className="btn btn-ghost auth-btn" onClick={handleSkipLogin}>
                  Continue without account
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  // --- Dashboard overlay ---
  if (showDashboard) {
    return (
      <div className="wizard-app">
        <div className="wizard-shell">
          <header className="wizard-header">
            <div className="brand">
              <img src="/app-icon.svg" alt="Video Merger icon" className="brand-logo" />
              <div>
                <h1>VideoMerger</h1>
                <p>Dashboard &amp; Settings</p>
              </div>
            </div>
            <div />
            <button className="btn btn-ghost" style={{ justifySelf: 'end' }} onClick={() => setShowDashboard(false)}>
              ✕ Close
            </button>
          </header>
          <main className="wizard-main">
            <DashboardPanel
              isLoggedIn={isLoggedIn}
              googleUser={googleUser}
              ffmpegDetails={ffmpegDetails}
              standardization={standardization}
              initialTab={dashboardInitialTab}
              onStandardizationChange={setStandardization}
              onLogout={handleLogout}
              onLogin={handleGoogleLogin}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-app">
      <div className="wizard-shell">
        <header className="wizard-header">
          <div className="brand">
            <img src="/app-icon.svg" alt="Video Merger icon" className="brand-logo" />
            <div>
              <h1>VideoMerger</h1>
              <p>Desktop merge wizard</p>
            </div>
          </div>

          <div className="stepper" aria-label="Merge workflow steps">
            <div className={getStepCircleClass(1)}>1</div>
            <div className={`step-line ${step >= 2 ? 'step-line-active' : ''}`} />
            <div className={getStepCircleClass(2)}>2</div>
            <div className={`step-line ${step >= 3 ? 'step-line-active' : ''}`} />
            <div className={getStepCircleClass(3)}>3</div>
          </div>

          <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="status-chip"
              onClick={() => setShowFFmpegDialog(true)}
              title="Click for FFmpeg details"
              style={{ cursor: 'pointer' }}
              id="ffmpeg-status-chip"
            >
              <span className={`status-dot ${ffmpegStatus === 'Installed' ? 'status-dot-ok' : 'status-dot-err'}`} />
              <span className="status-chip-label">FFmpeg</span>
              <span>{ffmpegStatus}</span>
            </button>
            <button
              className="mini-btn"
              onClick={() => {
                setDashboardInitialTab('general');
                setShowDashboard(true);
              }}
              title="Dashboard & Settings"
              id="dashboard-btn"
            >
              ⚙
            </button>
            {isLoggedIn && googleUser && (
              <button
                className="user-badge user-badge-btn"
                title={googleUser.email}
                onClick={() => {
                  setDashboardInitialTab('account');
                  setShowDashboard(true);
                }}
                type="button"
              >
                {googleUser.name?.charAt(0) || '?'}
              </button>
            )}
          </div>
        </header>

        {/* FFmpeg Details Dialog */}
        {showFFmpegDialog && (
          <div className="dialog-overlay" onClick={() => setShowFFmpegDialog(false)}>
            <div className="ffmpeg-dialog panel fade-in" onClick={e => e.stopPropagation()}>
              <h2>FFmpeg Details</h2>
              <div className="ffmpeg-detail-grid">
                <span className="detail-label">Status</span>
                <span className={ffmpegDetails?.available ? 'detail-val-ok' : 'detail-val-err'}>
                  {ffmpegDetails?.available ? '✅ Installed' : '❌ Not Installed'}
                </span>
                <span className="detail-label">Version</span>
                <span>{ffmpegDetails?.version || 'Unknown'}</span>
                <span className="detail-label">Path</span>
                <span style={{ wordBreak: 'break-all' }}>{ffmpegDetails?.path || 'N/A'}</span>
                <span className="detail-label">Source</span>
                <span>{ffmpegDetails?.isBundled ? 'Bundled with app' : 'System PATH'}</span>
              </div>
              <button className="btn btn-secondary" style={{ marginTop: 16, width: '100%' }} onClick={() => setShowFFmpegDialog(false)}>
                Close
              </button>
            </div>
          </div>
        )}

        <main className="wizard-main">
          {mergeComplete ? (
            <section className="panel success-panel fade-in">
              <h2>Merge complete 🎉</h2>
              <p>Your videos were merged successfully.</p>
              <div className="output-path-box">{outputPath}</div>
              <div className="success-actions">
                <button className="btn btn-primary" onClick={handleOpenFolder}>
                  Open in folder
                </button>
                <button className="btn btn-secondary" onClick={handleReset}>
                  Merge another set
                </button>
              </div>

              {isLoggedIn && (
                <div className="yt-upload-section">
                  <h3>Upload to YouTube</h3>
                  <div className="yt-config">
                    <label>
                      Title *
                      <input type="text" value={ytTitle} onChange={e => setYtTitle(e.target.value)}
                        placeholder="Enter video title" className="yt-input" />
                    </label>
                    <label>
                      Description
                      <textarea value={ytDescription} onChange={e => setYtDescription(e.target.value)}
                        placeholder="Enter description" className="yt-input" rows={3} />
                    </label>
                    <label>
                      Privacy
                      <select value={ytPrivacy} onChange={e => setYtPrivacy(e.target.value)} className="std-select">
                        <option value="private">Private</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="public">Public</option>
                      </select>
                    </label>
                    <button
                      className="btn btn-primary"
                      onClick={handleUploadToYouTube}
                      disabled={isUploading || !ytTitle}
                    >
                      {isUploading ? 'Uploading...' : '📤 Upload to YouTube'}
                    </button>
                    {uploadResult && (
                      <div className={uploadResult.success ? 'upload-success' : 'upload-error'}>
                        {uploadResult.success
                          ? <span>✅ Uploaded: <a href={uploadResult.url} target="_blank" rel="noreferrer">{uploadResult.url}</a></span>
                          : <span>❌ {uploadResult.error}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Step 1: Add Videos */}
              {step === 1 && (
                <section className="panel fade-in">
                  <h2>Add your videos</h2>
                  <p className="panel-subtitle">Choose at least two clips to start your merge workflow.</p>

                  <div
                    className={`dropzone ${isDragOver ? 'dropzone-drag-over' : ''}`}
                    onClick={handleSelectFiles}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    role="button"
                    tabIndex={0}
                    id="dropzone"
                    data-testid="dropzone"
                  >
                    <span className="dropzone-icon">{isDragOver ? '📂' : '+'}</span>
                    <span className="dropzone-title">{isDragOver ? 'Drop videos here' : 'Click or drag videos here'}</span>
                    <span className="dropzone-subtitle">MP4, MOV, AVI, MKV, WEBM supported</span>
                  </div>

                  <div className="file-grid">
                    {selectedFiles.length === 0 ? (
                      <div className="empty-state">No videos selected yet.</div>
                    ) : (
                      selectedFileNames.map((file, index) => (
                        <div key={`${file}-${index}`} className="file-item">
                          <span className="file-name">{file}</span>
                          <button
                            className="file-remove"
                            onClick={() => handleRemoveFile(index)}
                            title="Remove file"
                            disabled={isMerging}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {/* Step 2: Arrange Sequence */}
              {step === 2 && (
                <section className="panel fade-in">
                  <h2>Arrange sequence</h2>
                  <p className="panel-subtitle">Preview, sort, and lock clip positions before final merge.</p>

                  <div className="sort-toolbar">
                    <span style={{ color: 'var(--olive-300)', fontSize: '0.88rem' }}>Sort:</span>
                    <select
                      className="std-select sort-select"
                      value={sortBy}
                      onChange={(e) => handleSort(e.target.value as SortField)}
                      id="sort-by-select"
                    >
                      <option value="none">None</option>
                      <option value="name">Name</option>
                      <option value="size">Size</option>
                      <option value="duration">Duration</option>
                      <option value="date">Date Modified</option>
                    </select>
                    <button className="sort-btn" onClick={toggleSortOrder} id="sort-order-toggle">
                      {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </button>
                    <button
                      className={`sort-btn ${isArrangementLockMode ? 'sort-btn-active' : ''}`}
                      onClick={toggleArrangementMode}
                      id="lock-arrangement-toggle"
                    >
                      {isArrangementLockMode ? 'Lock arrangement: ON' : 'Lock arrangement: OFF'}
                    </button>
                    <button
                      className={`sort-btn ${allowDuplicate ? 'sort-btn-active' : ''}`}
                      onClick={() => setAllowDuplicate((current) => !current)}
                      id="allow-duplicate-toggle"
                    >
                      {allowDuplicate ? 'Duplicate: ON' : 'Duplicate: OFF'}
                    </button>
                  </div>

                  <div className="arrange-layout">
                    <aside className="arrange-preview-panel">
                      <h3>Clip Preview</h3>
                      <div className="preview-player-box arrange-player-box">
                        {previewVideoSrc ? (
                          <video
                            key={`arrange-${previewVideoSrc}`}
                            className="preview-player"
                            controls
                            autoPlay
                            preload="metadata"
                            src={previewVideoSrc}
                            onEnded={handlePreviewEnded}
                          />
                        ) : (
                          <div className="preview-player-empty">Select a clip to preview.</div>
                        )}
                      </div>
                      <div className="arrange-video-meta">
                        <strong>{previewVideoName || 'None selected'}</strong>
                        <span>Duration: {formatDuration(previewVideoMeta?.duration)}</span>
                        <span>Date: {formatDate(previewVideoMeta?.modifiedMs)}</span>
                        <span>Size: {formatSize(previewVideoMeta?.size)}</span>
                      </div>
                      <button
                        className="file-remove arrange-remove-btn"
                        onClick={() => handleRemoveFile(previewVideoIndex)}
                        disabled={isMerging || !selectedFiles[previewVideoIndex] || (isArrangementLockMode && !!fileLocks[previewVideoIndex])}
                      >
                        Remove selected clip
                      </button>
                    </aside>

                    <div className="sequence-list">
                      {selectedFileNames.map((file, index) => (
                        <div
                          key={`${file}-${index}`}
                          className={`sequence-item ${index === previewVideoIndex ? 'sequence-item-active' : ''}`}
                          draggable={!isArrangementLockMode || !fileLocks[index]}
                          onClick={() => setPreviewVideoIndex(index)}
                          onDragStart={() => handleSeqDragStart(index)}
                          onDragEnter={() => handleSeqDragEnter(index)}
                          onDragEnd={handleSeqDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          <span className="drag-handle" title="Drag to reorder">⠿</span>
                          <span className="sequence-order">{index + 1}</span>
                          <span className="file-name">{file}</span>
                          <span className="sequence-meta-chip">{formatDuration(arrangeVideoMeta[selectedFiles[index]]?.duration)}</span>
                          <div className="sequence-actions">
                            <button
                              className={`mini-btn ${fileLocks[index] ? 'mini-btn-lock-active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFileLock(index);
                              }}
                              disabled={!isArrangementLockMode || isMerging}
                              title="Lock position"
                            >
                              {fileLocks[index] ? 'Locked' : 'Lock'}
                            </button>
                            <button
                              className="mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateFile(index);
                              }}
                              disabled={isMerging || !allowDuplicate}
                              title="Duplicate this video"
                              id={`dup-btn-${index}`}
                            >
                              Dup
                            </button>
                            <button
                              className="mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveFileUp(index);
                              }}
                              disabled={index === 0 || isMerging || (isArrangementLockMode && (fileLocks[index] || fileLocks[index - 1]))}
                            >
                              Up
                            </button>
                            <button
                              className="mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveFileDown(index);
                              }}
                              disabled={index === selectedFiles.length - 1 || isMerging || (isArrangementLockMode && (fileLocks[index] || fileLocks[index + 1]))}
                            >
                              Down
                            </button>
                            <button
                              className="file-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(index);
                              }}
                              disabled={isMerging || (isArrangementLockMode && fileLocks[index])}
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Step 3: Finalize & Merge */}
              {step === 3 && (
                <section className="panel fade-in">
                  <h2>Finalize and merge</h2>
                  <p className="panel-subtitle">Preview the arranged clips and configure save/upload from one screen.</p>

                  <div className="finalize-layout">
                    <div className="finalize-left">
                      <div className="preview-player-wrap">
                        <h3>Video Preview</h3>
                        <div className="preview-player-box">
                          {previewVideoSrc ? (
                            <video
                              key={previewVideoSrc}
                              className="preview-player"
                              controls
                              autoPlay
                              preload="metadata"
                              src={previewVideoSrc}
                              onEnded={handlePreviewEnded}
                            />
                          ) : (
                            <div className="preview-player-empty">Select videos in earlier steps to preview here.</div>
                          )}
                        </div>
                        <p className="preview-player-label">Now playing: {previewVideoName || 'None selected'}</p>
                      </div>

                      <div className="preview-block">
                        <h3>Arranged sequence ({selectedFiles.length})</h3>
                        <ol className="preview-file-list selectable-preview-list">
                          {selectedFileNames.map((file, i) => (
                            <li key={`${file}-${i}`}>
                              <button
                                className={`preview-file-btn ${i === previewVideoIndex ? 'preview-file-btn-active' : ''}`}
                                onClick={() => setPreviewVideoIndex(i)}
                                type="button"
                              >
                                <span>{i + 1}.</span>
                                <span>{file}</span>
                              </button>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    <div className="finalize-right">
                      <div className="preview-block">
                        <div className="config-switcher">
                          <button
                            className={`config-switch-btn ${finalizeConfigView === 'merge' ? 'config-switch-btn-active' : ''}`}
                            onClick={() => setFinalizeConfigView('merge')}
                            type="button"
                          >
                            Merge Settings
                          </button>
                          {isLoggedIn && (
                            <button
                              className={`config-switch-btn ${finalizeConfigView === 'youtube' ? 'config-switch-btn-active' : ''}`}
                              onClick={() => setFinalizeConfigView('youtube')}
                              type="button"
                            >
                              YouTube Settings
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="preview-block">
                        <h3>Merge preview</h3>
                        <div className="preview-meta">
                          <span>Resolution:</span><span>{resolutionLabel}</span>
                          <span>Frame Rate:</span><span>{fpsLabel}</span>
                          <span>Clips:</span><span>{selectedFiles.length}</span>
                        </div>
                        {isLoggedIn && (
                          <p style={{ margin: '10px 0 0', color: 'var(--olive-200)' }}>
                            Signed in as {googleUser?.name || googleUser?.email || 'Google User'}
                          </p>
                        )}
                      </div>

                      <div className="preview-block">
                        <h3>Save destination</h3>
                        <div className="output-row">
                          <button className="btn btn-secondary" onClick={handleSelectOutput} disabled={isMerging}>
                            Choose save location
                          </button>
                          <div className="output-path-box">
                            {outputPath || 'No output path selected yet'}
                          </div>
                        </div>
                      </div>

                      <div className="progress-card">
                        <div className="progress-meta">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                        <p className="status-line">{status}</p>
                      </div>

                      {isLoggedIn && finalizeConfigView === 'youtube' && (
                        <div className="preview-block">
                          <h3>YouTube quick setup</h3>
                          <div className="yt-config yt-config-compact">
                            <div className="yt-inline-row">
                              <label>
                                Title *
                                <input
                                  type="text"
                                  value={ytTitle}
                                  onChange={e => setYtTitle(e.target.value)}
                                  placeholder="Video title"
                                  className="yt-input"
                                />
                              </label>
                              <label>
                                Privacy
                                <select value={ytPrivacy} onChange={e => setYtPrivacy(e.target.value)} className="std-select">
                                  <option value="private">Private</option>
                                  <option value="unlisted">Unlisted</option>
                                  <option value="public">Public</option>
                                </select>
                              </label>
                            </div>
                            <label>
                              Description
                              <textarea
                                value={ytDescription}
                                onChange={e => setYtDescription(e.target.value)}
                                placeholder="Short description"
                                className="yt-input"
                                rows={2}
                              />
                            </label>

                            <div className="yt-preset-row">
                              <label>
                                Preset Name
                                <input
                                  type="text"
                                  value={ytPresetName}
                                  onChange={(e) => setYtPresetName(e.target.value)}
                                  placeholder="e.g. Weekly Highlights"
                                  className="yt-input"
                                />
                              </label>
                              <button className="btn btn-secondary" type="button" onClick={handleSaveYtQuickPreset}>
                                Save Preset
                              </button>
                            </div>

                            <div className="yt-preset-row">
                              <label>
                                Load Preset
                                <select
                                  className="std-select"
                                  value={selectedYtPresetName}
                                  onChange={(e) => setSelectedYtPresetName(e.target.value)}
                                >
                                  <option value="">Select preset</option>
                                  {ytQuickPresets.map((preset) => (
                                    <option key={preset.name} value={preset.name}>{preset.name}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="yt-preset-actions">
                                <button className="btn btn-secondary" type="button" onClick={handleLoadYtQuickPreset}>Load</button>
                                <button className="btn btn-ghost" type="button" onClick={handleDeleteYtQuickPreset}>Delete</button>
                              </div>
                            </div>

                            <div className="final-actions">
                              <button className="btn btn-secondary" onClick={handleSelectOutput} disabled={isMerging}>
                                Save
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={handleUploadToYouTube}
                                disabled={isUploading || !ytTitle || !mergeComplete}
                              >
                                {isUploading ? 'Uploading...' : 'Upload'}
                              </button>
                            </div>
                            {!mergeComplete && (
                              <p style={{ margin: 0, color: 'var(--olive-300)', fontSize: '0.84rem' }}>
                                Upload becomes available after merge completes.
                              </p>
                            )}
                            {uploadResult && (
                              <div className={uploadResult.success ? 'upload-success' : 'upload-error'}>
                                {uploadResult.success
                                  ? <span>Uploaded: <a href={uploadResult.url} target="_blank" rel="noreferrer">{uploadResult.url}</a></span>
                                  : <span>{uploadResult.error}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {!mergeComplete && step >= 1 && (
          <footer className="wizard-footer">
            <button className="btn btn-ghost" onClick={handleBack} disabled={step <= 1 || isMerging}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={
                isMerging ||
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !outputPath)
              }
            >
              {nextLabel}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

// --- Dashboard Panel Component ---
interface DashboardPanelProps {
  isLoggedIn: boolean;
  googleUser: any;
  ffmpegDetails: any;
  standardization: { resolution: string; fps: string };
  initialTab: 'general' | 'youtube' | 'ffmpeg' | 'account';
  onStandardizationChange: (s: { resolution: string; fps: string }) => void;
  onLogout: () => void;
  onLogin: () => void;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({
  isLoggedIn, googleUser, ffmpegDetails, standardization, initialTab, onStandardizationChange, onLogout, onLogin
}) => {
  const [settings, setSettings] = useState<any>({
    maxFileSizeMb: 500,
    defaultResolution: 'original',
    defaultFps: 'original',
    ytDefaultPrivacy: 'private',
    ytDefaultTitle: '',
    ytDefaultDescription: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getSettings();
      if (data) {
        setSettings((prev: any) => ({ ...prev, ...data }));
      }
    } catch {
      // fallback
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await window.electronAPI.saveSettings({ ...settings });
    onStandardizationChange({
      resolution: settings.defaultResolution || 'original',
      fps: settings.defaultFps || 'original',
    });
    setIsSaving(false);
  };

  const tabs = [
    { id: 'general', label: '⚙ General' },
    { id: 'youtube', label: '📺 YouTube' },
    { id: 'ffmpeg', label: '🎬 FFmpeg' },
    { id: 'account', label: '👤 Account' },
  ];

  return (
    <div className="dashboard-panel">
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`dash-tab ${activeTab === tab.id ? 'dash-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {activeTab === 'general' && (
          <div className="dash-section">
            <h3>General Settings</h3>
            <label className="std-label">
              Max File Size (MB)
              <input
                type="number"
                value={settings.maxFileSizeMb}
                onChange={e => setSettings({ ...settings, maxFileSizeMb: parseInt(e.target.value) || 500 })}
                className="yt-input"
              />
            </label>
            <label className="std-label">
              Default Resolution
              <select
                className="std-select"
                value={settings.defaultResolution}
                onChange={e => setSettings({ ...settings, defaultResolution: e.target.value })}
              >
                {RESOLUTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="std-label">
              Default Frame Rate
              <select
                className="std-select"
                value={settings.defaultFps}
                onChange={e => setSettings({ ...settings, defaultFps: e.target.value })}
              >
                {FPS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ marginTop: 16 }}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {activeTab === 'youtube' && (
          <div className="dash-section">
            <h3>YouTube Defaults</h3>
            {!isLoggedIn ? (
              <div className="empty-state">Sign in with Google to configure YouTube settings.</div>
            ) : (
              <>
                <label className="std-label">
                  Default Title
                  <input
                    type="text"
                    value={settings.ytDefaultTitle}
                    onChange={e => setSettings({ ...settings, ytDefaultTitle: e.target.value })}
                    className="yt-input"
                    placeholder="My Merged Video"
                  />
                </label>
                <label className="std-label">
                  Default Description
                  <textarea
                    value={settings.ytDefaultDescription}
                    onChange={e => setSettings({ ...settings, ytDefaultDescription: e.target.value })}
                    className="yt-input"
                    rows={3}
                    placeholder="Video description..."
                  />
                </label>
                <label className="std-label">
                  Default Privacy
                  <select
                    className="std-select"
                    value={settings.ytDefaultPrivacy}
                    onChange={e => setSettings({ ...settings, ytDefaultPrivacy: e.target.value })}
                  >
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ marginTop: 16 }}>
                  {isSaving ? 'Saving...' : 'Save YouTube Defaults'}
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'ffmpeg' && (
          <div className="dash-section">
            <h3>FFmpeg Configuration</h3>
            <div className="ffmpeg-detail-grid">
              <span className="detail-label">Status</span>
              <span className={ffmpegDetails?.available ? 'detail-val-ok' : 'detail-val-err'}>
                {ffmpegDetails?.available ? '✅ Installed' : '❌ Not Installed'}
              </span>
              <span className="detail-label">Version</span>
              <span>{ffmpegDetails?.version || 'Unknown'}</span>
              <span className="detail-label">Path</span>
              <span style={{ wordBreak: 'break-all' }}>{ffmpegDetails?.path || 'N/A'}</span>
              <span className="detail-label">Source</span>
              <span>{ffmpegDetails?.isBundled ? 'Bundled with app' : 'System PATH'}</span>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="dash-section">
            <h3>Google Account</h3>
            {isLoggedIn ? (
              <div>
                <div className="account-card">
                  <div className="user-badge-large">{googleUser?.name?.charAt(0) || '?'}</div>
                  <div>
                    <strong>{googleUser?.name || 'Google User'}</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--olive-300)', fontSize: '0.85rem' }}>
                      {googleUser?.email || ''}
                    </p>
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={onLogout} style={{ marginTop: 16 }}>
                  Sign out
                </button>
              </div>
            ) : (
              <div>
                <p className="panel-subtitle">Not signed in. YouTube features are disabled.</p>
                <button className="btn btn-primary" onClick={onLogin}>
                  🔑 Sign in with Google
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
