import React from 'react';

export type AspectRatioPreset =
  | 'original'
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '4:3'
  | 'custom';

export interface ICropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IClipEdit {
  trimStart?: number;
  trimEnd?: number;
  volume?: number;
  crop?: ICropRect;
  aspectRatio?: AspectRatioPreset;
  aspectWidth?: number;
  aspectHeight?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

interface ClipEditPanelProps {
  /** Clip duration in seconds, used to bound the trim sliders. */
  durationSec: number;
  /** Current edit values for this clip. */
  edit: IClipEdit;
  /** Called whenever any field changes; full updated edit object. */
  onChange: (next: IClipEdit) => void;
  /** Reset all edits for this clip. */
  onReset: () => void;
  /** Collapse the panel. */
  onClose: () => void;
  disabled?: boolean;
}

const ASPECT_OPTIONS: { value: AspectRatioPreset; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '16:9', label: '16:9 Landscape' },
  { value: '9:16', label: '9:16 Vertical' },
  { value: '1:1', label: '1:1 Square' },
  { value: '4:5', label: '4:5 Portrait' },
  { value: '4:3', label: '4:3 Classic' },
  { value: 'custom', label: 'Custom' },
];

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <label className="clip-edit-field">
      <span className="clip-edit-field-label">
        {label}
        <span className="clip-edit-field-value">
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function ClipEditPanel({
  durationSec,
  edit,
  onChange,
  onReset,
  onClose,
  disabled = false,
}: ClipEditPanelProps) {
  const safeDuration = Math.max(durationSec || 0, 0);
  const trimStart = edit.trimStart ?? 0;
  const trimEnd = edit.trimEnd ?? 0;
  const volume = edit.volume ?? 1;
  const brightness = edit.brightness ?? 0;
  const contrast = edit.contrast ?? 1;
  const saturation = edit.saturation ?? 1;
  const aspect = edit.aspectRatio ?? 'original';
  const crop = edit.crop;

  const set = (patch: Partial<IClipEdit>) => onChange({ ...edit, ...patch });

  const effectiveDur = Math.max(safeDuration - trimStart - trimEnd, 0);

  return (
    <div className="clip-edit-panel" role="region" aria-label="Per-clip edits">
      <div className="clip-edit-header">
        <h4>Per-clip edits</h4>
        <span className="clip-edit-duration-chip">
          {effectiveDur.toFixed(2)}s / {safeDuration.toFixed(2)}s
        </span>
        <button type="button" className="mini-btn" onClick={onReset} disabled={disabled}>
          Reset
        </button>
        <button type="button" className="mini-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="clip-edit-grid">
        <section className="clip-edit-section">
          <h5>Trim</h5>
          <NumberField
            label="Trim start"
            unit="s"
            value={trimStart}
            min={0}
            max={Math.max(safeDuration - 0.1, 0)}
            step={0.1}
            disabled={disabled}
            onChange={(v) =>
              set({
                trimStart: Math.min(v, Math.max(safeDuration - trimEnd - 0.1, 0)),
              })
            }
          />
          <NumberField
            label="Trim end"
            unit="s"
            value={trimEnd}
            min={0}
            max={Math.max(safeDuration - 0.1, 0)}
            step={0.1}
            disabled={disabled}
            onChange={(v) =>
              set({
                trimEnd: Math.min(v, Math.max(safeDuration - trimStart - 0.1, 0)),
              })
            }
          />
        </section>

        <section className="clip-edit-section">
          <h5>Format</h5>
          <label className="clip-edit-field">
            <span className="clip-edit-field-label">Aspect ratio</span>
            <select
              value={aspect}
              disabled={disabled}
              onChange={(e) =>
                set({ aspectRatio: e.target.value as AspectRatioPreset })
              }
            >
              {ASPECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {aspect === 'custom' && (
            <div className="clip-edit-row">
              <label className="clip-edit-field clip-edit-field-inline">
                <span className="clip-edit-field-label">W</span>
                <input
                  type="number"
                  min={1}
                  value={edit.aspectWidth ?? 16}
                  disabled={disabled}
                  onChange={(e) => set({ aspectWidth: Number(e.target.value) })}
                />
              </label>
              <label className="clip-edit-field clip-edit-field-inline">
                <span className="clip-edit-field-label">H</span>
                <input
                  type="number"
                  min={1}
                  value={edit.aspectHeight ?? 9}
                  disabled={disabled}
                  onChange={(e) => set({ aspectHeight: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          <label className="clip-edit-field">
            <span className="clip-edit-field-label">
              Crop
              <span className="clip-edit-field-hint">
                {crop ? `${crop.width}x${crop.height} @ (${crop.x},${crop.y})` : 'off'}
              </span>
            </span>
            <div className="clip-edit-row">
              <button
                type="button"
                className="mini-btn"
                disabled={disabled}
                onClick={() =>
                  set({
                    crop: crop
                      ? undefined
                      : { x: 0, y: 0, width: 1280, height: 720 },
                  })
                }
              >
                {crop ? 'Disable crop' : 'Enable crop'}
              </button>
            </div>
            {crop && (
              <div className="clip-edit-row clip-edit-row-crop">
                <label className="clip-edit-field-inline">
                  <span>X</span>
                  <input
                    type="number"
                    min={0}
                    value={crop.x}
                    disabled={disabled}
                    onChange={(e) =>
                      set({ crop: { ...crop, x: Number(e.target.value) } })
                    }
                  />
                </label>
                <label className="clip-edit-field-inline">
                  <span>Y</span>
                  <input
                    type="number"
                    min={0}
                    value={crop.y}
                    disabled={disabled}
                    onChange={(e) =>
                      set({ crop: { ...crop, y: Number(e.target.value) } })
                    }
                  />
                </label>
                <label className="clip-edit-field-inline">
                  <span>W</span>
                  <input
                    type="number"
                    min={2}
                    value={crop.width}
                    disabled={disabled}
                    onChange={(e) =>
                      set({ crop: { ...crop, width: Number(e.target.value) } })
                    }
                  />
                </label>
                <label className="clip-edit-field-inline">
                  <span>H</span>
                  <input
                    type="number"
                    min={2}
                    value={crop.height}
                    disabled={disabled}
                    onChange={(e) =>
                      set({ crop: { ...crop, height: Number(e.target.value) } })
                    }
                  />
                </label>
              </div>
            )}
          </label>
        </section>

        <section className="clip-edit-section">
          <h5>Audio</h5>
          <NumberField
            label="Volume"
            unit="x"
            value={volume}
            min={0}
            max={2}
            step={0.05}
            disabled={disabled}
            onChange={(v) => set({ volume: v })}
          />
        </section>

        <section className="clip-edit-section">
          <h5>Color</h5>
          <NumberField
            label="Brightness"
            value={brightness}
            min={-1}
            max={1}
            step={0.05}
            disabled={disabled}
            onChange={(v) => set({ brightness: v })}
          />
          <NumberField
            label="Contrast"
            value={contrast}
            min={0}
            max={2}
            step={0.05}
            disabled={disabled}
            onChange={(v) => set({ contrast: v })}
          />
          <NumberField
            label="Saturation"
            value={saturation}
            min={0}
            max={3}
            step={0.05}
            disabled={disabled}
            onChange={(v) => set({ saturation: v })}
          />
        </section>
      </div>
    </div>
  );
}

export default ClipEditPanel;
