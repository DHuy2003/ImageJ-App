import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type {RoiShape, RoiOverlayProps } from '../../types/roi';
import './RoiOverlay.css';


function RoiOverlay({ tool, disabled }: RoiOverlayProps) {
  const [rois, setRois] = useState<RoiShape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const currentIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (tool === 'pointer') return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    startRef.current = { x, y };

    const id = Date.now();

    const newRoi: RoiShape = {
      id,
      type: tool === 'circle' ? 'circle' : 'rect',
      x,
      y,
      width: 0,
      height: 0,
    };

    currentIdRef.current = id;
    setRois((prev) => [...prev, newRoi]);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    if (!containerRef.current || !startRef.current) return;
    if (currentIdRef.current == null) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const start = startRef.current;
    const left = Math.min(start.x, x);
    const top = Math.min(start.y, y);
    const width = Math.abs(x - start.x);
    const height = Math.abs(y - start.y);

    setRois((prev) =>
      prev.map((roi) =>
        roi.id === currentIdRef.current
          ? { ...roi, x: left, y: top, width, height }
          : roi
      )
    );
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    startRef.current = null;
    currentIdRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={`roi-overlay tool-${tool}`}
      style={{ pointerEvents: disabled ? 'none' : 'auto' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {rois.map((roi) => (
        <div
          key={roi.id}
          className={`roi-shape roi-${roi.type}`}
          style={{
            position: 'absolute',
            left: roi.x,
            top: roi.y,
            width: roi.width,
            height: roi.height,
          }}
        />
      ))}
    </div>
  );
}

export default RoiOverlay;
