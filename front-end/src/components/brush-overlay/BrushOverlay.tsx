import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { BrushOverlayProps } from '../../types/brush';
import './BrushOverlay.css';
import { TOOLBAR_EVENT_NAME, type ToolbarAction } from '../../utils/tool-bar/toolBarUtils';

type BrushOverlayWithCommitProps = BrushOverlayProps & {
  onCommit?: (canvas: HTMLCanvasElement) => void;
};

const BrushOverlay = ({ tool, disabled, imgRef, onCommit }: BrushOverlayWithCommitProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState('#0078d4'); 
  const hasInitializedSize = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const listener = (e: Event) => {
      const action = (e as CustomEvent<ToolbarAction>).detail;
      if (action.type === 'BRUSH_SETTINGS') {
        setBrushSize(action.settings.size);
        setBrushColor(action.settings.color);
      }
    };

    window.addEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
    return () => window.removeEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInitializedSize.current = false;
    lastPosRef.current = null;
    hasDrawnRef.current = false;
    setIsDrawing(false);
  }, [tool]);

  useEffect(() => {
    if (tool !== 'brush' || disabled) return;

    const img = imgRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!img || !container || !canvas) return;

    const updateCanvas = () => {
      if (!img || !container || !canvas) return;

      const imgRect = img.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();

      if (!hasInitializedSize.current) {
        canvas.width = imgRect.width;
        canvas.height = imgRect.height;
        hasInitializedSize.current = true;
      }

      canvas.style.width = `${imgRect.width}px`;
      canvas.style.height = `${imgRect.height}px`;
      canvas.style.left = `${imgRect.left - parentRect.left}px`;
      canvas.style.top = `${imgRect.top - parentRect.top}px`;
    };

    updateCanvas();

    img.addEventListener('load', updateCanvas);
    window.addEventListener('resize', updateCanvas);

    return () => {
      img.removeEventListener('load', updateCanvas);
      window.removeEventListener('resize', updateCanvas);
    };
  }, [tool, disabled, imgRef]);

  const getLocalPos = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width || 1;
    const scaleY = canvas.height / rect.height || 1;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = brushColor;   
    ctx.lineWidth = brushSize;      
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (disabled || tool !== 'brush') return;
    e.preventDefault();
    const pos = getLocalPos(e);
    lastPosRef.current = pos;
    hasDrawnRef.current = false;
    setIsDrawing(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || tool !== 'brush') return;
    const pos = getLocalPos(e);
    const last = lastPosRef.current;
    if (last) {
      drawLine(last, pos);
      hasDrawnRef.current = true;
    }
    lastPosRef.current = pos;
  };

  const endDrawing = () => {
    setIsDrawing(false);
    if (hasDrawnRef.current && canvasRef.current && onCommit) {
      onCommit(canvasRef.current);
    }
    lastPosRef.current = null;
    hasDrawnRef.current = false;
  };

  if (tool !== 'brush' || disabled) {
    return <div ref={containerRef} className="brush-overlay-container" />;
  }

  return (
    <div ref={containerRef} className="brush-overlay-container">
      <canvas
        ref={canvasRef}
        className="brush-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
      />
    </div>
  );
};

export default BrushOverlay;
