import React, { useState, useEffect } from 'react';
import FileSelector from './components/FileSelector';
import MergeButton from './components/MergeButton';
import ProgressBar from './components/ProgressBar';
import OutputViewer from './components/OutputViewer';
import SettingsPanel from './components/SettingsPanel';

declare global {
  interface Window {
    electronAPI: {
      selectVideoFiles: () => Promise<string[]>;
      selectSaveLocation: () => Promise<string | undefined>;
      validateVideos: (paths: string[]) => Promise<boolean>;
      getVideoInfo: (path: string) => Promise<any>;
      mergeVideos: (options: any) => Promise<any>;
      checkFFmpeg: () => Promise<{ available: boolean; version: string }>;
      openFolder: (path: string) => Promise<void>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      onProcessingEvent: (callback: (event: any) => void) => void;
    };
  }
}

const App: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [ffmpegStatus, setFFmpegStatus] = useState<string>('Checking...');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeComplete, setMergeComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  useEffect(() => {
    checkFFmpeg();
    
    window.electronAPI.onProcessingEvent((event) => {
      setStatus(event.message || event.type);
      if (event.type === 'progress') {
        setProgress(event.percent || 0);
      } else if (event.type === 'error') {
        setIsMerging(false);
      } else if (event.type === 'complete') {
        setIsMerging(false);
        setMergeComplete(true);
      }
    });
  }, []);

  const checkFFmpeg = async () => {
    const result = await window.electronAPI.checkFFmpeg();
    setFFmpegStatus(
      result.available
        ? `FFmpeg available (${result.version})`
        : 'FFmpeg not available'
    );
  };

  const handleSelectFiles = async () => {
    const files = await window.electronAPI.selectVideoFiles();
    if (files && files.length > 0) {
      const uniqueFiles = Array.from(new Set([...selectedFiles, ...files]));
      setSelectedFiles(uniqueFiles);
      setStatus(`Added ${files.length} file(s). Total: ${uniqueFiles.length}`);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles(selectedFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleReorderFiles = (startIndex: number, endIndex: number) => {
    const result = Array.from(selectedFiles);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setSelectedFiles(result);
  };

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
    
    // The merge runs via IPC, and we wait for events for progress
    const result = await window.electronAPI.mergeVideos({
      inputPaths: selectedFiles,
      outputPath: outputPath,
    });

    if (!result.success) {
      setStatus(`Error: ${result.error}`);
      setIsMerging(false);
    }
  };

  const handleOpenFolder = () => {
    if (outputPath) {
      window.electronAPI.openFolder(outputPath);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setOutputPath('');
    setIsMerging(false);
    setMergeComplete(false);
    setProgress(0);
    setStatus('Ready');
  };

  return (
    <div className="app">
      <header className="header" style={{ position: 'relative' }}>
        <h1>Video Merger</h1>
        <p className="subtitle">Desktop Application</p>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{
            position: 'absolute',
            top: '2rem',
            right: '2rem',
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            opacity: 0.8
          }}
        >
          ⚙️ Settings
        </button>
      </header>

      <main className="main">
        <div className="status-bar">
          <span className="status-label">FFmpeg:</span>
          <span className="status-value">{ffmpegStatus}</span>
        </div>

        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : !mergeComplete ? (
          <>
            <FileSelector
              selectedFiles={selectedFiles}
              onSelectFiles={handleSelectFiles}
              onRemoveFile={handleRemoveFile}
              onReorderFiles={handleReorderFiles}
            />

            <div className="card">
              <h2>Output Location</h2>
              <button onClick={handleSelectOutput} className="button" disabled={isMerging}>
                Choose Save Location
              </button>
              {outputPath && (
                <div className="output-path">
                  <strong>Output:</strong> {outputPath}
                </div>
              )}
            </div>

            {isMerging && (
              <ProgressBar progress={progress} statusText={status} />
            )}

            <MergeButton
              onMerge={handleMerge}
              disabled={selectedFiles.length < 2 || !outputPath}
              isMerging={isMerging}
            />

            <div className="status-panel">
              <strong>Status:</strong> {status}
            </div>
          </>
        ) : (
          <OutputViewer
            outputPath={outputPath}
            onOpenFolder={handleOpenFolder}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
};

export default App;
