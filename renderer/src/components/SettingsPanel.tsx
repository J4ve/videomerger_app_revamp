import React, { useState, useEffect } from 'react';

interface SettingsPanelProps {
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<any>({
    maxFileSizeMb: 500,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await window.electronAPI.getSettings();
    if (data) {
      setSettings(data);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await window.electronAPI.saveSettings(settings);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="card" style={{ border: '2px solid #764ba2' }}>
      <h2 style={{ color: '#764ba2' }}>Settings</h2>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a8b2d1' }}>
          Max File Size (MB)
        </label>
        <input
          type="number"
          value={settings.maxFileSizeMb || 500}
          onChange={(e) => setSettings({ ...settings, maxFileSizeMb: parseInt(e.target.value) || 500 })}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid #3d3d3d',
            backgroundColor: '#1e1e1e',
            color: 'white',
            fontSize: '1rem'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button onClick={handleSave} className="button" style={{ flex: 1 }} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        <button onClick={onClose} className="button" style={{ flex: 1, background: '#3d3d3d' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
