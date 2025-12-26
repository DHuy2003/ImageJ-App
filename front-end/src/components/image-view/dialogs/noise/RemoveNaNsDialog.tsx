import React, { useEffect, useRef, useState } from "react";
import "./NoiseDialogs.css";

type RemoveNaNsDialogProps = {
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

  const clampedRadius = Math.min(100, Math.max(0, radius));
  const radiusValid = clampedRadius >= 0 && clampedRadius <= 100;

  const handleRadiusInput = (value: string) => {
    const n = parseFloat(value);
    if (!isNaN(n)) onRadiusChange(n);
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
          <div className="noise-dialog-title">Remove NaNs...</div>
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
