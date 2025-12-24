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

// Color palette for distinct cell labels (up to 255 cells)
const CELL_COLORS = [
  [230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200], [245, 130, 48],
  [145, 30, 180], [70, 240, 240], [240, 50, 230], [210, 245, 60], [250, 190, 212],
  [0, 128, 128], [220, 190, 255], [170, 110, 40], [255, 250, 200], [128, 0, 0],
  [170, 255, 195], [128, 128, 0], [255, 215, 180], [0, 0, 128], [128, 128, 128],
];

// Generate more colors if needed
const getColorForLabel = (label: number): [number, number, number] => {
  if (label <= 0) return [0, 0, 0];
  const idx = (label - 1) % CELL_COLORS.length;
  const multiplier = Math.floor((label - 1) / CELL_COLORS.length);
  const base = CELL_COLORS[idx];
  // Slightly modify color for labels beyond initial palette
  return [
    Math.min(255, base[0] + multiplier * 17),
    Math.min(255, base[1] + multiplier * 23),
    Math.min(255, base[2] + multiplier * 29),
  ];
};

const useMaskCreation = ({
  imgRef,
  currentFile,
  // currentImageURL is passed but not used after refactoring to use brush_layer_url
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

      // Check if brush layer exists
      const brushLayerUrl = (currentFile as any).brush_layer_url;
      if (!brushLayerUrl) {
        showError('No Brush Strokes', 'Please draw brush strokes around the cells first, then click Create Mask.');
        return;
      }

      // Load brush layer to get stroke data
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

        // Detect stroke pixels from brush layer (any non-transparent pixel is stroke)
        const stroke = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]; // Alpha channel
          // Any pixel with alpha > 0 is a stroke pixel
          if (a > 10) {
            stroke[i / 4] = 1;
          }
        }

        // Count stroke pixels for debugging
        let strokeCount = 0;
        for (let i = 0; i < stroke.length; i++) {
          if (stroke[i]) strokeCount++;
        }
        console.log(`Detected ${strokeCount} stroke pixels from brush layer`);

        if (strokeCount === 0) {
          showError('No Brush Strokes Found', 'Please draw brush strokes around the cells you want to mask.');
          return;
        }

        // NEW ALGORITHM: Use stroke as SEPARATOR between regions
        // Each enclosed non-stroke region becomes a separate cell
        // Stroke pixels themselves are NOT part of any cell (they are boundaries)
        // IMAGE BORDERS also act as boundaries (cells at edge don't need stroke on border)

        // Step 0: Find stroke endpoints that are near image borders and connect them
        // This allows strokes that form a "U" shape against an edge to create enclosed regions
        // without needing to draw along the entire border
        const extendedStroke = new Uint8Array(stroke); // Copy original stroke

        // Find all stroke pixels that touch the image border
        // and mark the border between them as "virtual stroke"
        const borderStrokePoints: { top: number[]; bottom: number[]; left: number[]; right: number[] } = {
          top: [],
          bottom: [],
          left: [],
          right: [],
        };

        // Collect stroke pixels near each border (within 2 pixels of edge)
        const EDGE_THRESHOLD = 2;
        for (let x = 0; x < width; x++) {
          // Top border
          for (let y = 0; y < EDGE_THRESHOLD && y < height; y++) {
            if (stroke[y * width + x]) {
              borderStrokePoints.top.push(x);
              break;
            }
          }
          // Bottom border
          for (let y = height - 1; y >= height - EDGE_THRESHOLD && y >= 0; y--) {
            if (stroke[y * width + x]) {
              borderStrokePoints.bottom.push(x);
              break;
            }
          }
        }
        for (let y = 0; y < height; y++) {
          // Left border
          for (let x = 0; x < EDGE_THRESHOLD && x < width; x++) {
            if (stroke[y * width + x]) {
              borderStrokePoints.left.push(y);
              break;
            }
          }
          // Right border
          for (let x = width - 1; x >= width - EDGE_THRESHOLD && x >= 0; x--) {
            if (stroke[y * width + x]) {
              borderStrokePoints.right.push(y);
              break;
            }
          }
        }

        // Connect stroke points along each border
        // If there are 2+ stroke points touching a border, fill the border between them
        const connectBorderPoints = (points: number[], isHorizontal: boolean) => {
          if (points.length < 2) return;
          points.sort((a, b) => a - b);

          // Connect consecutive pairs of points along the border
          for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];

            // Fill the border between these two points
            if (isHorizontal) {
              // This is for top/bottom borders (fill along x)
              // We need to know which y (0 for top, height-1 for bottom)
            } else {
              // This is for left/right borders (fill along y)
            }
          }
        };

        // Fill top border between stroke endpoints
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

        // Fill bottom border between stroke endpoints
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

        // Fill left border between stroke endpoints
        if (borderStrokePoints.left.length >= 2) {
          borderStrokePoints.left.sort((a, b) => a - b);
          for (let i = 0; i < borderStrokePoints.left.length - 1; i++) {
            const start = borderStrokePoints.left[i];
            const end = borderStrokePoints.left[i + 1];
            for (let y = start; y <= end; y++) {
              extendedStroke[y * width] = 1; // x = 0
            }
          }
        }

        // Fill right border between stroke endpoints
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

        // Step 1: First, flood fill from image borders to find the OUTER background
        // This is the region connected to the border that is NOT enclosed by any stroke
        // Use extendedStroke for background detection (so border gaps are closed)
        const visited = new Uint8Array(width * height);
        const bgQueue: number[] = [];
        let bgQueueHead = 0;

        const enqueueBg = (x: number, y: number) => {
          const idx = y * width + x;
          if (visited[idx] || extendedStroke[idx]) return;
          visited[idx] = 1;
          bgQueue.push(idx);
        };

        // Start flood fill from all 4 borders (only non-extended-stroke pixels)
        for (let x = 0; x < width; x++) {
          if (!extendedStroke[x]) enqueueBg(x, 0);
          if (!extendedStroke[(height - 1) * width + x]) enqueueBg(x, height - 1);
        }
        for (let y = 1; y < height - 1; y++) {
          if (!extendedStroke[y * width]) enqueueBg(0, y);
          if (!extendedStroke[y * width + width - 1]) enqueueBg(width - 1, y);
        }

        // BFS to find all background pixels (connected to border, not blocked by extended stroke)
        while (bgQueueHead < bgQueue.length) {
          const idx = bgQueue[bgQueueHead++];
          const x = idx % width;
          const y = (idx / width) | 0;

          if (x > 0) enqueueBg(x - 1, y);
          if (x < width - 1) enqueueBg(x + 1, y);
          if (y > 0) enqueueBg(x, y - 1);
          if (y < height - 1) enqueueBg(x, y + 1);
        }

        // Step 2: Label all NON-BACKGROUND, NON-STROKE regions as cells
        // Each separate enclosed region becomes a cell
        const labels = new Int32Array(width * height);
        let currentLabel = 0;

        // Flood fill for cell regions only (not visited by background flood, not stroke)
        const floodFillCell = (startX: number, startY: number, label: number) => {
          const stack: number[] = [];
          const startIdx = startY * width + startX;
          stack.push(startIdx);
          labels[startIdx] = label;

          while (stack.length > 0) {
            const idx = stack.pop()!;
            const x = idx % width;
            const y = (idx / width) | 0;

            // 4-connectivity neighbors
            const neighbors = [
              { nx: x - 1, ny: y },
              { nx: x + 1, ny: y },
              { nx: x, ny: y - 1 },
              { nx: x, ny: y + 1 },
            ];

            for (const { nx, ny } of neighbors) {
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nidx = ny * width + nx;
              // Fill pixels that are: not labeled, not stroke, not background
              if (labels[nidx] === 0 && !stroke[nidx] && !visited[nidx]) {
                labels[nidx] = label;
                stack.push(nidx);
              }
            }
          }
        };

        // Find all cell regions (not background, not stroke)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            // Cell candidate: not stroke, not visited (background), not yet labeled
            if (!stroke[idx] && !visited[idx] && labels[idx] === 0) {
              currentLabel++;
              floodFillCell(x, y, currentLabel);
            }
          }
        }

        console.log(`Found ${currentLabel} cell regions (excluding background)`);

        // No need for background detection - we already identified it in step 1
        // All labeled regions are cells

        // Step 3: Use labels directly - they're already correct (0 = background/stroke, 1+ = cells)
        // The labels array already has the correct values from Step 2
        const cellCount = currentLabel;

        console.log(`Created mask with ${cellCount} cells`);

        if (cellCount === 0) {
          showError('No Cells Found', 'No enclosed regions detected. Make sure to draw boundaries around cells (stroke acts as separator, image border also counts as boundary).');
          return;
        }

        // Use labels directly as finalLabels
        const finalLabels = labels;

        // Step 4: Create colored mask with distinct colors for each cell
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
            // Background = black
            md[j] = 0;
            md[j + 1] = 0;
            md[j + 2] = 0;
            md[j + 3] = 255;
          }
        }

        mctx.putImageData(maskImageData, 0, 0);

        // Also create a grayscale labels mask for backend processing
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
            // Store label value directly (grayscale)
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
