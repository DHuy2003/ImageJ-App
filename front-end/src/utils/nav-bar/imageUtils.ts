export const handleZoomIn = (): void => {
    const event = new CustomEvent('imageZoomIn');
    window.dispatchEvent(event);
};
export const handleZoomOut = (): void => {
    const event = new CustomEvent('imageZoomOut');
    window.dispatchEvent(event);
};
export const handleScaleToFit = (): void => {
    const event = new CustomEvent('imageScaleToFit');
    window.dispatchEvent(event);
};

export const handleOpenBrightnessContrast = (): void => {
    window.dispatchEvent(new CustomEvent('openBrightnessContrast'));
};

interface BitDepthConversionDetail {
    bitDepth: number; // Bit Depth mục tiêu (8, 16, 32)
    currentBitDepth: number; // Bit Depth hiện tại của ảnh (từ NavBar)
    isColor: boolean; // Dùng cho RGB
}

export const handleConvertBitDepth = (bitDepth: number, currentBitDepth: number, isColor: boolean = false): void => {
    const detail: BitDepthConversionDetail = { bitDepth, currentBitDepth, isColor };
    window.dispatchEvent(new CustomEvent('convertBitDepth', { detail }));
};

export const processBrightnessContrast = (
    imageData: ImageData,
    min: number,
    max: number
): ImageData => {
    const data = imageData.data;
    const range = max - min;
    // Hệ số nhân để kéo giãn histogram
    const factor = 255 / (range === 0 ? 1 : range);

    for (let i = 0; i < data.length; i += 4) {
        let r = (data[i] - min) * factor;
        data[i] = r < 0 ? 0 : r > 255 ? 255 : r;

        let g = (data[i + 1] - min) * factor;
        data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;

        let b = (data[i + 2] - min) * factor;
        data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    return imageData;
};

export const analyzeImageHistogram = (imageData: ImageData) => {
    const data = imageData.data;
    const bins = new Array(256).fill(0);
    let min = 255;
    let max = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const val = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        if (bins[val] !== undefined) {
            bins[val]++;
        }
        if (val < min) min = val;
        if (val > max) max = val;
    }
    return { bins, min, max };
};

export const handleOpenImageSize = (): void => {
    window.dispatchEvent(new CustomEvent('openImageSize'));
};

interface ResizeOptions {
    newWidth: number;
    newHeight: number;
    interpolation?: 'NearestNeighbor' | 'Bilinear' | 'Bicubic'; 
}

export const processImageResize = (
    imageData: ImageData,
    options: ResizeOptions
): ImageData => {
    const { newWidth, newHeight } = options;

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = imageData.width;
    originalCanvas.height = imageData.height;
    const originalCtx = originalCanvas.getContext('2d')!;
    originalCtx.putImageData(imageData, 0, 0);

    const newCanvas = document.createElement('canvas');
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    const newCtx = newCanvas.getContext('2d')!;

    newCtx.imageSmoothingEnabled = true;

    // Vẽ ảnh gốc lên canvas mới với kích thước mục tiêu
    newCtx.drawImage(originalCanvas, 0, 0, newWidth, newHeight);

    // Lấy ImageData mới từ canvas đã resize
    const newImageData = newCtx.getImageData(0, 0, newWidth, newHeight);

    return newImageData;
};


export const flipHorizontal = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  canvas.width = width;
  canvas.height = height;


  // Flip horizontally using transform
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, width, height, size);
};


/**
 * Flip image vertically
 */
export const flipVertical = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  canvas.width = width;
  canvas.height = height;


  // Flip vertically using transform
  ctx.translate(0, height);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, width, height, size);
};


/**
 * Rotate image left 90 degrees (counter-clockwise)
 */
export const rotateLeft90 = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  // Swap dimensions for 90-degree rotation
  canvas.width = height;
  canvas.height = width;


  // Rotate 90 degrees counter-clockwise (left)
  ctx.translate(0, width);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, height, width, size);
};


/**
 * Rotate image right 90 degrees (clockwise)
 */
export const rotateRight90 = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  // Swap dimensions for 90-degree rotation
  canvas.width = height;
  canvas.height = width;


  // Rotate 90 degrees clockwise (right)
  ctx.translate(height, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, height, width, size);
};


/**
 * Handler functions that dispatch events (for NavBar integration)
 */
export const handleFlipHorizontal = (): void => {
  const event = new CustomEvent('imageFlipHorizontal');
  window.dispatchEvent(event);
};


export const handleFlipVertical = (): void => {
  const event = new CustomEvent('imageFlipVertical');
  window.dispatchEvent(event);
};


export const handleRotateLeft90 = (): void => {
  const event = new CustomEvent('imageRotateLeft90');
  window.dispatchEvent(event);
};


export const handleRotateRight90 = (): void => {
  const event = new CustomEvent('imageRotateRight90');
  window.dispatchEvent(event);
};
