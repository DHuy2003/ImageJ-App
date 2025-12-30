import { useEffect } from 'react';
import type React from 'react';
import type { ImageInfo } from '../../../types/image';
import Swal from 'sweetalert2';

type UseMaskCreationParams = {
  imgRef: React.RefObject<HTMLImageElement | null>;
  currentFile: (ImageInfo & { brush_layer_url?: string }) | null;
  currentImageURL: string | null;
  currentIndex: number;
  setVisibleImages: React.Dispatch<React.SetStateAction<ImageInfo[]>>;
  setShowMask: (value: boolean) => void;
  setShowProperties: (value: boolean) => void;
};

const CELL_COLORS = [
  [230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200], [245, 130, 48],
  [145, 30, 180], [70, 240, 240], [240, 50, 230], [210, 245, 60], [250, 190, 212],
  [0, 128, 128], [220, 190, 255], [170, 110, 40], [255, 250, 200], [128, 0, 0],
  [170, 255, 195], [128, 128, 0], [255, 215, 180], [0, 0, 128], [128, 128, 128],
];

const getColorForLabel = (label: number): [number, number, number] => {
  if (label <= 0) return [0, 0, 0];
  const idx = (label - 1) % CELL_COLORS.length;
  const multiplier = Math.floor((label - 1) / CELL_COLORS.length);
  const base = CELL_COLORS[idx];
  return [
    Math.min(255, base[0] + multiplier * 17),
    Math.min(255, base[1] + multiplier * 23),
    Math.min(255, base[2] + multiplier * 29),
  ];
};

const useMaskCreation = ({
  imgRef,
  currentFile,
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
      if (!imgRef.current || !currentFile) {
        showError('Cannot Create Mask', 'No image available.');
        return;
      }

      const imgEl = imgRef.current;
      const width = imgEl.naturalWidth;
      const height = imgEl.naturalHeight;
      if (!width || !height) {
        showError('Invalid Image Size', 'Unable to retrieve image dimensions.');
        return;
      }

      const brushLayerUrl = (currentFile as any).brush_layer_url;
      if (!brushLayerUrl) {
        showError('No Brush Strokes', 'Please draw brush strokes around the cells first, then click Create Mask.');
        return;
      }

      const brushImage = new Image();
      brushImage.crossOrigin = 'anonymous';
      brushImage.src = brushLayerUrl;

      brushImage.onload = () => {
        const brushCanvas = document.createElement('canvas');
        brushCanvas.width = width;
        brushCanvas.height = height;
        const brushCtx = brushCanvas.getContext('2d');
        if (!brushCtx) return;

        brushCtx.drawImage(brushImage, 0, 0, width, height);
        const brushData = brushCtx.getImageData(0, 0, width, height);
        const data = brushData.data;

        const stroke = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]; 
          if (a > 10) {
            stroke[i / 4] = 1;
          }
        }

        let strokeCount = 0;
        for (let i = 0; i < stroke.length; i++) {
          if (stroke[i]) strokeCount++;
        }
        console.log(`Detected ${strokeCount} stroke pixels from brush layer`);

        if (strokeCount === 0) {
          showError('No Brush Strokes Found', 'Please draw brush strokes around the cells you want to mask.');
          return;
        }

        const absorbStrokeIntoCellsStable = (
          labels: Int32Array,
          stroke: Uint8Array,
          width: number,
          height: number,
          maxPasses = 64,
        ) => {
          const idx = (x: number, y: number) => y * width + x;

          const pending = new Int32Array(width * height);
        
          const pushDistinct = (val: number, a: number, b: number) => {
            if (val <= 0) return [a, b] as const;
            if (a === 0) return [val, b] as const;
            if (val === a) return [a, b] as const;
            if (b === 0) return [a, val] as const;
            if (val === b) return [a, b] as const;
            return [a, -1] as const;
          };
        
          for (let pass = 0; pass < maxPasses; pass++) {
            pending.fill(0);
            let marked = 0;
        
            for (let y = 1; y < height - 1; y++) {
              for (let x = 1; x < width - 1; x++) {
                const i = idx(x, y);
                if (!stroke[i]) continue;    
                if (labels[i] !== 0) continue; 
        
                let a = 0;
                let b = 0;

                const n = [
                  labels[idx(x - 1, y - 1)],
                  labels[idx(x, y - 1)],
                  labels[idx(x + 1, y - 1)],
                  labels[idx(x - 1, y)],
                  labels[idx(x + 1, y)],
                  labels[idx(x - 1, y + 1)],
                  labels[idx(x, y + 1)],
                  labels[idx(x + 1, y + 1)],
                ];
        
                for (let k = 0; k < 8; k++) {
                  [a, b] = pushDistinct(n[k], a, b);
                  if (b === -1) break;
                }

                if (a !== 0 && b === 0) {
                  pending[i] = a;
                  marked++;
                }
              }
            }
        
            if (marked === 0) break;

            for (let i = 0; i < pending.length; i++) {
              const v = pending[i];
              if (v !== 0) labels[i] = v;
            }
          }
        };        

        const extendedStroke = new Uint8Array(stroke);

        const borderStrokePoints: { top: number[]; bottom: number[]; left: number[]; right: number[] } = {
          top: [],
          bottom: [],
          left: [],
          right: [],
        };

        const EDGE_THRESHOLD = 2;
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < EDGE_THRESHOLD && y < height; y++) {
            if (stroke[y * width + x]) {
              borderStrokePoints.top.push(x);
              break;
            }
          }
          for (let y = height - 1; y >= height - EDGE_THRESHOLD && y >= 0; y--) {
            if (stroke[y * width + x]) {
              borderStrokePoints.bottom.push(x);
              break;
            }
          }
        }
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < EDGE_THRESHOLD && x < width; x++) {
            if (stroke[y * width + x]) {
              borderStrokePoints.left.push(y);
              break;
            }
          }
          for (let x = width - 1; x >= width - EDGE_THRESHOLD && x >= 0; x--) {
            if (stroke[y * width + x]) {
              borderStrokePoints.right.push(y);
              break;
            }
          }
        }

        if (borderStrokePoints.top.length >= 2) {
          borderStrokePoints.top.sort((a, b) => a - b);
          for (let i = 0; i < borderStrokePoints.top.length - 1; i++) {
            const start = borderStrokePoints.top[i];
            const end = borderStrokePoints.top[i + 1];
            for (let x = start; x <= end; x++) {
              extendedStroke[x] = 1; // y = 0
            }
          }
        }

        if (borderStrokePoints.bottom.length >= 2) {
          borderStrokePoints.bottom.sort((a, b) => a - b);
          for (let i = 0; i < borderStrokePoints.bottom.length - 1; i++) {
            const start = borderStrokePoints.bottom[i];
            const end = borderStrokePoints.bottom[i + 1];
            for (let x = start; x <= end; x++) {
              extendedStroke[(height - 1) * width + x] = 1;
            }
          }
        }

        if (borderStrokePoints.left.length >= 2) {
          borderStrokePoints.left.sort((a, b) => a - b);
          for (let i = 0; i < borderStrokePoints.left.length - 1; i++) {
            const start = borderStrokePoints.left[i];
            const end = borderStrokePoints.left[i + 1];
            for (let y = start; y <= end; y++) {
              extendedStroke[y * width] = 1; 
            }
          }
        }

        if (borderStrokePoints.right.length >= 2) {
          borderStrokePoints.right.sort((a, b) => a - b);
          for (let i = 0; i < borderStrokePoints.right.length - 1; i++) {
            const start = borderStrokePoints.right[i];
            const end = borderStrokePoints.right[i + 1];
            for (let y = start; y <= end; y++) {
              extendedStroke[y * width + width - 1] = 1;
            }
          }
        }

        const visited = new Uint8Array(width * height);
        const bgQueue: number[] = [];
        let bgQueueHead = 0;

        const enqueueBg = (x: number, y: number) => {
          const idx = y * width + x;
          if (visited[idx] || extendedStroke[idx]) return;
          visited[idx] = 1;
          bgQueue.push(idx);
        };

        for (let x = 0; x < width; x++) {
          if (!extendedStroke[x]) enqueueBg(x, 0);
          if (!extendedStroke[(height - 1) * width + x]) enqueueBg(x, height - 1);
        }
        for (let y = 1; y < height - 1; y++) {
          if (!extendedStroke[y * width]) enqueueBg(0, y);
          if (!extendedStroke[y * width + width - 1]) enqueueBg(width - 1, y);
        }

        while (bgQueueHead < bgQueue.length) {
          const idx = bgQueue[bgQueueHead++];
          const x = idx % width;
          const y = (idx / width) | 0;

          if (x > 0) enqueueBg(x - 1, y);
          if (x < width - 1) enqueueBg(x + 1, y);
          if (y > 0) enqueueBg(x, y - 1);
          if (y < height - 1) enqueueBg(x, y + 1);
        }

        const MIN_REGION_AREA_PX = 250;

        const labels = new Int32Array(width * height);
        let currentLabel = 0;

        const floodFillCell = (startX: number, startY: number, label: number) => {
          const stack: number[] = [];
          const regionPixels: number[] = [];
        
          const startIdx = startY * width + startX;
          stack.push(startIdx);
          labels[startIdx] = label;
          regionPixels.push(startIdx);
        
          while (stack.length > 0) {
            const idx = stack.pop()!;
            const x = idx % width;
            const y = (idx / width) | 0;

            const neighbors = [
              { nx: x - 1, ny: y },
              { nx: x + 1, ny: y },
              { nx: x, ny: y - 1 },
              { nx: x, ny: y + 1 },
            ];
        
            for (const { nx, ny } of neighbors) {
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nidx = ny * width + nx;
        
              if (labels[nidx] === 0 && !stroke[nidx] && !visited[nidx]) {
                labels[nidx] = label;
                stack.push(nidx);
                regionPixels.push(nidx);
              }
            }
          }
        
          return regionPixels;
        };        

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (!stroke[idx] && !visited[idx] && labels[idx] === 0) {
              const tryLabel = currentLabel + 1;
              const pixels = floodFillCell(x, y, tryLabel);

              if (pixels.length < MIN_REGION_AREA_PX) {
                for (let k = 0; k < pixels.length; k++) labels[pixels[k]] = 0;
              } else {
                currentLabel = tryLabel;
              }
            }            
          }
        }

        console.log(`Found ${currentLabel} cell regions (excluding background)`);

        const cellCount = currentLabel;

        console.log(`Created mask with ${cellCount} cells`);

        if (cellCount === 0) {
          showError('No Cells Found', 'No enclosed regions detected. Make sure to draw boundaries around cells (stroke acts as separator, image border also counts as boundary).');
          return;
        }

        absorbStrokeIntoCellsStable(labels, stroke, width, height, 64);

        const finalLabels = labels;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const mctx = maskCanvas.getContext('2d');
        if (!mctx) return;

        const maskImageData = mctx.createImageData(width, height);
        const md = maskImageData.data;

        for (let idx = 0; idx < finalLabels.length; idx++) {
          const label = finalLabels[idx];
          const j = idx * 4;

          if (label > 0) {
            const [r, g, b] = getColorForLabel(label);
            md[j] = r;
            md[j + 1] = g;
            md[j + 2] = b;
            md[j + 3] = 255;
          } else {
            md[j] = 0;
            md[j + 1] = 0;
            md[j + 2] = 0;
            md[j + 3] = 255;
          }
        }

        mctx.putImageData(maskImageData, 0, 0);

        const labelsCanvas = document.createElement('canvas');
        labelsCanvas.width = width;
        labelsCanvas.height = height;
        const lctx = labelsCanvas.getContext('2d');
        if (lctx) {
          const labelsImageData = lctx.createImageData(width, height);
          const ld = labelsImageData.data;
          for (let idx = 0; idx < finalLabels.length; idx++) {
            const label = finalLabels[idx];
            const j = idx * 4;
            ld[j] = label & 0xFF;
            ld[j + 1] = (label >> 8) & 0xFF;
            ld[j + 2] = (label >> 16) & 0xFF;
            ld[j + 3] = 255;
          }
          lctx.putImageData(labelsImageData, 0, 0);
        }

        const maskDataUrl = maskCanvas.toDataURL('image/png');
        const labelsDataUrl = labelsCanvas.toDataURL('image/png');

        setVisibleImages(prev => {
          const copy = [...prev];
          if (copy[currentIndex]) {
            copy[currentIndex] = {
              ...copy[currentIndex],
              mask_url: maskDataUrl,
              labels_mask_url: labelsDataUrl,
            } as any;
          }
          return copy;
        });

        setShowMask(true);
        setShowProperties(false);
      };

      brushImage.onerror = () => {
        showError(
          'Brush Layer Load Failed',
          'Unable to read the brush layer data.'
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
    currentIndex,
    setVisibleImages,
    setShowMask,
    setShowProperties,
  ]);
};

export default useMaskCreation;
