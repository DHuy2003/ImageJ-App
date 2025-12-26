import React, { useEffect, useRef, useState } from 'react';
import './NoiseDialogs.css';

type GaussianNoiseDialogProps = {
  isOpen: boolean;
  stdDev: number;
  previewEnabled: boolean;
  onStdDevChange: (value: number) => void;
  onTogglePreview: (enabled: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}

const GaussianNoiseDialog: React.FC<GaussianNoiseDialogProps> = ({
  isOpen,
  stdDev,
  previewEnabled,
  onStdDevChange,
  onTogglePreview,
  onApply,
  onCancel,
}) => {
  const dlgRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });

  useEffect(() => {
    if (!isOpen) return;
    // reset vị trí khi mở
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

  const displayStdDev = Number.isFinite(stdDev) ? stdDev : 0;
  const clampedStdDev = Math.min(100, Math.max(0, displayStdDev));
  const isValid = clampedStdDev > 0;

  const handleStdDevInputChange = (value: string) => {
    const parsed = parseFloat(value);
    if (!isFinite(parsed)) {
      onStdDevChange(0);
      return;
    }
    const clamped = Math.min(100, Math.max(0, parsed));
    onStdDevChange(clamped);
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
          <div className="noise-dialog-title">Gaussian Noise</div>
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
            <div className="noise-field-label">Standard deviation</div>
            <div className="noise-field-row">
              <input
                type="range"
                className="noise-range"
                min={0}
                max={100}
                step={0.1}
                value={clampedStdDev}
                onChange={(e) => onStdDevChange(parseFloat(e.target.value))}
              />
              <input
                type="number"
                className="noise-number-input"
                min={0}
                max={100}
                step={0.1}
                value={displayStdDev.toFixed(1)}
                onChange={(e) => handleStdDevInputChange(e.target.value)}
              />
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

export default GaussianNoiseDialog;
