import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { BrushOverlayProps } from '../../types/brush';
import './BrushOverlay.css';
import { TOOLBAR_EVENT_NAME, type ToolbarAction } from '../../utils/tool-bar/toolBarUtils';

type BrushOverlayWithCommitProps = BrushOverlayProps & {
  onCommit?: (canvas: HTMLCanvasElement, mode: 'brush' | 'eraser', isNewStroke?: boolean) => void;
};

const BrushOverlay = ({ tool, disabled, imgRef, onCommit }: BrushOverlayWithCommitProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(8);
  const [eraserSize, setEraserSize] = useState(16);
  const [brushColor, setBrushColor] = useState('#0078d4');
  const hasInitializedSize = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);
  const isNewStrokeRef = useRef(false);
  const lastEraserCommitTimeRef = useRef(0);
  const [eraserCursorUrl, setEraserCursorUrl] = useState<string | null>(null);

  useEffect(() => {
    const listener = (e: Event) => {
      const action = (e as CustomEvent<ToolbarAction>).detail;
      if (action.type === 'BRUSH_SETTINGS') {
        setBrushSize(action.settings.size);
        setBrushColor(action.settings.color);
      } else if (action.type === 'ERASER_SETTINGS') {
        setEraserSize(action.settings.size);
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

    if (tool === 'brush' || tool === 'eraser') {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (maskCanvasRef.current) {
      const mctx = maskCanvasRef.current.getContext('2d');
      mctx?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
    hasInitializedSize.current = false;
    lastPosRef.current = null;
    hasDrawnRef.current = false;
    setIsDrawing(false);
  }, [tool]);

  useEffect(() => {
    if ((tool !== 'brush' && tool !== 'eraser') || disabled) return;

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

      if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas');
      }
      const maskCanvas = maskCanvasRef.current;
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
    };

    updateCanvas();

    img.addEventListener('load', updateCanvas);
    window.addEventListener('resize', updateCanvas);

    return () => {
      img.removeEventListener('load', updateCanvas);
      window.removeEventListener('resize', updateCanvas);
    };
  }, [tool, disabled, imgRef]);

  useEffect(() => {
    if (tool !== 'eraser') {
      return;
    }
  
    const size = Math.max(5, Math.min(eraserSize, 64));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(38, 37, 37, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  
    const url = canvas.toDataURL('image/png');
    setEraserCursorUrl(url);
  }, [tool, eraserSize]);  

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

    if (tool === 'brush') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      return;
    }

    if (tool === 'eraser') {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      const mctx = maskCanvas.getContext('2d');
      if (!mctx) return;
    
      mctx.globalCompositeOperation = 'source-over';
      mctx.strokeStyle = 'rgba(0,0,0,1)';
      mctx.lineWidth = eraserSize;   
      mctx.lineCap = 'round';
      mctx.lineJoin = 'round';
    
      mctx.beginPath();
      mctx.moveTo(from.x, from.y);
      mctx.lineTo(to.x, to.y);
      mctx.stroke();
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (disabled || (tool !== 'brush' && tool !== 'eraser')) return;
    e.preventDefault();
    const pos = getLocalPos(e);
    lastPosRef.current = pos;
    hasDrawnRef.current = false;
    setIsDrawing(true);
    isNewStrokeRef.current = true;
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || (tool !== 'brush' && tool !== 'eraser')) return;
    const pos = getLocalPos(e);
    const last = lastPosRef.current;
    if (last) {
      drawLine(last, pos);
      hasDrawnRef.current = true;

      if (tool === 'eraser' && maskCanvasRef.current && onCommit) {
        const now = performance.now ? performance.now() : Date.now();
        const THROTTLE_MS = 60; 

        if (now - lastEraserCommitTimeRef.current >= THROTTLE_MS) {
          const isNewStroke = isNewStrokeRef.current;
          onCommit(maskCanvasRef.current, 'eraser', isNewStroke);
          lastEraserCommitTimeRef.current = now;

          if (isNewStroke) {
            isNewStrokeRef.current = false;
          }
        }
      }
    }
    lastPosRef.current = pos;
  };

  const endDrawing = () => {
    setIsDrawing(false);
  
    if (hasDrawnRef.current && onCommit) {
      if (tool === 'brush' && canvasRef.current) {
        onCommit(canvasRef.current, 'brush', true);
      } else if (tool === 'eraser' && maskCanvasRef.current) {       
        onCommit(maskCanvasRef.current, 'eraser', false);
      }
    }
  
    lastPosRef.current = null;
    hasDrawnRef.current = false;
    isNewStrokeRef.current = false;
    lastEraserCommitTimeRef.current = 0;
  };  

  if ((tool !== 'brush' && tool !== 'eraser') || disabled) {
    return <div ref={containerRef} className="brush-overlay-container" />;
  }

  return (
    <div ref={containerRef} className="brush-overlay-container">
      <canvas
        ref={canvasRef}
        className={`brush-canvas ${tool === 'eraser' ? 'eraser-mode' : 'brush-mode'}`}
        style={
          tool === 'eraser' && eraserCursorUrl
            ? {
                cursor: `url(${eraserCursorUrl}) ${Math.round(
                  eraserSize / 2,
                )} ${Math.round(eraserSize / 2)}, crosshair`,
              }
            : tool === 'brush'
            ? {
                cursor: "url('/images/pencil.png') 4 20, crosshair",
              }
            : undefined
        }
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
      />
    </div>
  );
};

export default BrushOverlay;
