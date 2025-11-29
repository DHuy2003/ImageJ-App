import type React from 'react';
import type { ImageInfo } from '../../../types/image';
import { base64ToBytes } from '../../../utils/common/formatFileSize';

type UseBrushCommitParams = {
  imgRef: React.RefObject<HTMLImageElement | null>;
  currentFile: ImageInfo | null;
  currentImageURL: string | null;
  currentIndex: number;
  setCurrentImageURL: (url: string | null) => void;
  setVisibleImages: React.Dispatch<React.SetStateAction<ImageInfo[]>>;
  pushUndo: () => void;
};

const useBrushCommit = ({
  imgRef,
  currentFile,
  currentImageURL,
  currentIndex,
  setCurrentImageURL,
  setVisibleImages,
  pushUndo,
}: UseBrushCommitParams) => {
  const handleBrushCommit = (brushCanvas: HTMLCanvasElement) => {
    const img = imgRef.current;
    if (!img || !currentFile) return;

    pushUndo();

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    if (naturalW === 0 || naturalH === 0) {
      return;
    }

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = naturalW;
    baseCanvas.height = naturalH;
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';

    let src = currentImageURL || img.currentSrc || img.src;
    if (/^https?:\/\//i.test(src)) {
      src += (src.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
    }
    image.src = src;

    image.onload = () => {
      ctx.drawImage(image, 0, 0, naturalW, naturalH);

      ctx.drawImage(
        brushCanvas,
        0,
        0,
        brushCanvas.width,
        brushCanvas.height,
        0,
        0,
        naturalW,
        naturalH,
      );

      const newSrc = baseCanvas.toDataURL('image/png');
      const base64 = newSrc.split(',')[1];
      const newSize = base64ToBytes(base64);

      setCurrentImageURL(newSrc);

      setVisibleImages(prev => {
        const copy = [...prev];
        if (copy[currentIndex]) {
          copy[currentIndex] = {
            ...copy[currentIndex],
            cropped_url: newSrc as any,
            width: currentFile.width,
            height: currentFile.height,
            size: newSize,
            bitDepth: currentFile.bitDepth ?? 8,
          } as any;
        }
        return copy;
      });

      const overlayCtx = brushCanvas.getContext('2d');
      overlayCtx?.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    };

    image.onerror = (e) => {
      console.error('Brush commit failed (CORS?): ', e, src);
      alert('Cannot apply brush strokes due to CORS/image load error.');
    };
  };

  return handleBrushCommit;
};

export default useBrushCommit;
