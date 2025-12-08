import React from "react";
import "./NoiseDialogs.css";

export type OutlierMode = "bright" | "dark" | "both";

interface RemoveOutliersDialogProps {
  isOpen: boolean;
  radius: number;
  threshold: number;
  mode: OutlierMode;
  previewEnabled: boolean;
  onRadiusChange: (value: number) => void;
  onThresholdChange: (value: number) => void;
  onModeChange: (mode: OutlierMode) => void;
  onTogglePreview: (enabled: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}

const RemoveOutliersDialog: React.FC<RemoveOutliersDialogProps> = ({
  isOpen,
  radius,
  threshold,
  mode,
  previewEnabled,
  onRadiusChange,
  onThresholdChange,
  onModeChange,
  onTogglePreview,
  onApply,
  onCancel,
}) => {
  if (!isOpen) return null;

  const clampedRadius = Math.min(25, Math.max(0.5, radius));
  const clampedThreshold = Math.min(100, Math.max(0, threshold));

  const radiusValid = clampedRadius >= 0.5 && clampedRadius <= 25;
  const thresholdValid = clampedThreshold >= 0 && clampedThreshold <= 100;

  const handleRadiusInput = (value: string) => {
    const n = parseFloat(value);
    if (!isNaN(n)) onRadiusChange(n);
  };

  const handleThresholdInput = (value: string) => {
    const n = parseFloat(value);
    if (!isNaN(n)) onThresholdChange(n);
  };

  const handleHelp = () => {
    window.open(
      "https://imagej.net/ij/docs/menus/process.html#outliers",
      "_blank",
      "noopener"
    );
  };

  return (
    <div className="noise-dialog-backdrop">
      <div className="noise-dialog">
        <div className="noise-dialog-header">
          <div className="noise-dialog-title">Remove Outliers...</div>
        </div>

        <div className="noise-dialog-body">
          <div className="noise-field">
            <div className="noise-field-label">Radius (0.5 – 25)</div>
            <div className="noise-field-row">
              <input
                className="noise-range"
                type="range"
                min={0.5}
                max={25}
                step={0.5}
                value={clampedRadius}
                onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
              />
              <input
                className="noise-number-input"
                type="number"
                step={0.5}
                min={0.5}
                max={25}
                value={radius.toString()}
                onChange={(e) => handleRadiusInput(e.target.value)}
              />
            </div>
          </div>

          <div className="noise-field">
            <div className="noise-field-label">Threshold (0 – 100)</div>
            <div className="noise-field-row">
              <input
                className="noise-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={clampedThreshold}
                onChange={(e) =>
                  onThresholdChange(parseFloat(e.target.value))
                }
              />
              <input
                className="noise-number-input"
                type="number"
                step={1}
                min={0}
                max={100}
                value={threshold.toString()}
                onChange={(e) => handleThresholdInput(e.target.value)}
              />
            </div>
          </div>

          <div className="noise-field">
            <div className="noise-field-label">Which outliers</div>
            <select
              className="noise-select"
              value={mode}
              onChange={(e) => onModeChange(e.target.value as OutlierMode)}
            >
              <option value="bright">Bright</option>
              <option value="dark">Dark</option>
              <option value="both">Both</option>
            </select>
          </div>

          <label className="noise-preview-row">
            <input
              className="noise-checkbox"
              type="checkbox"
              checked={previewEnabled}
              onChange={(e) => onTogglePreview(e.target.checked)}
            />
            <span>Preview</span>
          </label>
        </div>

        <div className="noise-dialog-footer">
          <button
            type="button"
            className="noise-btn noise-btn-help"
            onClick={handleHelp}
          >
            Help
          </button>

          <button
            type="button"
            className="noise-btn noise-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="noise-btn noise-btn-primary"
            onClick={onApply}
            disabled={!radiusValid || !thresholdValid}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoveOutliersDialog;
