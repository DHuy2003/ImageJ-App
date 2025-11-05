import { useState, useRef, useEffect } from "react";
import "./CropOverlay.css";

type CropOverlayProps = {
  onCrop: (cropArea: DOMRect) => void;
  onCancel: () => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
};

const MIN_SIZE = 50;

const CropOverlay = ({ onCrop, onCancel, imgRef }: CropOverlayProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState<null | "move" | "resize">(null);
  const [resizeDir, setResizeDir] = useState<string>("");
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showConfirm, setShowConfirm] = useState(false);
  const [cropArea, setCropArea] = useState<DOMRect | null>(null);

  // ✅ phủ toàn ảnh khi vừa mở
  useEffect(() => {
    if (!overlayRef.current || !imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    const overlay = overlayRef.current;

    overlay.style.width = `${imgRect.width}px`;
    overlay.style.height = `${imgRect.height}px`;
    overlay.style.left = `${imgRect.left}px`;
    overlay.style.top = `${imgRect.top}px`;
  }, [imgRef]);

  // --- Giữ nguyên phần di chuyển & resize ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!overlayRef.current || !imgRef.current) return;
      const overlay = overlayRef.current;
      const imgRect = imgRef.current.getBoundingClientRect();
      const rect = overlay.getBoundingClientRect();

      if (action === "move") {
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        let newLeft = rect.left + dx;
        let newTop = rect.top + dy;

        newLeft = Math.max(imgRect.left, Math.min(newLeft, imgRect.right - rect.width));
        newTop = Math.max(imgRect.top, Math.min(newTop, imgRect.bottom - rect.height));

        overlay.style.left = `${newLeft}px`;
        overlay.style.top = `${newTop}px`;
        setStartPos({ x: e.clientX, y: e.clientY });
      }

      if (action === "resize") {
        let newWidth = rect.width;
        let newHeight = rect.height;
        let newLeft = rect.left;
        let newTop = rect.top;

        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;

        if (resizeDir.includes("e")) newWidth = Math.max(MIN_SIZE, Math.min(rect.width + dx, imgRect.right - rect.left));
        if (resizeDir.includes("s")) newHeight = Math.max(MIN_SIZE, Math.min(rect.height + dy, imgRect.bottom - rect.top));
        if (resizeDir.includes("w")) {
          newWidth = Math.max(MIN_SIZE, rect.width - dx);
          newLeft = Math.min(rect.right - MIN_SIZE, Math.max(rect.left + dx, imgRect.left));
        }
        if (resizeDir.includes("n")) {
          newHeight = Math.max(MIN_SIZE, rect.height - dy);
          newTop = Math.min(rect.bottom - MIN_SIZE, Math.max(rect.top + dy, imgRect.top));
        }

        overlay.style.width = `${newWidth}px`;
        overlay.style.height = `${newHeight}px`;
        overlay.style.left = `${newLeft}px`;
        overlay.style.top = `${newTop}px`;

        setStartPos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => setAction(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [action, resizeDir, startPos]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setAction("move");
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleResizeStart = (dir: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setAction("resize");
    setResizeDir(dir);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleCrop = () => {
    if (overlayRef.current) {
      const cropRect = overlayRef.current.getBoundingClientRect();
      setCropArea(cropRect);
      setShowConfirm(true);
    }
  };

  const handleConfirmYes = () => {
    if (cropArea) onCrop(cropArea);
    setShowConfirm(false);
  };

  const handleConfirmNo = () => {
    setShowConfirm(false);
  };

  return (
    <div className="crop-container">
      <div ref={overlayRef} className="crop-overlay" onMouseDown={handleMouseDown}>
        <div className="grid-lines">
          {[...Array(4)].map((_, i) => (
            <div key={`v${i}`} className="v-line" style={{ left: `${(i * 100) / 3}%` }}></div>
          ))}
          {[...Array(4)].map((_, i) => (
            <div key={`h${i}`} className="h-line" style={{ top: `${(i * 100) / 3}%` }}></div>
          ))}
        </div>

        {/* 4 góc resize */}
        <div className="resize-handle nw" onMouseDown={handleResizeStart("nw")}></div>
        <div className="resize-handle ne" onMouseDown={handleResizeStart("ne")}></div>
        <div className="resize-handle sw" onMouseDown={handleResizeStart("sw")}></div>
        <div className="resize-handle se" onMouseDown={handleResizeStart("se")}></div>
      </div>

      <div className="crop-actions">
        <button onClick={handleCrop}>Crop</button>
        <button onClick={onCancel}>Cancel</button>
      </div>

      {showConfirm && (
        <div className="confirm-popup">
          <div className="confirm-box">
            <p>Do you want to replace the original image?</p>
            <div className="confirm-buttons">
              <button className="yes" onClick={handleConfirmYes}>Yes</button>
              <button className="no" onClick={handleConfirmNo}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CropOverlay;

