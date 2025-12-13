import { useEffect } from 'react';
import { base64ToBytes } from '../../../utils/common/formatFileSize';
import { type SelectedRoiInfo } from '../../../types/roi';
import type { ImageInfo } from '../../../types/image';
import type { RelativeCropRect } from '../../../types/crop';
import { dispatchNotification } from '../../../utils/nav-bar/processUtils';
import { showSelectionRequired } from '../../../utils/nav-bar/editUtils';

type UseEditEventsParams = {
  imgRef: React.RefObject<HTMLImageElement | null>;
  selectedRoi: SelectedRoiInfo | null;
  currentFile: ImageInfo | null;
  currentImageURL: string | null;
  setCurrentImageURL: (url: string | null) => void;
  currentIndex: number;
  pushUndo: () => void;
  setIsCropping: (value: boolean) => void;
  setVisibleImages: React.Dispatch<React.SetStateAction<ImageInfo[]>>;
}

const useEditEvents = ({
  imgRef,
  selectedRoi,
  currentFile,
  currentImageURL,
  setCurrentImageURL,
  currentIndex,
  pushUndo,
  setIsCropping,
  setVisibleImages
}: UseEditEventsParams) => {
  const cropImage = (relRect: RelativeCropRect) => {
    if (!imgRef.current || !currentFile) return;

    const img = imgRef.current;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const left = clamp01(relRect.left);
    const top = clamp01(relRect.top);
    const width = clamp01(relRect.width);
    const height = clamp01(relRect.height);

    let cropX = left * naturalW;
    let cropY = top * naturalH;
    let cropW = width * naturalW;
    let cropH = height * naturalH;

    cropX = Math.max(0, Math.min(cropX, naturalW - 1));
    cropY = Math.max(0, Math.min(cropY, naturalH - 1));
    cropW = Math.max(1, Math.min(cropW, naturalW - cropX));
    cropH = Math.max(1, Math.min(cropH, naturalH - cropY));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);
    const ctx = canvas.getContext('2d');
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
      pushUndo();

      ctx.drawImage(
        image,
        Math.round(cropX),
        Math.round(cropY),
        Math.round(cropW),
        Math.round(cropH),
        0,
        0,
        canvas.width,
        canvas.height
      );

      const newSrc = canvas.toDataURL('image/png');
      const base64 = newSrc.split(',')[1];
      const newSize = base64ToBytes(base64);

      setCurrentImageURL(newSrc);

      setVisibleImages(prev => {
        const copy = [...prev];
        if (copy[currentIndex]) {
          copy[currentIndex] = {
            ...copy[currentIndex],
            cropped_url: newSrc as any,
            width: canvas.width,
            height: canvas.height,
            size: newSize,
            bitDepth: currentFile.bitDepth ?? 8,
          } as any;
        }
        return copy;
      });
    };

    image.onerror = (e) => {
      console.error('Image load (CORS) failed: ', e, src);
      dispatchNotification(
        'Cannot export cropped image due to CORS. Please refresh after backend CORS fix.',
        'error'
      );
    };
  };

  const applyRoiEdit = (
    mode: 'clear' | 'clearOutside' | 'fill' | 'invert' | 'draw' | 'rotate',
    roi: SelectedRoiInfo,
    color?: string,
    angleDeg?: number
  ) => {
    if (!roi) return;
    if (!imgRef.current || !currentFile || !currentImageURL) return;
    pushUndo();

    const img = imgRef.current;
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';

    let src = currentImageURL || img.currentSrc || img.src;
    if (/^https?:\/\//i.test(src)) {
      src += (src.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
    }
    image.src = src;

    const drawRoiPath = () => {
      const x = Math.round(roi.x);
      const y = Math.round(roi.y);
      const w = Math.round(roi.width);
      const h = Math.round(roi.height);

      if (roi.type === 'circle') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        ctx.rect(x, y, w, h);
      }
    };

    image.onload = () => {
      ctx.drawImage(image, 0, 0, width, height);
      if (mode === 'clear') {
        ctx.save();
        ctx.beginPath();
        drawRoiPath();
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else if (mode === 'clearOutside') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tctx = tempCanvas.getContext('2d');
        if (!tctx) return;
        tctx.drawImage(image, 0, 0, width, height);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.beginPath();
        drawRoiPath();
        ctx.clip();
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
      } else if (mode === 'fill') {
        ctx.save();
        ctx.beginPath();
        drawRoiPath();
        ctx.clip();
        ctx.fillStyle = color || '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else if (mode === 'invert') {
        const x = Math.round(roi.x);
        const y = Math.round(roi.y);
        const w = Math.round(roi.width);
        const h = Math.round(roi.height);
  
        const imageData = ctx.getImageData(x, y, w, h);
        const data = imageData.data;
  
        if (roi.type === 'circle') {
          const cx = w / 2;
          const cy = h / 2;
          const rx = w / 2;
          const ry = h / 2;
          for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
              const dx = (i - cx) / rx;
              const dy = (j - cy) / ry;
              if (dx * dx + dy * dy <= 1) {
                const idx = (j * w + i) * 4;
                data[idx]     = 255 - data[idx];     
                data[idx + 1] = 255 - data[idx + 1]; 
                data[idx + 2] = 255 - data[idx + 2];
              }
            }
          }
        } else {
          for (let i = 0; i < data.length; i += 4) {
            data[i]     = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
        }
        ctx.putImageData(imageData, x, y);
  
      } else if (mode === 'draw') {
        const x = Math.round(roi.x);
        const y = Math.round(roi.y);
        const w = Math.round(roi.width);
        const h = Math.round(roi.height);
      
        ctx.save();
        ctx.beginPath();
        if (roi.type === 'circle') {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const rx = w / 2;
          const ry = h / 2;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else if (mode === 'rotate') {
        const angleRad = ((angleDeg ?? 0) * Math.PI) / 180;
      
        const x = Math.round(roi.x);
        const y = Math.round(roi.y);
        const w = Math.round(roi.width);
        const h = Math.round(roi.height);

        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tctx = temp.getContext('2d');
        if (!tctx) return;
      
        tctx.drawImage(image, x, y, w, h, 0, 0, w, h);
      
        ctx.save();
        ctx.beginPath();
        drawRoiPath();
        ctx.clip();
      
        const cx = x + w / 2;
        const cy = y + h / 2;
      
        ctx.translate(cx, cy);
        ctx.rotate(angleRad);
        ctx.drawImage(temp, -w / 2, -h / 2);
      
        ctx.restore();
      }

      const newSrc = canvas.toDataURL('image/png');
      const base64 = newSrc.split(',')[1];
      const newSize = base64ToBytes(base64);

      setCurrentImageURL(newSrc);

      if (currentFile) {
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
      }
    };

    image.onerror = (e) => {
      console.error('Image load (CORS) failed: ', e, src);
      dispatchNotification(
        'Cannot edit image due to CORS. Please refresh after backend CORS fix.',
        'error'
      );
    };
  };

  const invertWholeImage = () => {
    if (!imgRef.current || !currentFile || !currentImageURL) return;
    pushUndo();
  
    const img = imgRef.current;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
  
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
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
      ctx.drawImage(image, 0, 0, width, height);
  
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
  
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = 255 - data[i];     
        data[i + 1] = 255 - data[i + 1]; 
        data[i + 2] = 255 - data[i + 2]; 
      }
  
      ctx.putImageData(imageData, 0, 0);
  
      const newSrc = canvas.toDataURL('image/png');
      const base64 = newSrc.split(',')[1];
      const newSize = base64ToBytes(base64);

      setCurrentImageURL(newSrc);

      if (currentFile) {
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
      }
    };
  
    image.onerror = (e) => {
      console.error('Image load (CORS) failed: ', e, src);
      dispatchNotification(
        'Cannot edit image due to CORS. Please refresh after backend CORS fix.',
        'error'
      );
    };
  };

  useEffect(() => {
    const listener = () => setIsCropping(true);
    window.addEventListener('enableCropMode', listener);
    return () => window.removeEventListener('enableCropMode', listener);
  }, [setIsCropping]);

  useEffect(() => {
    const onClear = () => {
      if (!selectedRoi) {
        showSelectionRequired();
        return;
      }
      applyRoiEdit('clear', selectedRoi);
    };

    const onClearOutside = () => {
      if (!selectedRoi) {
        showSelectionRequired();
        return;
      }
      applyRoiEdit('clearOutside', selectedRoi);
    };

    const onFill = (e: Event) => {
      if (!selectedRoi) {
        showSelectionRequired();
        return;
      }
      const ce = e as CustomEvent<{ color: string }>;
      const color = ce.detail?.color ?? '#000000';
      applyRoiEdit('fill', selectedRoi, color);
    };

    const onInvert = () => {
      if (selectedRoi) {
        applyRoiEdit('invert', selectedRoi);
      } else {
        invertWholeImage();
      }
    };

    const onDraw = () => {
      if (!selectedRoi) {
        showSelectionRequired();
        return;
      }
      applyRoiEdit('draw', selectedRoi);
    };

    window.addEventListener('editClear', onClear);
    window.addEventListener('editClearOutside', onClearOutside);
    window.addEventListener('editFill', onFill as EventListener);
    window.addEventListener('editInvert', onInvert);
    window.addEventListener('editDraw', onDraw);

    return () => {
      window.removeEventListener('editClear', onClear);
      window.removeEventListener('editClearOutside', onClearOutside);
      window.removeEventListener('editFill', onFill as EventListener);
      window.removeEventListener('editInvert', onInvert);
      window.removeEventListener('editDraw', onDraw);
    };
  }, [selectedRoi, currentIndex, currentImageURL, currentFile, setVisibleImages, setCurrentImageURL, pushUndo]); 

  return {
    cropImage,
  };
  
};

export default useEditEvents;
