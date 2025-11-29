import { useEffect, useRef, useState, type MouseEvent } from 'react';

type UsePanModeOptions = {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  scaleToFit: boolean;
  zoomLevel: number;
  panMode: boolean;
};

type PanState = {
  x: number;
  y: number;
};

const usePanMode = ({
  wrapperRef,
  imgRef,
  scaleToFit,
  zoomLevel,
  panMode,
}: UsePanModeOptions) => {
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const boundsRef = useRef<{ maxX: number; maxY: number }>({ maxX: 0, maxY: 0 });

  useEffect(() => {
    const updateBounds = () => {
      const wrapper = wrapperRef.current;
      const img = imgRef.current;
      if (!wrapper || !img) return;

      if (scaleToFit || zoomLevel <= 1) {
        boundsRef.current = { maxX: 0, maxY: 0 };
        setPan({ x: 0, y: 0 });
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      const maxX = Math.max(0, (imgRect.width - wrapperRect.width) / 2);
      const maxY = Math.max(0, (imgRect.height - wrapperRect.height) / 2);

      boundsRef.current = { maxX, maxY };

      setPan(prev => ({
        x: Math.max(-maxX, Math.min(maxX, prev.x)),
        y: Math.max(-maxY, Math.min(maxY, prev.y)),
      }));
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [wrapperRef, imgRef, scaleToFit, zoomLevel]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!panMode || scaleToFit || zoomLevel <= 1) return;
    e.preventDefault();
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !lastPosRef.current) return;
    e.preventDefault();

    const { maxX, maxY } = boundsRef.current;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };

    setPan(prev => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x + dx)),
      y: Math.max(-maxY, Math.min(maxY, prev.y + dy)),
    }));
  };

  const endPan = () => {
    setIsPanning(false);
    lastPosRef.current = null;
  };

  const handleMouseUp = () => {
    endPan();
  };

  const handleMouseLeave = () => {
    endPan();
  };

  const cursor =
    panMode && !scaleToFit && zoomLevel > 1
      ? isPanning
        ? 'grabbing'
        : 'url("/images/hand.png"), grab'
      : 'default';

  return {
    pan,
    cursor,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};

export default usePanMode;