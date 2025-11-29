import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CropOverlayHandle, RelativeCropRect } from '../../types/crop';
import type { ImageInfo, ImageViewProps, UndoEntry } from '../../types/image';
import { base64ToBytes, formatFileSize } from '../../utils/common/formatFileSize';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import { type RoiTool, type SelectedRoiInfo } from '../../types/roi';
import './ImageView.css';
import useEditEvents from './hooks/useEditEvents';
import { useToolbarToolSelection } from './hooks/useToolbarToolSelection';
import useFileEvents from './hooks/useFileEvents';
import BrushOverlay from '../brush-overlay/BrushOverlay';
import { IMAGES_APPENDED_EVENT } from '../../utils/nav-bar/fileUtils';

const ZOOM_FACTOR = 1.25; // Tỉ lệ phóng to/thu nhỏ
const DEFAULT_ZOOM_LEVEL = 1.0;

const ImageView = ({ imageArray }: ImageViewProps) => {
  const [visibleImages, setVisibleImages] = useState<ImageInfo[]>(imageArray);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentImageURL, setCurrentImageURL] = useState<string | null>(null);
  const currentFile = visibleImages[currentIndex];
  const [isCropping, setIsCropping] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<CropOverlayHandle | null>(null);
  const [showConfirmCrop, setShowConfirmCrop] = useState(false);
  const [cropRectData, setCropRectData] = useState<RelativeCropRect | null>(null);
  const [activeTool, setActiveTool] = useState<RoiTool>('pointer');
  const [selectedRoi, setSelectedRoi] = useState<SelectedRoiInfo>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[][]>(() =>
    imageArray.map(() => [] as UndoEntry[]),
  );
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM_LEVEL);
  const [scaleToFit, setScaleToFit] = useState<boolean>(true);

  useEffect(() => {
    const handleZoomInEvent = () => {
      setScaleToFit(false);
      setZoomLevel(prev => {
        const nextZoom = prev * ZOOM_FACTOR;
        return Math.min(nextZoom, 32.0);
      });
    };


    const handleZoomOutEvent = () => {
      setScaleToFit(false);
      setZoomLevel(prev => {
        const nextZoom = prev / ZOOM_FACTOR;
        return Math.max(nextZoom, 0.1);
      });
    };


    const handleScaleToFitEvent = () => {
      setScaleToFit(prev => {
        if (!prev) {
          setZoomLevel(DEFAULT_ZOOM_LEVEL);
        }
        return !prev;
      });
    };
    window.addEventListener('imageZoomIn', handleZoomInEvent);
    window.addEventListener('imageZoomOut', handleZoomOutEvent);
    window.addEventListener('imageScaleToFit', handleScaleToFitEvent);


    return () => {
      window.removeEventListener('imageZoomIn', handleZoomInEvent);
      window.removeEventListener('imageZoomOut', handleZoomOutEvent);
      window.removeEventListener('imageScaleToFit', handleScaleToFitEvent);
    };
  }, []);

  
  const pushUndo = () => {
    if (!currentImageURL || !currentFile) return;
  
    const snapshot: UndoEntry = {
      url: currentImageURL,
      width: currentFile.width,
      height: currentFile.height,
      size: currentFile.size,
      bitDepth: currentFile.bitDepth ?? 8,
    };
  
    setUndoStack(prev => {
      const copy = [...prev];
      if (!copy[currentIndex]) copy[currentIndex] = [];
      copy[currentIndex] = [...copy[currentIndex], snapshot];
      return copy;
    });
  }; 

  const { cropImage } = useEditEvents({
    imgRef,
    selectedRoi,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
    currentIndex,
    pushUndo,
    setIsCropping,
    setVisibleImages
  });

  useFileEvents({
    imageArray: visibleImages,
    setImageArray: setVisibleImages,
    currentIndex,
    setCurrentIndex,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
  });

  useToolbarToolSelection(setActiveTool);

  useEffect(() => {
    const onImagesAppended = (e: Event) => {
      const ce = e as CustomEvent<ImageInfo[]>;
      const newImages = ce.detail;
      if (!newImages || newImages.length === 0) return;
      setVisibleImages(prev => [...prev, ...newImages]);
    };

    window.addEventListener(IMAGES_APPENDED_EVENT, onImagesAppended as EventListener);
    return () => {
      window.removeEventListener(IMAGES_APPENDED_EVENT, onImagesAppended as EventListener);
    };
  }, []);

  useEffect(() => {
    setVisibleImages(imageArray);
    setCurrentIndex(0);
    setCurrentImageURL(null);
  }, [imageArray]);

  useEffect(() => {
    setUndoStack(prev => {
      if (prev.length === visibleImages.length) return prev;
      const next = [...prev];
      while (next.length < visibleImages.length) next.push([]);
      while (next.length > visibleImages.length) next.pop();
      return next;
    });
  }, [visibleImages.length]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        id: number;
        type: 'rect' | 'circle';
        imageRect: { x: number; y: number; width: number; height: number };
      } | null>;

      if (!ce.detail) {
        setSelectedRoi(null);
        return;
      }

      const { type, imageRect } = ce.detail;
      setSelectedRoi({
        type,
        x: imageRect.x,
        y: imageRect.y,
        width: imageRect.width,
        height: imageRect.height,
      });
    };

    window.addEventListener('roiSelection', handler as EventListener);
    return () => window.removeEventListener('roiSelection', handler as EventListener);
  }, []);

  useEffect(() => {
    if (currentFile) {
      if (currentFile.cropped_url) {
        setCurrentImageURL(currentFile.cropped_url);
      } else if (currentFile.url) {
        setCurrentImageURL(currentFile.url);
      }
    }
  }, [currentFile, currentIndex]);

  const handleCrop = (relRect: RelativeCropRect) => {
    cropImage(relRect);
    // UI: tắt crop mode + popup sau khi gửi lệnh cắt
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

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

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < visibleImages.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const handleToggleMask = () => {
    setShowMask((prev) => !prev);
    setShowProperties((prev) => !prev);
  };

  useEffect(() => {
    const onUndo = () => {
      setUndoStack(prev => {
        const copy = [...prev];
        const stack = copy[currentIndex] ?? [];
        if (!stack.length) return prev;
  
        const newStack = stack.slice(0, -1);
        const restored = stack[stack.length - 1];
  
        copy[currentIndex] = newStack;

        setCurrentImageURL(restored.url);

        setVisibleImages(prevImgs => {
          const imgsCopy = [...prevImgs];
          const file = imgsCopy[currentIndex];
          if (file) {
            imgsCopy[currentIndex] = {
              ...file,
              cropped_url: restored.url as any,
              width: restored.width,
              height: restored.height,
              size: restored.size,
              bitDepth: restored.bitDepth,
            } as any;
          }
          return imgsCopy;
        });
  
        return copy;
      });
    };
  
    window.addEventListener('editUndo', onUndo);
    return () => window.removeEventListener('editUndo', onUndo);
  }, [currentIndex, setCurrentImageURL, setVisibleImages]);  
  
  useEffect(() => {
    const handleCreateMaskEvent = () => {
      if (!imgRef.current || !currentFile || !currentImageURL) {
        alert('Không có ảnh hoặc nét vẽ để tạo mask.');
        return;
      }
  
      const imgEl = imgRef.current;
      const width = imgEl.naturalWidth;
      const height = imgEl.naturalHeight;
      if (!width || !height) {
        alert('Không lấy được kích thước ảnh.');
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
  
        // Mảng đánh dấu stroke & visited
        const stroke = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
  
        // 1) Detect pixel nét brush (màu đỏ)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
  
          // tuỳ brush của bạn, có thể nới threshold
          const isStroke =
            a > 0 &&
            r > 150 &&      // đỏ tương đối sáng
            r > g + 40 &&
            r > b + 40;
  
          if (isStroke) {
            const idx = i / 4;
            stroke[idx] = 1;
          }
        }
  
        // 2) Flood-fill từ mép ảnh để tìm background
        const q: number[] = [];
  
        const enqueue = (x: number, y: number) => {
          const idx = y * width + x;
          if (visited[idx] || stroke[idx]) return;
          visited[idx] = 1;
          q.push(idx);
        };
  
        // Mép trên & dưới
        for (let x = 0; x < width; x++) {
          enqueue(x, 0);
          enqueue(x, height - 1);
        }
        // Mép trái & phải
        for (let y = 0; y < height; y++) {
          enqueue(0, y);
          enqueue(width - 1, y);
        }
  
        while (q.length) {
          const idx = q.shift()!;
          const x = idx % width;
          const y = (idx / width) | 0;
  
          // 4-neighbors
          if (x > 0) enqueue(x - 1, y);
          if (x < width - 1) enqueue(x + 1, y);
          if (y > 0) enqueue(x, y - 1);
          if (y < height - 1) enqueue(x, y + 1);
        }
  
        // 3) Tạo mask: vùng tế bào = stroke || (không visited & không stroke)
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const mctx = maskCanvas.getContext('2d');
        if (!mctx) return;
  
        const maskImageData = mctx.createImageData(width, height);
        const md = maskImageData.data;
        const grayVal = 220; // màu xám cho tế bào
  
        let hasRegion = false;
  
        for (let idx = 0; idx < stroke.length; idx++) {
          const isStroke = stroke[idx] === 1;
          const isBackground = visited[idx] === 1;
          const isCell = isStroke || !isBackground; // bên trong vòng kín
  
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
          alert('Không tìm thấy vùng nào được khoanh kín để tạo mask.');
          return;
        }
  
        mctx.putImageData(maskImageData, 0, 0);
        const maskDataUrl = maskCanvas.toDataURL('image/png');
  
        // Lưu mask tạm lên current file (FE)
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
  
      image.onerror = (e) => {
        console.error('Create mask failed', e);
        alert('Không thể đọc ảnh để tạo mask (CORS / lỗi tải ảnh).');
      };
    };
  
    window.addEventListener('createMask', handleCreateMaskEvent as EventListener);
    return () => {
      window.removeEventListener('createMask', handleCreateMaskEvent as EventListener);
    };
  }, [currentFile, currentImageURL, currentIndex, setVisibleImages]);
  
  return (
    <div id="image-view">
      {currentFile && showProperties && (
        <div id="image-properties">
          <h2>Properties</h2>
          <p>Name: {currentFile.filename}</p>
          <p>Size: {formatFileSize(currentFile.size)}</p>
          <p>Width: {currentFile.width} px</p>
          <p>Height: {currentFile.height} px</p>
          <p>Bit Depth: {currentFile.bitDepth} bit</p>
        </div>
      )}

      <div id="image-container">
        <div id="image-controls">
          <button className="image-controls-btn" onClick={handlePrev} disabled={currentIndex === 0 || visibleImages.length <= 1}>
            <ChevronLeft className="image-controls-icon" />
            Previous Frame
          </button>

          <button
            className="image-controls-btn"
            onClick={handleToggleMask}
            disabled={!currentFile?.mask_url}
          >
            {showMask ? 'Hide Mask' : 'Show Mask'}
          </button>

          <button className="image-controls-btn" onClick={handleNext} disabled={currentIndex === visibleImages.length - 1}>
            Next Frame
            <ChevronRight className="image-controls-icon" />
          </button>
        </div>

        <div 
          id="image-display" 
          className={showMask ? 'show-mask-layout' : ''}
        >
          {currentImageURL && (
            <div id="image-wrapper">
              <img
                ref={imgRef}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                src={currentImageURL}
                alt={currentFile?.filename}
                className={showMask ? 'small-image' : ''}
                style={{
                  // scale dùng để zoom (in/out) ảnh bên trong khung,
                  // KHÔNG đụng vào kích thước layout ban đầu của ảnh
                  transform: scaleToFit ? 'none' : `scale(${zoomLevel})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transformOrigin: 'center center',
                }}
              />

              {isCropping && (
                <CropOverlay
                  ref={cropRef}
                  imgRef={imgRef}
                  onCrop={() => {
                    const rel = cropRef.current?.getRelativeRect();
                    if (rel) {
                      setCropRectData(rel);
                      setShowConfirmCrop(true);
                    }
                  }}
                  onCancel={handleCancelCrop}
                />
              )}
            </div>
          )}

          {showMask && currentFile?.mask_url && (
            <img
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              src={currentFile.mask_url}
              alt={`${currentFile?.filename} mask`}
              className="mask-image small-image"
            />
          )}

          <RoiOverlay
            tool={activeTool}
            disabled={isCropping}
            imgRef={imgRef}
            frameIndex={currentIndex}
          />

          <BrushOverlay
            tool={activeTool}
            disabled={isCropping}
            imgRef={imgRef}
            onCommit={handleBrushCommit}
          />

          {isCropping && (
            <div className="crop-controls">
              <button
                onClick={() => {
                  const rel = cropRef.current?.getRelativeRect();
                  if (rel) {
                    setCropRectData(rel);
                    setShowConfirmCrop(true);
                  }
                }}
              >
                Crop
              </button>
              <button onClick={handleCancelCrop}>Cancel</button>
            </div>
          )}
        </div>

        <p>Frame {currentIndex + 1} of {visibleImages.length}</p>

        {showConfirmCrop && cropRectData && (
          <div className="confirm-popup">
            <div className="confirm-box">
              <p>Do you want to replace the original image?</p>
              <div className="confirm-buttons">
                <button
                  className="yes"
                  onClick={() => handleCrop(cropRectData)}
                >
                  Yes
                </button>
                <button className="no" onClick={() => setShowConfirmCrop(false)}>No</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="image-gallery">
        <h2>Gallery</h2>
        {visibleImages.map((image, index) => {
          const isActive = index === currentIndex;
          return (
            <div key={index} className="gallery-item">
              <img
                src={image.cropped_url || image.url}
                alt={image.filename}
                onClick={() => {
                  setCurrentIndex(index);
                }}
                className={isActive ? 'img-active' : ''}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageView;
