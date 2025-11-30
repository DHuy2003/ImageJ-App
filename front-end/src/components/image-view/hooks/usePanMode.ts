import { useRef, useState, type MouseEvent } from 'react';

type UsePanModeOptions = {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  displayRef: React.RefObject<HTMLDivElement | null>;
  scaleToFit: boolean;
  zoomLevel: number;
  panMode: boolean;
};

type PanState = {
  x: number;
  y: number;
};

const usePanMode = ({
  displayRef,
  scaleToFit,
  panMode,
}: UsePanModeOptions) => {
  const [pan] = useState<PanState>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!panMode || scaleToFit) return;
    e.preventDefault();
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !lastPosRef.current || !displayRef.current) return;
    e.preventDefault();

    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };

    // Scroll the display container (kéo ngược hướng di chuyển chuột)
    displayRef.current.scrollLeft -= dx;
    displayRef.current.scrollTop -= dy;
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

  return {
    pan,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};

export default usePanMode;