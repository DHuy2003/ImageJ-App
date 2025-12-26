import React, { useEffect, useRef, useState } from 'react';
import './NoiseDialogs.css';

type SaltPepperNoiseDialogProps = {
  isOpen: boolean;
  densityPercent: number;
  previewEnabled: boolean;
  onDensityChange: (value: number) => void;
  onTogglePreview: (enabled: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}

const SaltPepperNoiseDialog: React.FC<SaltPepperNoiseDialogProps> = ({
  isOpen,
  densityPercent,
  previewEnabled,
  onDensityChange,
  onTogglePreview,
  onApply,
  onCancel,
}) => {
  const dlgRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });

  useEffect(() => {
    if (!isOpen) return;
    setPos({ x: 20, y: 20 });
  }, [isOpen]);

  const clampToContainer = (nextX: number, nextY: number) => {
    const container = document.getElementById('image-view');
    const dlg = dlgRef.current;
    if (!container || !dlg) return { x: nextX, y: nextY };

    const cRect = container.getBoundingClientRect();
    const dRect = dlg.getBoundingClientRect();

    const minX = 0;
    const minY = 0;
    const maxX = cRect.width - dRect.width;
    const maxY = cRect.height - dRect.height;

    return {
      x: Math.max(minX, Math.min(nextX, maxX)),
      y: Math.max(minY, Math.min(nextY, maxY)),
    };
  };

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current.dragging = true;
    dragRef.current.dx = startX - dlg.getBoundingClientRect().left;
    dragRef.current.dy = startY - dlg.getBoundingClientRect().top;

    window.addEventListener('mousemove', onHeaderMouseMove);
    window.addEventListener('mouseup', onHeaderMouseUp, { once: true });
  };

  const onHeaderMouseMove = (e: MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const container = document.getElementById('image-view');
    const dlg = dlgRef.current;
    if (!container || !dlg) return;

    const cRect = container.getBoundingClientRect();
    const newLeft = e.clientX - cRect.left - dragRef.current.dx;
    const newTop = e.clientY - cRect.top - dragRef.current.dy;
    const clamped = clampToContainer(newLeft, newTop);
    setPos({ x: clamped.x, y: clamped.y });
  };

  const onHeaderMouseUp = () => {
    dragRef.current.dragging = false;
    window.removeEventListener('mousemove', onHeaderMouseMove);
  };

  if (!isOpen) return null;

  const displayDensity = Number.isFinite(densityPercent)
    ? densityPercent
    : 0;
  const clampedDensity = Math.min(100, Math.max(0, displayDensity));
  const isValid = clampedDensity > 0 && clampedDensity <= 100;

  const handleDensityInputChange = (value: string) => {
    const parsed = parseFloat(value);
    if (!isFinite(parsed)) {
      onDensityChange(0);
      return;
    }
    const clamped = Math.min(100, Math.max(0, parsed));
    onDensityChange(clamped);
  };

  return (
    <div className="noise-dialog-backdrop">
      <div
        ref={dlgRef}
        className="noise-dialog"
        style={{ top: pos.y, left: pos.x }}
      >
        <div
          className="noise-dialog-header"
          onMouseDown={onHeaderMouseDown}
        >
          <div className="noise-dialog-title">Salt and Pepper Noise</div>
          <button
            aria-label="Close"
            className="noise-dialog-close"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div className="noise-dialog-body">
          <div className="noise-field">
            <div className="noise-field-label">Density (%)</div>
            <div className="noise-field-row">
              <input
                type="range"
                className="noise-range"
                min={0}
                max={100}
                step={0.1}
                value={clampedDensity}
                onChange={(e) => onDensityChange(parseFloat(e.target.value))}
              />
              <input
                type="number"
                className="noise-number-input"
                min={0}
                max={100}
                step={0.1}
                value={displayDensity.toFixed(1)}
                onChange={(e) => handleDensityInputChange(e.target.value)}
              />
            </div>
            <div className="noise-help-text">
              Replaces 2.5% of pixels with black and 2.5% with white when density = 5%.
            </div>
          </div>

          <label className="noise-preview-row">
            <input
              type="checkbox"
              className="noise-checkbox"
              checked={previewEnabled}
              onChange={(e) => onTogglePreview(e.target.checked)}
            />
            <span>Preview</span>
          </label>
        </div>

        <div className="noise-dialog-footer">
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
            disabled={!isValid}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaltPepperNoiseDialog;
