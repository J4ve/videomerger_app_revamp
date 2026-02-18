import React, { useState } from 'react';

declare global {
  interface Window {
    electronAPI: {
      selectVideoFiles: () => Promise<string[]>;
      selectSaveLocation: () => Promise<string | undefined>;
      validateVideos: (paths: string[]) => Promise<boolean>;
      getVideoInfo: (path: string) => Promise<any>;
      mergeVideos: (options: any) => Promise<any>;
      checkFFmpeg: () => Promise<{ available: boolean; version: string }>;
    };
  }
}

const App: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [ffmpegStatus, setFFmpegStatus] = useState<string>('Checking...');

  React.useEffect(() => {
    checkFFmpeg();
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
    setSelectedFiles(files);
    setStatus(`Selected ${files.length} file(s)`);
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

    setStatus('Merging videos...');
    const result = await window.electronAPI.mergeVideos({
      inputPaths: selectedFiles,
      outputPath: outputPath,
      quality: 'high',
      overwrite: true,
    });

    if (result.success) {
      setStatus('Videos merged successfully!');
    } else {
      setStatus(`Error: ${result.error}`);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Video Merger</h1>
        <p className="subtitle">Desktop Application</p>
      </header>

      <main className="main">
        <div className="status-bar">
          <span className="status-label">FFmpeg:</span>
          <span className="status-value">{ffmpegStatus}</span>
        </div>

        <div className="card">
          <h2>Select Videos</h2>
          <button onClick={handleSelectFiles} className="button">
            Choose Video Files
          </button>
          {selectedFiles.length > 0 && (
            <div className="file-list">
              <h3>Selected Files ({selectedFiles.length}):</h3>
              <ul>
                {selectedFiles.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Output Location</h2>
          <button onClick={handleSelectOutput} className="button">
            Choose Save Location
          </button>
          {outputPath && (
            <div className="output-path">
              <strong>Output:</strong> {outputPath}
            </div>
          )}
        </div>

        <div className="card">
          <button
            onClick={handleMerge}
            className="button button-primary"
            disabled={selectedFiles.length < 2 || !outputPath}
          >
            Merge Videos
          </button>
        </div>

        <div className="status-panel">
          <strong>Status:</strong> {status}
        </div>
      </main>
    </div>
  );
};

export default App;
