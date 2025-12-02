import { useEffect } from 'react';
import type React from 'react';
import type { ImageInfo } from '../../../types/image';
import Swal from 'sweetalert2';

type UseMaskCreationParams = {
  imgRef: React.RefObject<HTMLImageElement | null>;
  currentFile: ImageInfo | null;
  currentImageURL: string | null;
  currentIndex: number;
  setVisibleImages: React.Dispatch<React.SetStateAction<ImageInfo[]>>;
  setShowMask: (value: boolean) => void;
  setShowProperties: (value: boolean) => void;
};

const useMaskCreation = ({
  imgRef,
  currentFile,
  currentImageURL,
  currentIndex,
  setVisibleImages,
  setShowMask,
  setShowProperties,
}: UseMaskCreationParams) => {
  const showError = (title: string, text: string) => {
    Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'OK',
    });
  };

  useEffect(() => {
    const handleCreateMaskEvent = () => {
      if (!imgRef.current || !currentFile || !currentImageURL) {
        showError('Cannot Create Mask', 'No image or stroke data available.');
        return;
      }

      const imgEl = imgRef.current;
      const width = imgEl.naturalWidth;
      const height = imgEl.naturalHeight;
      if (!width || !height) {
        showError('Invalid Image Size', 'Unable to retrieve image dimensions.');
        return;
      }

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      const ctx = baseCanvas.getContext('2d');
      if (!ctx) return;

      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';

      let src = currentImageURL || imgEl.currentSrc || imgEl.src;
      if (/^https?:\/\//i.test(src)) {
        src += (src.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
      }
      image.src = src;

      image.onload = () => {
        ctx.drawImage(image, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const stroke = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          const isStroke =
            a > 0 &&
            r > 150 &&
            r > g + 40 &&
            r > b + 40;

          if (isStroke) {
            const idx = i / 4;
            stroke[idx] = 1;
          }
        }

        const q: number[] = [];

        const enqueue = (x: number, y: number) => {
          const idx = y * width + x;
          if (visited[idx] || stroke[idx]) return;
          visited[idx] = 1;
          q.push(idx);
        };

        for (let x = 0; x < width; x++) {
          enqueue(x, 0);
          enqueue(x, height - 1);
        }

        for (let y = 0; y < height; y++) {
          enqueue(0, y);
          enqueue(width - 1, y);
        }

        while (q.length) {
          const idx = q.shift()!;
          const x = idx % width;
          const y = (idx / width) | 0;

          if (x > 0) enqueue(x - 1, y);
          if (x < width - 1) enqueue(x + 1, y);
          if (y > 0) enqueue(x, y - 1);
          if (y < height - 1) enqueue(x, y + 1);
        }

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const mctx = maskCanvas.getContext('2d');
        if (!mctx) return;

        const maskImageData = mctx.createImageData(width, height);
        const md = maskImageData.data;
        const grayVal = 220;

        let hasRegion = false;

        for (let idx = 0; idx < stroke.length; idx++) {
          const isStrokePixel = stroke[idx] === 1;
          const isBackground = visited[idx] === 1;
          const isCell = isStrokePixel || !isBackground;

          const j = idx * 4;

          if (isCell) {
            hasRegion = true;
            md[j] = grayVal;
            md[j + 1] = grayVal;
            md[j + 2] = grayVal;
            md[j + 3] = 255;
          } else {
            md[j] = 0;
            md[j + 1] = 0;
            md[j + 2] = 0;
            md[j + 3] = 255;
          }
        }

        if (!hasRegion) {
          showError('No Region Found', 'No enclosed area detected to generate a mask.');
          return;
        }

        mctx.putImageData(maskImageData, 0, 0);
        const maskDataUrl = maskCanvas.toDataURL('image/png');

        setVisibleImages(prev => {
          const copy = [...prev];
          if (copy[currentIndex]) {
            copy[currentIndex] = {
              ...copy[currentIndex],
              mask_url: maskDataUrl,
            } as any;
          }
          return copy;
        });

        setShowMask(true);
        setShowProperties(false);
      };

      image.onerror = () => {
        showError(
          'Image Load Failed',
          'Unable to read the image (CORS issue or image loading error).'
        );
      };
    };

    window.addEventListener('createMask', handleCreateMaskEvent as EventListener);
    return () => {
      window.removeEventListener('createMask', handleCreateMaskEvent as EventListener);
    };
  }, [
    imgRef,
    currentFile,
    currentImageURL,
    currentIndex,
    setVisibleImages,
    setShowMask,
    setShowProperties,
  ]);
};

export default useMaskCreation;
