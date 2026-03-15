import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';

declare global {
  interface Window {
    electronAPI: {
      selectVideoFiles: () => Promise<string[]>;
      selectSaveLocation: () => Promise<string | undefined>;
      validateVideos: (paths: string[]) => Promise<boolean>;
      getVideoInfo: (path: string) => Promise<any>;
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

  // Arrange sort state
  const [sortBy, setSortBy] = useState<string>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Dashboard state
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  useEffect(() => {
    checkFFmpeg();
    checkAuthStatus();

    if (window.electronAPI) {
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
    } else {
      console.warn('Electron API not found. Running in browser mode.');
    }
  }, []);

  const canProceedStep1 = selectedFiles.length >= 2;
  const canProceedStep2 = selectedFiles.length >= 2;

  const selectedFileNames = useMemo(
    () => selectedFiles.map((file) => file.split('\\').pop() || file),
    [selectedFiles]
  );

  const checkFFmpeg = async () => {
    if (!window.electronAPI) {
      setFFmpegStatus('Not available (Browser Mode)');
      return;
    }
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
    if (!window.electronAPI) {
      setAuthChecked(true);
      return;
    }
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
    if (!window.electronAPI) {
      alert('Google login is only available in the Desktop application.');
      setStep(1);
      return;
    }
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
    if (window.electronAPI) {
      await window.electronAPI.googleOAuthLogout();
    }
    setIsLoggedIn(false);
    setGoogleUser(null);
  };

  // --- File Selection ---
  const handleSelectFiles = async () => {
    if (!window.electronAPI) {
      alert('File selection is only available in the Desktop application. In browser mode, dragging files is preferred (if implemented) or use the desktop app.');
      return;
    }
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
    setSelectedFiles(selectedFiles.filter((_, index) => index !== indexToRemove));
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
    const result = Array.from(selectedFiles);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setSelectedFiles(result);
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

  // Duplicate video in arrange
  const handleDuplicateFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index + 1, 0, selectedFiles[index]);
    setSelectedFiles(newFiles);
  };

  // Sorting
  const handleSort = (by: string) => {
    setSortBy(by);
    const sorted = [...selectedFiles];
    if (by === 'name') {
      sorted.sort((a, b) => {
        const nameA = (a.split('\\').pop() || a).toLowerCase();
        const nameB = (b.split('\\').pop() || b).toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }
    setSelectedFiles(sorted);
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    if (sortBy !== 'none') {
      // Re-apply sort with new order
      const sorted = [...selectedFiles];
      if (sortBy === 'name') {
        sorted.sort((a, b) => {
          const nameA = (a.split('\\').pop() || a).toLowerCase();
          const nameB = (b.split('\\').pop() || b).toLowerCase();
          return newOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
      }
      setSelectedFiles(sorted);
    }
  };

  // --- Output & Merge ---
  const handleSelectOutput = async () => {
    if (!window.electronAPI) {
      alert('Save location selection is only available in the Desktop application.');
      return;
    }
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

    if (!window.electronAPI) {
      setStatus('Merge feature is only available in the Desktop application.');
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
    if (outputPath && window.electronAPI) {
      window.electronAPI.openFolder(outputPath);
    }
  };

  const handleUploadToYouTube = async () => {
    if (!outputPath || !ytTitle) {
      setStatus('Please provide a title for the YouTube upload.');
      return;
    }
    if (!window.electronAPI) {
      setStatus('YouTube upload is only available in the Desktop application.');
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

    if (step === 3) {
      // Preview → Finalize
      setStep(4);
      return;
    }

    // Step 4: merge
    await handleMerge();
  };

  const getStepCircleClass = (stepNumber: number): string => {
    if (stepNumber < step) return 'step-circle step-circle-complete';
    if (stepNumber === step) return 'step-circle step-circle-active';
    return 'step-circle';
  };

  const nextLabel = step === 1 ? 'Proceed' : step === 2 ? 'Preview' : step === 3 ? 'Finalize' : isMerging ? 'Merging...' : 'Start Merge';

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
                <p>Bulk video merging app</p>
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
              <p>Bulk video merging app</p>
            </div>
          </div>

          <div className="stepper" aria-label="Merge workflow steps">
            <div className={getStepCircleClass(1)}>1</div>
            <div className={`step-line ${step >= 2 ? 'step-line-active' : ''}`} />
            <div className={getStepCircleClass(2)}>2</div>
            <div className={`step-line ${step >= 3 ? 'step-line-active' : ''}`} />
            <div className={getStepCircleClass(3)}>3</div>
            <div className={`step-line ${step >= 4 ? 'step-line-active' : ''}`} />
            <div className={getStepCircleClass(4)}>4</div>
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
              onClick={() => setShowDashboard(true)}
              title="Dashboard & Settings"
              id="dashboard-btn"
            >
              ⚙
            </button>
            {isLoggedIn && googleUser && (
              <div className="user-badge" title={googleUser.email}>
                {googleUser.name?.charAt(0) || '?'}
              </div>
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

                  {/* Video Standardization Dropdowns */}
                  <div className="std-row">
                    <label className="std-label">
                      Resolution
                      <select
                        className="std-select"
                        value={standardization.resolution}
                        onChange={e => setStandardization(prev => ({ ...prev, resolution: e.target.value }))}
                        id="resolution-select"
                        data-testid="resolution-select"
                      >
                        {RESOLUTION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="std-label">
                      Frame Rate
                      <select
                        className="std-select"
                        value={standardization.fps}
                        onChange={e => setStandardization(prev => ({ ...prev, fps: e.target.value }))}
                        id="fps-select"
                        data-testid="fps-select"
                      >
                        {FPS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
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
                  <p className="panel-subtitle">Move videos up or down, drag to rearrange, sort, or duplicate.</p>

                  <div className="sort-toolbar">
                    <span style={{ color: 'var(--olive-300)', fontSize: '0.88rem' }}>Sort:</span>
                    <button
                      className={`sort-btn ${sortBy === 'name' ? 'sort-btn-active' : ''}`}
                      onClick={() => handleSort('name')}
                      id="sort-by-name"
                    >
                      By Name
                    </button>
                    <button className="sort-btn" onClick={toggleSortOrder} id="sort-order-toggle">
                      {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </button>
                  </div>

                  <div className="sequence-list">
                    {selectedFileNames.map((file, index) => (
                      <div
                        key={`${file}-${index}`}
                        className="sequence-item"
                        draggable
                        onDragStart={() => handleSeqDragStart(index)}
                        onDragEnter={() => handleSeqDragEnter(index)}
                        onDragEnd={handleSeqDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <span className="drag-handle" title="Drag to reorder">⠿</span>
                        <span className="sequence-order">{index + 1}</span>
                        <span className="file-name">{file}</span>
                        <div className="sequence-actions">
                          <button
                            className="mini-btn"
                            onClick={() => handleDuplicateFile(index)}
                            disabled={isMerging}
                            title="Duplicate this video"
                            id={`dup-btn-${index}`}
                          >
                            Dup
                          </button>
                          <button
                            className="mini-btn"
                            onClick={() => handleMoveFileUp(index)}
                            disabled={index === 0 || isMerging}
                          >
                            Up
                          </button>
                          <button
                            className="mini-btn"
                            onClick={() => handleMoveFileDown(index)}
                            disabled={index === selectedFiles.length - 1 || isMerging}
                          >
                            Down
                          </button>
                          <button
                            className="file-remove"
                            onClick={() => handleRemoveFile(index)}
                            disabled={isMerging}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Step 3: Preview */}
              {step === 3 && (
                <section className="panel fade-in">
                  <h2>Preview merge settings</h2>
                  <p className="panel-subtitle">Review your configuration before merging.</p>

                  <div className="preview-summary">
                    <div className="preview-block">
                      <h3>Videos ({selectedFiles.length})</h3>
                      <ol className="preview-file-list">
                        {selectedFileNames.map((file, i) => (
                          <li key={i}>{file}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="preview-block">
                      <h3>Standardization</h3>
                      <div className="preview-meta">
                        <span>Resolution:</span><span>{resolutionLabel}</span>
                        <span>Frame Rate:</span><span>{fpsLabel}</span>
                      </div>
                    </div>
                    {isLoggedIn && (
                      <div className="preview-block">
                        <h3>Account</h3>
                        <p style={{ margin: 0, color: 'var(--olive-200)' }}>
                          Signed in as {googleUser?.name || googleUser?.email || 'Google User'}
                        </p>
                        <p style={{ margin: '4px 0 0', color: 'var(--olive-300)', fontSize: '0.85rem' }}>
                          YouTube upload will be available after merge.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Step 4: Finalize & Merge */}
              {step === 4 && (
                <section className="panel fade-in">
                  <h2>Finalize and merge</h2>
                  <p className="panel-subtitle">Pick an output file path and start the merge process.</p>

                  <div className="output-row">
                    <button className="btn btn-secondary" onClick={handleSelectOutput} disabled={isMerging}>
                      Choose save location
                    </button>
                    <div className="output-path-box">
                      {outputPath || 'No output path selected yet'}
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
                (step === 4 && !outputPath)
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
  onStandardizationChange: (s: { resolution: string; fps: string }) => void;
  onLogout: () => void;
  onLogin: () => void;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({
  isLoggedIn, googleUser, ffmpegDetails, standardization, onStandardizationChange, onLogout, onLogin
}) => {
  const [settings, setSettings] = useState<any>({
    maxFileSizeMb: 500,
    defaultResolution: 'original',
    defaultFps: 'original',
    ytDefaultPrivacy: 'private',
    ytDefaultTitle: '',
    ytDefaultDescription: '',
  });
  const [presets, setPresets] = useState<any[]>([]);
  const [presetName, setPresetName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!window.electronAPI) return;
    try {
      const data = await window.electronAPI.getSettings();
      if (data) {
        setSettings((prev: any) => ({ ...prev, ...data }));
        if (data.presets) setPresets(data.presets);
      }
    } catch {
      // fallback
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (window.electronAPI) {
      await window.electronAPI.saveSettings({ ...settings, presets });
    }
    onStandardizationChange({
      resolution: settings.defaultResolution || 'original',
      fps: settings.defaultFps || 'original',
    });
    setIsSaving(false);
  };

  const handleAddPreset = () => {
    if (!presetName.trim()) return;
    const newPreset = {
      name: presetName,
      resolution: standardization.resolution,
      fps: standardization.fps,
    };
    setPresets([...presets, newPreset]);
    setPresetName('');
  };

  const handleLoadPreset = (preset: any) => {
    onStandardizationChange({ resolution: preset.resolution, fps: preset.fps });
    setSettings((prev: any) => ({
      ...prev,
      defaultResolution: preset.resolution,
      defaultFps: preset.fps,
    }));
  };

  const handleDeletePreset = (index: number) => {
    setPresets(presets.filter((_, i) => i !== index));
  };

  const tabs = [
    { id: 'general', label: '⚙ General' },
    { id: 'presets', label: '📋 Presets' },
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

        {activeTab === 'presets' && (
          <div className="dash-section">
            <h3>Standardization Presets</h3>
            <p className="panel-subtitle">Save and load resolution/FPS combinations.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Preset name"
                className="yt-input"
                style={{ flex: 1 }}
              />
              <button className="btn btn-secondary" onClick={handleAddPreset}>Save Current</button>
            </div>
            {presets.length === 0 ? (
              <div className="empty-state">No presets saved yet.</div>
            ) : (
              <div className="file-grid">
                {presets.map((preset, i) => (
                  <div key={i} className="preset-card">
                    <div>
                      <strong>{preset.name}</strong>
                      <span style={{ color: 'var(--olive-300)', marginLeft: 8, fontSize: '0.85rem' }}>
                        {RESOLUTION_OPTIONS.find(o => o.value === preset.resolution)?.label} ·{' '}
                        {FPS_OPTIONS.find(o => o.value === preset.fps)?.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="mini-btn" onClick={() => handleLoadPreset(preset)}>Load</button>
                      <button className="file-remove" onClick={() => handleDeletePreset(i)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ marginTop: 16 }}>
              {isSaving ? 'Saving...' : 'Save Presets'}
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
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !window.electronAPI} style={{ marginTop: 16 }}>
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
