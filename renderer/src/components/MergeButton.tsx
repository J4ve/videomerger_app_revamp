import React from 'react';

interface MergeButtonProps {
  onMerge: () => void;
  disabled: boolean;
  isMerging: boolean;
}

const MergeButton: React.FC<MergeButtonProps> = ({ onMerge, disabled, isMerging }) => {
  return (
    <div className="card">
      <button
        onClick={onMerge}
        className="button button-primary"
        disabled={disabled || isMerging}
        style={{
          opacity: (disabled || isMerging) ? 0.5 : 1,
          cursor: (disabled || isMerging) ? 'not-allowed' : 'pointer'
        }}
      >
        {isMerging ? 'Merging Videos...' : 'Merge Videos'}
      </button>
    </div>
  );
};

export default MergeButton;
