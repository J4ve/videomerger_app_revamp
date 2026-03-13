import React from 'react';

interface OutputViewerProps {
  outputPath: string;
  onOpenFolder: () => void;
  onReset: () => void;
}

const OutputViewer: React.FC<OutputViewerProps> = ({ outputPath, onOpenFolder, onReset }) => {
  return (
    <div className="card" style={{border: '2px solid #667eea'}}>
      <h2 style={{color: '#667eea'}}>Merge Complete!</h2>
      <div className="output-path">
        <strong>Saved to:</strong> {outputPath}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button onClick={onOpenFolder} className="button" style={{flex: 1}}>
          Open Folder
        </button>
        <button onClick={onReset} className="button" style={{flex: 1, background: '#3d3d3d'}}>
          Merge More Videos
        </button>
      </div>
    </div>
  );
};

export default OutputViewer;
