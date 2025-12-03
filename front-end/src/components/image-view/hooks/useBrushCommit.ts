import React, { useRef } from 'react';
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
  const brushBaseImageRef = useRef<string | null>(null);
  const handleBrushCommit = (
    brushCanvas: HTMLCanvasElement,
    mode: 'brush' | 'eraser' = 'brush',
    isNewStroke = false,
  ) => {
    const img = imgRef.current;
    if (!img || !currentFile) return;
  
    if (isNewStroke) {
       pushUndo();
    }
  
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (naturalW === 0 || naturalH === 0) return;
  
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = naturalW;
    baseCanvas.height = naturalH;
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) return;

    let currentSrc = currentImageURL || img.currentSrc || img.src;
    if (/^https?:\/\//i.test(currentSrc)) {
      currentSrc += (currentSrc.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
    }

    if (!brushBaseImageRef.current) {
      brushBaseImageRef.current = currentSrc;
    }
  
    const currentImage = new Image();
    currentImage.crossOrigin = 'anonymous';
    currentImage.referrerPolicy = 'no-referrer';
    currentImage.src = currentSrc;
  
    const finalize = () => {
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

    if (mode === 'brush') {
      currentImage.onload = () => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(currentImage, 0, 0, naturalW, naturalH);
  
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
  
        finalize();
      };
  
      currentImage.onerror = (e) => {
        console.error('Brush commit failed (CORS?): ', e, currentSrc);
        alert('Cannot apply brush strokes due to CORS/image load error.');
      };
  
      return;
    }

    const baseSrcRaw = brushBaseImageRef.current || currentSrc;
    let baseSrc = baseSrcRaw;
    if (/^https?:\/\//i.test(baseSrc)) {
      baseSrc += (baseSrc.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
    }
  
    const baseImage = new Image();
    baseImage.crossOrigin = 'anonymous';
    baseImage.referrerPolicy = 'no-referrer';
    baseImage.src = baseSrc;
  
    let loadedCount = 0;
    const tryCompose = () => {
      if (loadedCount < 2) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, naturalW, naturalH);
      ctx.drawImage(currentImage, 0, 0, naturalW, naturalH);

      const patchCanvas = document.createElement('canvas');
      patchCanvas.width = naturalW;
      patchCanvas.height = naturalH;
      const patchCtx = patchCanvas.getContext('2d');
      if (!patchCtx) return;

      patchCtx.globalCompositeOperation = 'source-over';
      patchCtx.drawImage(baseImage, 0, 0, naturalW, naturalH);
      patchCtx.globalCompositeOperation = 'destination-in';
      patchCtx.drawImage(
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

      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(patchCanvas, 0, 0, naturalW, naturalH);

      finalize();
    };
  
    currentImage.onload = () => {
      loadedCount += 1;
      tryCompose();
    };
    baseImage.onload = () => {
      loadedCount += 1;
      tryCompose();
    };
  
    const onError = (e: any) => {
      console.error('Eraser commit failed (CORS?): ', e, { currentSrc, baseSrc });
      alert('Cannot apply eraser due to CORS/image load error.');
    };
  
    currentImage.onerror = onError;
    baseImage.onerror = onError;
  };  
  return handleBrushCommit;
};

export default useBrushCommit;
