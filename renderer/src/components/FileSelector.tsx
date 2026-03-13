import React, { DragEvent, useState } from 'react';

interface FileSelectorProps {
  selectedFiles: string[];
  onSelectFiles: () => void;
  onRemoveFile: (index: number) => void;
  onReorderFiles: (startIndex: number, endIndex: number) => void;
}

const FileSelector: React.FC<FileSelectorProps> = ({
  selectedFiles,
  onSelectFiles,
  onRemoveFile,
  onReorderFiles
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: DragEvent<HTMLLIElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorderFiles(draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="card">
      <h2>Select Videos</h2>
      <button onClick={onSelectFiles} className="button">
        Choose Video Files
      </button>
      {selectedFiles.length > 0 && (
        <div className="file-list">
          <h3>Selected Files ({selectedFiles.length}):</h3>
          <ul>
            {selectedFiles.map((file, index) => (
              <li
                key={`${file}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                style={{
                  cursor: 'grab',
                  opacity: draggedIndex === index ? 0.5 : 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ wordBreak: 'break-all', marginRight: '1rem' }}>
                  <span style={{ marginRight: '8px', opacity: 0.5 }}>☰</span>
                  {file}
                </div>
                <button
                  onClick={() => onRemoveFile(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff6b6b',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '0 8px'
                  }}
                  title="Remove"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileSelector;
