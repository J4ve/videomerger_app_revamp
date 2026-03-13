import React from 'react';

interface ProgressBarProps {
  progress: number;
  statusText: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, statusText }) => {
  return (
    <div className="card">
      <h3>Processing Progress</h3>
      <div 
        style={{
          width: '100%',
          backgroundColor: '#3d3d3d',
          borderRadius: '8px',
          overflow: 'hidden',
          marginTop: '1rem',
          height: '24px'
        }}
      >
        <div 
          style={{
            width: `${Math.max(0, Math.min(100, progress))}%`,
            height: '100%',
            backgroundColor: '#667eea',
            transition: 'width 0.3s ease-in-out'
          }}
        />
      </div>
      <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#a8b2d1' }}>
        {progress.toFixed(1)}% - {statusText}
      </div>
    </div>
  );
};

export default ProgressBar;
