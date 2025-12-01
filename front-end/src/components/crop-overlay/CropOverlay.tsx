import { useState, useRef, useEffect, useCallback, useLayoutEffect, forwardRef, useImperativeHandle } from "react";
import "./CropOverlay.css";
import type { CropOverlayProps, CropOverlayHandle } from '../../types/crop';

const MIN_SIZE = 50;

const CropOverlay = forwardRef<CropOverlayHandle, CropOverlayProps>(({ imgRef }, ref) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState<null | "move" | "resize">(null);
  const [resizeDir, setResizeDir] = useState<string>("");
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const relBoxRef = useRef({ left: 0, top: 0, width: 1, height: 1 });

  useImperativeHandle(ref, () => ({
    getRect: () => overlayRef.current?.getBoundingClientRect() ?? null,
    getRelativeRect: () => {
      if (!overlayRef.current || !imgRef.current) return null;
      const o = overlayRef.current.getBoundingClientRect();
      const i = imgRef.current.getBoundingClientRect();
      if (i.width === 0 || i.height === 0) return null;
      return {
        left: (o.left - i.left) / i.width,
        top: (o.top - i.top) / i.height,
        width: o.width / i.width,
        height: o.height / i.height,
      };
    },
  }), [imgRef]);

  const computeRelativeFromDom = useCallback(() => {
    if (!overlayRef.current || !imgRef.current) return;
    const overlayRect = overlayRef.current.getBoundingClientRect();
    const imgRect = imgRef.current.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;

    relBoxRef.current = {
      left: (overlayRect.left - imgRect.left) / imgRect.width,
      top: (overlayRect.top - imgRect.top) / imgRect.height,
      width: overlayRect.width / imgRect.width,
      height: overlayRect.height / imgRect.height,
    };
  }, [imgRef]);

  const applyRelativeToDom = useCallback(() => {
    if (!overlayRef.current || !imgRef.current) return;
    const overlay = overlayRef.current;
    const imgRect = imgRef.current.getBoundingClientRect();
    const parentRect = overlay.parentElement!.getBoundingClientRect();
  
    const r = relBoxRef.current;
    const newLeft = (imgRect.left - parentRect.left) + r.left * imgRect.width;
    const newTop = (imgRect.top - parentRect.top) + r.top * imgRect.height;
    const newWidth = r.width * imgRect.width;
    const newHeight = r.height * imgRect.height;
  
    overlay.style.left = `${Math.round(newLeft)}px`;
    overlay.style.top = `${Math.round(newTop)}px`;
    overlay.style.width = `${Math.round(newWidth)}px`;
    overlay.style.height = `${Math.round(newHeight)}px`;
  }, [imgRef]);

  useLayoutEffect(() => {
    if (!overlayRef.current || !imgRef.current) return;
    const overlay = overlayRef.current;
    const imgRect = imgRef.current.getBoundingClientRect();
    const parentRect = overlay.parentElement!.getBoundingClientRect();

    const width = Math.round(imgRect.width);
    const height = Math.round(imgRect.height);
    const left = Math.round(imgRect.left - parentRect.left);
    const top = Math.round(imgRect.top - parentRect.top);

    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;

    relBoxRef.current = { left: 0, top: 0, width: 1, height: 1 };

    const roImg = new ResizeObserver(() => applyRelativeToDom());
    roImg.observe(imgRef.current);

    const roParent = new ResizeObserver(() => applyRelativeToDom());
    roParent.observe(overlay.parentElement!);

    const onResizeOrScroll = () => applyRelativeToDom();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    const vv: any = (window as any).visualViewport;
    vv?.addEventListener?.("resize", onResizeOrScroll);
    vv?.addEventListener?.("scroll", onResizeOrScroll);

    return () => {
      roImg.disconnect();
      roParent.disconnect();
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
      vv?.removeEventListener?.("resize", onResizeOrScroll);
      vv?.removeEventListener?.("scroll", onResizeOrScroll);
    };
  }, [imgRef, applyRelativeToDom]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!overlayRef.current || !imgRef.current) return;
      const overlay = overlayRef.current;
      const imgRect = imgRef.current.getBoundingClientRect();
      const cropContainerRect = overlay.parentElement!.getBoundingClientRect();

      const rect = overlay.getBoundingClientRect();
      const relativeRect = {
        left: rect.left - cropContainerRect.left,
        top: rect.top - cropContainerRect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right - cropContainerRect.left,
        bottom: rect.bottom - cropContainerRect.top,
      };

      const relativeImgRect = {
        left: imgRect.left - cropContainerRect.left,
        top: imgRect.top - cropContainerRect.top,
        width: imgRect.width,
        height: imgRect.height,
        right: imgRect.right - cropContainerRect.left,
        bottom: imgRect.bottom - cropContainerRect.top,
      };

      if (action === "move") {
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        let newLeft = relativeRect.left + dx;
        let newTop = relativeRect.top + dy;

        newLeft = Math.max(relativeImgRect.left, Math.min(newLeft, relativeImgRect.right - relativeRect.width));
        newTop = Math.max(relativeImgRect.top, Math.min(newTop, relativeImgRect.bottom - relativeRect.height));

        overlay.style.left = `${Math.round(newLeft)}px`;
        overlay.style.top = `${Math.round(newTop)}px`;
        setStartPos({ x: e.clientX, y: e.clientY });
      }

      if (action === "resize") {
        let newWidth = relativeRect.width;
        let newHeight = relativeRect.height;
        let newLeft = relativeRect.left;
        let newTop = relativeRect.top;

        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;

        if (resizeDir.includes("e")) {
          const maxWidth = relativeImgRect.right - relativeRect.left;
          newWidth = Math.max(MIN_SIZE, Math.min(relativeRect.width + dx, maxWidth));
        }
      
        if (resizeDir.includes("s")) {
          const maxHeight = relativeImgRect.bottom - relativeRect.top;
          newHeight = Math.max(
            MIN_SIZE,
            Math.min(relativeRect.height + dy, maxHeight)
          );
        }

        if (resizeDir.includes("w")) {
          const potentialNewWidth = relativeRect.width - dx;
          const potentialNewLeft = relativeRect.left + dx;
          if (potentialNewWidth >= MIN_SIZE && potentialNewLeft >= relativeImgRect.left) {
            newWidth = potentialNewWidth;
            newLeft = potentialNewLeft;
          } else if (potentialNewWidth < MIN_SIZE) {
            newWidth = MIN_SIZE;
            newLeft = relativeRect.right - MIN_SIZE;
          } else if (potentialNewLeft < relativeImgRect.left) {
            newLeft = relativeImgRect.left;
            newWidth = relativeRect.right - relativeImgRect.left;
          }
        }
        
        if (resizeDir.includes("n")) {
          const potentialNewHeight = relativeRect.height - dy;
          const potentialNewTop = relativeRect.top + dy;
          if (potentialNewHeight >= MIN_SIZE && potentialNewTop >= relativeImgRect.top) {
            newHeight = potentialNewHeight;
            newTop = potentialNewTop;
          } else if (potentialNewHeight < MIN_SIZE) {
            newHeight = MIN_SIZE;
            newTop = relativeRect.bottom - MIN_SIZE;
          } else if (potentialNewTop < relativeImgRect.top) {
            newTop = relativeImgRect.top;
            newHeight = relativeRect.bottom - relativeImgRect.top;
          }
        }

        overlay.style.width = `${Math.round(newWidth)}px`;
        overlay.style.height = `${Math.round(newHeight)}px`;
        overlay.style.left = `${Math.round(newLeft)}px`;
        overlay.style.top = `${Math.round(newTop)}px`;

        setStartPos({ x: e.clientX, y: e.clientY });
      }

      if (action) computeRelativeFromDom();
    };

    const handleMouseUp = () => {
      setAction(null);
      computeRelativeFromDom();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [action, resizeDir, startPos, imgRef, computeRelativeFromDom]);

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

  return (
    <div className="crop-container">
      <div ref={overlayRef} className="crop-overlay" onMouseDown={handleMouseDown}>
        <div className="grid-lines">
          {[...Array(2)].map((_, i) => (
            <div
              key={`v${i}`}
              className="v-line"
              style={{ left: `${((i + 1) * 100) / 3}%` }}  // 33.3%, 66.6%
            />
          ))}

          {[...Array(2)].map((_, i) => (
            <div
              key={`h${i}`}
              className="h-line"
              style={{ top: `${((i + 1) * 100) / 3}%` }}   // 33.3%, 66.6%
            />
          ))}
        </div>

        <div className="crop-resize-handle nw" onMouseDown={handleResizeStart("nw")}></div>
        <div className="crop-resize-handle ne" onMouseDown={handleResizeStart("ne")}></div>
        <div className="crop-resize-handle sw" onMouseDown={handleResizeStart("sw")}></div>
        <div className="crop-resize-handle se" onMouseDown={handleResizeStart("se")}></div>
        <div className="crop-resize-handle n" onMouseDown={handleResizeStart("n")}></div>
        <div className="crop-resize-handle s" onMouseDown={handleResizeStart("s")}></div>
        <div className="crop-resize-handle e" onMouseDown={handleResizeStart("e")}></div>
        <div className="crop-resize-handle w" onMouseDown={handleResizeStart("w")}></div>
      </div>
    </div>
  );
});

export default CropOverlay;
