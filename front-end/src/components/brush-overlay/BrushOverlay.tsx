import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { BrushOverlayProps } from '../../types/brush';
import './BrushOverlay.css';

const BrushOverlay = ({ tool, disabled, imgRef }: BrushOverlayProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(8);

  useEffect(() => {
    if (!imgRef.current || !containerRef.current || !canvasRef.current) return;
    const imgRect = imgRef.current.getBoundingClientRect();
    const parentRect = containerRef.current.getBoundingClientRect();

    const canvas = canvasRef.current;
    canvas.width = imgRect.width;
    canvas.height = imgRect.height;

    canvas.style.left = `${imgRect.left - parentRect.left}px`;
    canvas.style.top = `${imgRect.top - parentRect.top}px`;
  }, [imgRef.current]);

  if (tool !== 'brush' || disabled) {
    return (
      <div ref={containerRef} className="brush-overlay-container" />
    );
  }

  const getLocalPos = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const drawDot = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'red'; // màu cọ (tạm)
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getLocalPos(e);
    drawDot(x, y);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getLocalPos(e);
    drawDot(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  return (
    <div ref={containerRef} className="brush-overlay-container">
      <canvas
        ref={canvasRef}
        className="brush-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default BrushOverlay;
