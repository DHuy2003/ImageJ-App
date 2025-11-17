import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { base64ToBytes } from '../../../utils/common/formatFileSize';
import { showSelectionRequired, type SelectedRoiInfo } from '../../../types/roi';
import type { ImageInfo, ImageViewProps } from '../../../types/image';

interface UseEditEventsParams {
  imgRef: React.RefObject<HTMLImageElement | null>;
  selectedRoi: SelectedRoiInfo | null;
  currentFile: ImageInfo | null;
  currentImageURL: string | null;
  setCurrentImageURL: (url: string | null) => void;
  imageArray: ImageViewProps['imageArray'];
  currentIndex: number;
  undoSnapshot: string | null;
  setUndoSnapshot: (value: string | null) => void;
  navigate: NavigateFunction;
  setIsCropping: (value: boolean) => void;
}

/**
 * Hook này ONLY xử lý:
 *  - enableCropMode  (Cut)
 *  - editClear / editClearOutside / editFill / editInvert / editDraw / editRotate
 *  - editUndo
 * Tất cả các event này đều được dispatch từ editUtils.ts
 */
const useEditEvents = ({
  imgRef,
  selectedRoi,
  currentFile,
  currentImageURL,
  setCurrentImageURL,
  imageArray,
  currentIndex,
  undoSnapshot,
  setUndoSnapshot,
  navigate,
  setIsCropping,
}: UseEditEventsParams) => {
  const saveUndoSnapshot = () => {
    if (!currentImageURL) return;
    setUndoSnapshot(currentImageURL);
  };

  const applyRoiEdit = (
    mode: 'clear' | 'clearOutside' | 'fill' | 'invert' | 'draw' | 'rotate',
    roi: SelectedRoiInfo,
    color?: string,
    angleDeg?: number
  ) => {
    if (!roi) return;
    if (!imgRef.current || !currentFile) return;

    saveUndoSnapshot();
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

      const updatedImageArray = [...imageArray];
      const now = new Date().toISOString();
      updatedImageArray[currentIndex] = {
        ...updatedImageArray[currentIndex],
        cropped_url: newSrc,
        last_edited_on: now,
        height: canvas.height,
        width: canvas.width,
        size: newSize,
      };

      setCurrentImageURL(newSrc);
      sessionStorage.setItem('imageArray', JSON.stringify(updatedImageArray));
      navigate('/display-images', {
        state: { imageArray: updatedImageArray },
        replace: true,
      });
    };

    image.onerror = (e) => {
      console.error('Image load (CORS) failed: ', e, src);
      alert('Cannot edit image due to CORS. Please refresh after backend CORS fix.');
    };
  };

  const invertWholeImage = () => {
    if (!imgRef.current || !currentFile) return;

    saveUndoSnapshot();
  
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
  
      const updatedImageArray = [...imageArray];
      const now = new Date().toISOString();
      updatedImageArray[currentIndex] = {
        ...updatedImageArray[currentIndex],
        cropped_url: newSrc,
        last_edited_on: now,
        height: canvas.height,
        width: canvas.width,
        size: newSize,
      };
  
      setCurrentImageURL(newSrc);
      sessionStorage.setItem('imageArray', JSON.stringify(updatedImageArray));
      navigate('/display-images', {
        state: { imageArray: updatedImageArray },
        replace: true,
      });
    };
  
    image.onerror = (e) => {
      console.error('Image load (CORS) failed: ', e, src);
      alert('Cannot edit image due to CORS. Please refresh after backend CORS fix.');
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

    const onRotate = (e: Event) => {
      if (!selectedRoi) {
        showSelectionRequired();
        return;
      }
      const ce = e as CustomEvent<{ angleDeg?: number }>;
      const angleDeg = ce.detail?.angleDeg ?? 0;
      applyRoiEdit('rotate', selectedRoi, undefined, angleDeg);
    };

    window.addEventListener('editClear', onClear);
    window.addEventListener('editClearOutside', onClearOutside);
    window.addEventListener('editFill', onFill as EventListener);
    window.addEventListener('editInvert', onInvert);
    window.addEventListener('editDraw', onDraw);
    window.addEventListener('editRotate', onRotate);

    return () => {
      window.removeEventListener('editClear', onClear);
      window.removeEventListener('editClearOutside', onClearOutside);
      window.removeEventListener('editFill', onFill as EventListener);
      window.removeEventListener('editInvert', onInvert);
      window.removeEventListener('editDraw', onDraw);
      window.removeEventListener('editRotate', onRotate);
    };
  }, [
    selectedRoi,
    currentIndex,
    imageArray,
    currentImageURL,
    currentFile,
  ]);

  useEffect(() => {
    const onUndo = () => {
      if (!undoSnapshot) return;

      const restored = undoSnapshot;
      setCurrentImageURL(restored);

      const base64 = restored.split(',')[1];
      const newSize = base64ToBytes(base64);
      const updatedImageArray = [...imageArray];
      const now = new Date().toISOString();

      updatedImageArray[currentIndex] = {
        ...updatedImageArray[currentIndex],
        cropped_url: restored,
        last_edited_on: now,
        size: newSize,
      };

      sessionStorage.setItem('imageArray', JSON.stringify(updatedImageArray));
      navigate('/display-images', {
        state: { imageArray: updatedImageArray },
        replace: true,
      });

      setUndoSnapshot(null);
    };

    window.addEventListener('editUndo', onUndo);
    return () => window.removeEventListener('editUndo', onUndo);
  }, [undoSnapshot, currentIndex, imageArray, navigate, setCurrentImageURL, setUndoSnapshot]);
};

export default useEditEvents;