import React from "react";
import "./NoiseDialogs.css";

interface RemoveNaNsDialogProps {
  isOpen: boolean;
  radius: number;
  previewEnabled: boolean;
  onRadiusChange: (value: number) => void;
  onTogglePreview: (enabled: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}

const RemoveNaNsDialog: React.FC<RemoveNaNsDialogProps> = ({
  isOpen,
  radius,
  previewEnabled,
  onRadiusChange,
  onTogglePreview,
  onApply,
  onCancel,
}) => {
  if (!isOpen) return null;

  const clampedRadius = Math.min(100, Math.max(0, radius));
  const radiusValid = clampedRadius >= 0 && clampedRadius <= 100;

  const handleRadiusInput = (value: string) => {
    const n = parseFloat(value);
    if (!isNaN(n)) onRadiusChange(n);
  };

  const handleHelp = () => {
    window.open(
      "https://imagej.net/ij/docs/menus/process.html#nans",
      "_blank",
      "noopener"
    );
  };

  return (
    <div className="noise-dialog-backdrop">
      <div className="noise-dialog">
        <div className="noise-dialog-header">
          <div className="noise-dialog-title">Remove NaNs...</div>
        </div>

        <div className="noise-dialog-body">
          <div className="noise-field">
            <div className="noise-field-label">Radius (0 – 100) pixels</div>
            <div className="noise-field-row">
              <input
                className="noise-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={clampedRadius}
                onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
              />
              <input
                className="noise-number-input"
                type="number"
                step={1}
                min={0}
                max={100}
                value={radius.toString()}
                onChange={(e) => handleRadiusInput(e.target.value)}
              />
            </div>
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
            disabled={!radiusValid}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoveNaNsDialog;
