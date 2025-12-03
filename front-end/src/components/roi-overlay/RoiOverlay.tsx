import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { showSelectionRequired, type ResizeHandle, type RoiOverlayProps, type RoiShape } from '../../types/roi';
import './RoiOverlay.css';

const RoiOverlay = ({ tool, disabled, imgRef, frameIndex }: RoiOverlayProps) =>{
  const [rois, setRois] = useState<RoiShape[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeRoiIdRef = useRef<number | null>(null);
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeStartRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const moveStartRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const moveStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const lastRoiRef = useRef<RoiShape | null>(null);
  const canDraw = !disabled && tool !== 'pointer' && tool !== 'brush' && tool !== 'eraser';
  const canInteract = !disabled;
  const getBounds = () => {
    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();

    if (imgRef?.current) {
      const imgRect = imgRef.current.getBoundingClientRect();
      return {
        left: imgRect.left - containerRect.left,
        top: imgRect.top - containerRect.top,
        right: imgRect.right - containerRect.left,
        bottom: imgRect.bottom - containerRect.top,
      };
    }

    return {
      left: 0,
      top: 0,
      right: containerRect.width,
      bottom: containerRect.height,
    };
  };

  const toLocalClamped = (e: MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const bounds = getBounds();

    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (bounds) {
      x = Math.max(bounds.left, Math.min(x, bounds.right));
      y = Math.max(bounds.top, Math.min(y, bounds.bottom));
    }

    return { x, y };
  };

  const clampRectToBounds = (rectInput: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const bounds = getBounds();
    if (!bounds) return rectInput;

    let { x, y, width, height } = rectInput;

    width = Math.max(1, width);
    height = Math.max(1, height);

    if (x < bounds.left) {
      const diff = bounds.left - x;
      x = bounds.left;
      width = Math.max(1, width - diff);
    }
    if (y < bounds.top) {
      const diff = bounds.top - y;
      y = bounds.top;
      height = Math.max(1, height - diff);
    }

    if (x + width > bounds.right) {
      width = Math.max(1, bounds.right - x);
    }
    if (y + height > bounds.bottom) {
      height = Math.max(1, bounds.bottom - y);
    }

    return { x, y, width, height };
  };

  const clampRectToBoundsForMove = (rectInput: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const bounds = getBounds();
    if (!bounds) return rectInput;
  
    let { x, y, width, height } = rectInput;
  
    width = Math.max(1, width);
    height = Math.max(1, height);
    x = Math.max(bounds.left, Math.min(x, bounds.right - width));
    y = Math.max(bounds.top, Math.min(y, bounds.bottom - height));
  
    return { x, y, width, height };
  };

  useEffect(() => {
    setRois([]);
    setSelectedId(null);
    setIsDrawing(false);
    setIsResizing(false);
    setIsMoving(false);

    activeRoiIdRef.current = null;
    drawStartRef.current = null;
    resizeHandleRef.current = null;
    resizeStartMouseRef.current = null;
    resizeStartRectRef.current = null;
    moveStartMouseRef.current = null;
    moveStartRectRef.current = null;

    const evt = new CustomEvent('roiSelection', { detail: null });
    window.dispatchEvent(evt);
  }, [frameIndex]);

  useEffect(() => {
    if (!disabled) return;
  
    setRois([]);
    setSelectedId(null);
    setIsDrawing(false);
    setIsResizing(false);
    setIsMoving(false);
  
    activeRoiIdRef.current = null;
    drawStartRef.current = null;
    resizeHandleRef.current = null;
    resizeStartMouseRef.current = null;
    resizeStartRectRef.current = null;
    moveStartMouseRef.current = null;
    moveStartRectRef.current = null;
  
    const evt = new CustomEvent('roiSelection', { detail: null });
    window.dispatchEvent(evt);
  }, [disabled]);  

  useEffect(() => {
    const onSelectAll = () => {
      const bounds = getBounds();
      if (!bounds) return;
      if (rois.length > 0) {
        lastRoiRef.current = rois[0];
      }

      const id = Date.now();
      const newRoi: RoiShape = {
        id,

        type: 'rect',
        x: bounds.left,
        y: bounds.top,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
      };

      activeRoiIdRef.current = id;
      drawStartRef.current = null;
      resizeHandleRef.current = null;
      resizeStartMouseRef.current = null;
      resizeStartRectRef.current = null;
      moveStartMouseRef.current = null;
      moveStartRectRef.current = null;

      setIsDrawing(false);
      setIsResizing(false);
      setIsMoving(false);

      setSelectedId(id);
      setRois([newRoi]);
    };

    const onSelectNone = () => {
      if (rois.length > 0) {
        lastRoiRef.current = rois[0];
      }

      activeRoiIdRef.current = null;
      drawStartRef.current = null;
      resizeHandleRef.current = null;
      resizeStartMouseRef.current = null;
      resizeStartRectRef.current = null;
      moveStartMouseRef.current = null;
      moveStartRectRef.current = null;

      setIsDrawing(false);
      setIsResizing(false);
      setIsMoving(false);
      setSelectedId(null);
      setRois([]);
    };

    window.addEventListener('editSelectAll', onSelectAll);
    window.addEventListener('editSelectNone', onSelectNone);
    return () => {
      window.removeEventListener('editSelectAll', onSelectAll);
      window.removeEventListener('editSelectNone', onSelectNone);
    };
  }, []);

  useEffect(() => {
    const onRotate = (e: Event) => {
      const ce = e as CustomEvent<{ angleDeg?: number }>;
      const delta = ce.detail?.angleDeg ?? 0;
      if (!delta) return;
      if (selectedId === null) return;

      setRois(prev =>
        prev.map(roi =>
          roi.id === selectedId
            ? {
                ...roi,
                angle: (((roi.angle ?? 0) + delta) % 360 + 360) % 360, 
              }
            : roi
        )
      );
    };

    window.addEventListener('roiRotate', onRotate as EventListener);
    return () => window.removeEventListener('roiRotate', onRotate as EventListener);
  }, [selectedId]);

  useEffect(() => {
    if (!imgRef?.current || !containerRef.current) {
      const evt = new CustomEvent('roiSelection', { detail: null });
      window.dispatchEvent(evt);
      return;
    }
  
    const bounds = getBounds();
    if (!bounds) {
      const evt = new CustomEvent('roiSelection', { detail: null });
      window.dispatchEvent(evt);
      return;
    }
  
    const img = imgRef.current;
    const displayWidth = bounds.right - bounds.left;
    const displayHeight = bounds.bottom - bounds.top;
  
    if (displayWidth <= 0 || displayHeight <= 0) {
      const evt = new CustomEvent('roiSelection', { detail: null });
      window.dispatchEvent(evt);
      return;
    }
  
    const selected = rois.find((r) => r.id === selectedId) || null;
  
    if (!selected) {
      const evt = new CustomEvent('roiSelection', { detail: null });
      window.dispatchEvent(evt);
      return;
    }
  
    const scaleX = img.naturalWidth / displayWidth;
    const scaleY = img.naturalHeight / displayHeight;
  
    const localX = selected.x - bounds.left;
    const localY = selected.y - bounds.top;
  
    const imageRect = {
      x: localX * scaleX,
      y: localY * scaleY,
      width: selected.width * scaleX,
      height: selected.height * scaleY,
    };
  
    const evt = new CustomEvent('roiSelection', {
      detail: {
        id: selected.id,
        type: selected.type,
        imageRect,
      },
    });
  
    window.dispatchEvent(evt);
  }, [rois, selectedId, imgRef]);  

  useEffect(() => {
    const getCurrentRoi = (): RoiShape | null => {
      if (rois.length === 0) return null;
      const bySelected = selectedId != null ? rois.find(r => r.id === selectedId) : null;
      return bySelected || rois[0] || null;
    };

    const onRestoreSelection = () => {
      if (disabled) return;
      const last = lastRoiRef.current;
      if (!last) return;

      const clamped = clampRectToBounds({
        x: last.x,
        y: last.y,
        width: last.width,
        height: last.height,
      });

      const id = Date.now();
      const restored: RoiShape = { ...last, ...clamped, id };

      activeRoiIdRef.current = id;
      setSelectedId(id);
      setRois([restored]);
    };

    const onFitCircle = () => {
      if (disabled) return;
      const roi = getCurrentRoi();
      if (!roi) {
        showSelectionRequired();
        return;
      }

      lastRoiRef.current = roi;

      const centerX = roi.x + roi.width / 2;
      const centerY = roi.y + roi.height / 2;
      const size = Math.min(roi.width, roi.height);
      let x = centerX - size / 2;
      let y = centerY - size / 2;

      const clamped = clampRectToBounds({
        x,
        y,
        width: size,
        height: size,
      });

      const updated: RoiShape = { ...roi, ...clamped, type: 'circle' };
      setSelectedId(updated.id);
      setRois([updated]);
    };

    const onFitRectangle = () => {
      if (disabled) return;
      const roi = getCurrentRoi();
      if (!roi) {
        showSelectionRequired();
        return;
      }

      lastRoiRef.current = roi;

      const updated: RoiShape = { ...roi, type: 'rect' };
      const clamped = clampRectToBounds({
        x: updated.x,
        y: updated.y,
        width: updated.width,
        height: updated.height,
      });

      setSelectedId(updated.id);
      setRois([{ ...updated, ...clamped }]);
    };

    const onScale = (e: Event) => {
      if (disabled) return;
      const ce = e as CustomEvent<{ sx: number; sy: number }>;
      const sx = ce.detail?.sx ?? 1;
      const sy = ce.detail?.sy ?? 1;
    
      if (sx <= 0 || sy <= 0) return;
    
      const roi = getCurrentRoi();
      if (!roi) {
        showSelectionRequired();
        return;
      }
      lastRoiRef.current = roi;
    
      const centerX = roi.x + roi.width / 2;
      const centerY = roi.y + roi.height / 2;
    
      const newW = roi.width * sx;
      const newH = roi.height * sy;
    
      const x = centerX - newW / 2;
      const y = centerY - newH / 2;
    
      const clamped = clampRectToBounds({
        x,
        y,
        width: newW,
        height: newH,
      });
    
      const updated: RoiShape = { ...roi, ...clamped };
      setSelectedId(updated.id);
      setRois([updated]);
    };
    

    window.addEventListener('editRestoreSelection', onRestoreSelection);
    window.addEventListener('editFitCircle', onFitCircle);
    window.addEventListener('editFitRectangle', onFitRectangle);
    window.addEventListener('editScale', onScale as EventListener);

    return () => {
      window.removeEventListener('editRestoreSelection', onRestoreSelection);
      window.removeEventListener('editFitCircle', onFitCircle);
      window.removeEventListener('editFitRectangle', onFitRectangle);
      window.removeEventListener('editScale', onScale as EventListener);
    };
  }, [disabled, rois, selectedId]);

  const handleMouseDownContainer = (e: MouseEvent<HTMLDivElement>) => {
    if (!canDraw) return;
    if (!containerRef.current) return;
    if (isMoving || isResizing) return;
    if (rois.length > 0) {
      lastRoiRef.current = rois[0];
    }

    const { x, y } = toLocalClamped(e);

    setIsDrawing(true);
    drawStartRef.current = { x, y };

    const id = Date.now();
    const newRoi: RoiShape = {
      id,
      type: tool === 'circle' ? 'circle' : 'rect',
      x,
      y,
      width: 0,
      height: 0,
    };

    activeRoiIdRef.current = id;
    setSelectedId(id);
    setRois([newRoi]);
  };

  const handleMouseMoveContainer = (e: MouseEvent<HTMLDivElement>) => {
    if (isResizing && canInteract) {
      if (
        !resizeHandleRef.current ||
        !resizeStartRectRef.current ||
        !resizeStartMouseRef.current ||
        activeRoiIdRef.current == null
      ) {
        return;
      }

      const { x, y } = toLocalClamped(e);
      const startMouse = resizeStartMouseRef.current;
      const baseRect = resizeStartRectRef.current;
      const handle = resizeHandleRef.current;

      const dx = x - startMouse.x;
      const dy = y - startMouse.y;

      let newX = baseRect.x;
      let newY = baseRect.y;
      let newW = baseRect.width;
      let newH = baseRect.height;

      if (handle === 'e' || handle === 'ne' || handle === 'se') {
        newW = baseRect.width + dx;
      }
      if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        newX = baseRect.x + dx;
        newW = baseRect.width - dx;
      }
      if (handle === 's' || handle === 'se' || handle === 'sw') {
        newH = baseRect.height + dy;
      }
      if (handle === 'n' || handle === 'ne' || handle === 'nw') {
        newY = baseRect.y + dy;
        newH = baseRect.height - dy;
      }

      const clamped = clampRectToBounds({
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });

      setRois((prev) =>
        prev.map((roi) =>
          roi.id === activeRoiIdRef.current
            ? { ...roi, ...clamped }
            : roi
        )
      );

      return;
    }

    if (isMoving && canInteract) {
      if (
        !moveStartRectRef.current ||
        !moveStartMouseRef.current ||
        activeRoiIdRef.current == null
      ) {
        return;
      }

      const { x, y } = toLocalClamped(e);
      const baseRect = moveStartRectRef.current;
      const startMouse = moveStartMouseRef.current;

      const dx = x - startMouse.x;
      const dy = y - startMouse.y;

      const clamped = clampRectToBoundsForMove({
        x: baseRect.x + dx,
        y: baseRect.y + dy,
        width: baseRect.width,
        height: baseRect.height,
      });

      setRois((prev) =>
        prev.map((roi) =>
          roi.id === activeRoiIdRef.current
            ? { ...roi, ...clamped }
            : roi
        )
      );

      return;
    }

    if (isDrawing && canDraw) {
      if (!drawStartRef.current || activeRoiIdRef.current == null) return;

      const { x, y } = toLocalClamped(e);
      const start = drawStartRef.current;

      const left = Math.min(start.x, x);
      const top = Math.min(start.y, y);
      const width = Math.abs(x - start.x);
      const height = Math.abs(y - start.y);

      const clamped = clampRectToBounds({ x: left, y: top, width, height });

      setRois((prev) =>
        prev.map((roi) =>
          roi.id === activeRoiIdRef.current
            ? { ...roi, ...clamped }
            : roi
        )
      );
    }
  };

  const handleMouseUpContainer = () => {
    if (isDrawing) {
      setIsDrawing(false);
      drawStartRef.current = null;
      activeRoiIdRef.current = null;
    }

    if (isResizing) {
      setIsResizing(false);
      resizeHandleRef.current = null;
      resizeStartMouseRef.current = null;
      resizeStartRectRef.current = null;
      activeRoiIdRef.current = null;
    }

    if (isMoving) {
      setIsMoving(false);
      moveStartMouseRef.current = null;
      moveStartRectRef.current = null;
      activeRoiIdRef.current = null;
    }
  };

  const startResize = (
    e: MouseEvent<HTMLDivElement>,
    roiId: number,
    handle: ResizeHandle
  ) => {
    if (!canInteract) return;
    e.stopPropagation();
    e.preventDefault();

    const { x, y } = toLocalClamped(e);
    const roi = rois.find((r) => r.id === roiId);
    if (!roi) return;

    lastRoiRef.current = roi;
    setSelectedId(roiId);
    setIsResizing(true);
    setIsDrawing(false);
    setIsMoving(false);

    activeRoiIdRef.current = roiId;
    resizeHandleRef.current = handle;
    resizeStartMouseRef.current = { x, y };
    resizeStartRectRef.current = {
      x: roi.x,
      y: roi.y,
      width: roi.width,
      height: roi.height,
    };
  };

  const startMove = (e: MouseEvent<HTMLDivElement>, roiId: number) => {
    if (disabled) return;
  
    const roi = rois.find((r) => r.id === roiId);
    if (!roi) return;

    lastRoiRef.current = roi;
  
    if (tool !== 'pointer') {
      const bounds = getBounds();
      if (bounds) {
        const eps = 1;
        const coversFull =
          Math.abs(roi.x - bounds.left) <= eps &&
          Math.abs(roi.y - bounds.top) <= eps &&
          Math.abs(roi.x + roi.width - bounds.right) <= eps &&
          Math.abs(roi.y + roi.height - bounds.bottom) <= eps;
  
        if (coversFull) {
          return;
        }
      }
    }
  
    if (!canInteract) return;
  
    e.stopPropagation();
    e.preventDefault();
  
    const { x, y } = toLocalClamped(e);
  
    setSelectedId(roiId);
    setIsMoving(true);
    setIsDrawing(false);
    setIsResizing(false);
  
    activeRoiIdRef.current = roiId;
    moveStartMouseRef.current = { x, y };
    moveStartRectRef.current = {
      x: roi.x,
      y: roi.y,
      width: roi.width,
      height: roi.height,
    };
  }; 

  useEffect(() => {
    if (tool === 'brush' || tool === 'eraser') {
      setRois([]);
      setSelectedId(null);
      setIsDrawing(false);
      setIsResizing(false);
      setIsMoving(false);
    }
  }, [tool]);
  
  const containerClass = [
    'roi-overlay',
    `tool-${tool}`,
    disabled ? 'roi-disabled' : 'roi-enabled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={containerClass}
      onMouseDown={handleMouseDownContainer}
      onMouseMove={handleMouseMoveContainer}
      onMouseUp={handleMouseUpContainer}
    >
      {tool !== 'brush' && tool !== 'eraser' &&
        rois.map((roi) => {
          const isSelected = roi.id === selectedId;
          return (
            <div
              key={roi.id}
              className={`roi-shape roi-${roi.type} ${
                isSelected ? 'roi-selected' : ''
              }`}
              style={{
                left: roi.x,
                top: roi.y,
                width: roi.width,
                height: roi.height,
                transform: roi.angle ? `rotate(${roi.angle}deg)` : undefined,
                transformOrigin: 'center center',
              }}
              onMouseDown={(e) => startMove(e, roi.id)}
            >
              <div
                className="roi-handle handle-nw"
                onMouseDown={(e) => startResize(e, roi.id, 'nw')}
              />
              <div
                className="roi-handle handle-n"
                onMouseDown={(e) => startResize(e, roi.id, 'n')}
              />
              <div
                className="roi-handle handle-ne"
                onMouseDown={(e) => startResize(e, roi.id, 'ne')}
              />
              <div
                className="roi-handle handle-e"
                onMouseDown={(e) => startResize(e, roi.id, 'e')}
              />
              <div
                className="roi-handle handle-se"
                onMouseDown={(e) => startResize(e, roi.id, 'se')}
              />
              <div
                className="roi-handle handle-s"
                onMouseDown={(e) => startResize(e, roi.id, 's')}
              />
              <div
                className="roi-handle handle-sw"
                onMouseDown={(e) => startResize(e, roi.id, 'sw')}
              />
              <div
                className="roi-handle handle-w"
                onMouseDown={(e) => startResize(e, roi.id, 'w')}
              />
            </div>
          );
        })}
    </div>
  );  
}

export default RoiOverlay;