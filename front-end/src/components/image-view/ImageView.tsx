import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CropOverlayHandle, RelativeCropRect } from '../../types/crop';
import type { ImageInfo, ImageViewProps } from '../../types/image';
import { type RoiTool } from '../../types/roi';
import { formatFileSize } from '../../utils/common/formatFileSize';
import { IMAGES_APPENDED_EVENT } from '../../utils/nav-bar/fileUtils';
import { analyzeImageHistogram, processBrightnessContrast } from '../../utils/nav-bar/imageUtils'; // Import helpers
import BrushOverlay from '../brush-overlay/BrushOverlay';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import './ImageView.css';
import BrightnessContrastDialog from './dialogs/BrightContrast';
import useBrushCommit from './hooks/useBrushCommit';
import useEditEvents from './hooks/useEditEvents';
import useFileEvents from './hooks/useFileEvents';
import useMaskCreation from './hooks/useMaskCreation';
import usePanMode from './hooks/usePanMode';
import useRoiSelection from './hooks/useRoiSelection';
import { useToolbarToolSelection } from './hooks/useToolbarToolSelection';
import useUndoStack from './hooks/useUndoStack';

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
  const selectedRoi = useRoiSelection();
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM_LEVEL);
  const [scaleToFit, setScaleToFit] = useState<boolean>(true);
  const [panMode, setPanMode] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showBC, setShowBC] = useState(false);
  const [displayRange, setDisplayRange] = useState({ min: 0, max: 255 });
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [histogramData, setHistogramData] = useState<number[]>([]);
  const { pushUndo } = useUndoStack({
    visibleImages,
    currentIndex,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
    setVisibleImages,
  });

  const {
    pan,
    cursor,
    isPanning,
    handleMouseDown: handlePanMouseDown,
    handleMouseMove: handlePanMouseMove,
    handleMouseUp: handlePanMouseUp,
    handleMouseLeave: handlePanMouseLeave,
  } = usePanMode({
    wrapperRef,
    imgRef,
    scaleToFit,
    zoomLevel,
    panMode,
  });

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

  useMaskCreation({
    imgRef,
    currentFile: currentFile ?? null,
    currentImageURL,
    currentIndex,
    setVisibleImages,
    setShowMask,
    setShowProperties,
  });

  const handleBrushCommit = useBrushCommit({
    imgRef,
    currentFile: currentFile ?? null,
    currentImageURL,
    currentIndex,
    setCurrentImageURL,
    setVisibleImages,
    pushUndo,
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

  useToolbarToolSelection(setActiveTool, setPanMode);

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
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
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

  //New
  const getImageData = (): { ctx: CanvasRenderingContext2D, imageData: ImageData, canvas: HTMLCanvasElement } | null => {
    if (!imgRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(imgRef.current, 0, 0);
    return { ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), canvas };
  };

  // --- Update Image Source from Canvas ---
  const updateImageFromCanvas = (canvas: HTMLCanvasElement, saveToHistory: boolean = true) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const newUrl = URL.createObjectURL(blob);

      if (saveToHistory) {
        pushUndo();
      }

      setCurrentImageURL(newUrl);
    });
  };

  const handleOpenBCEvent = () => {
        const dataObj = getImageData();
        if (dataObj) {
            setOriginalImageData(dataObj.imageData);
            const { bins } = analyzeImageHistogram(dataObj.imageData);
            setHistogramData(bins);
            setShowBC(true);
        }
    };

  // 2. Preview thay đổi (Vẽ lên Canvas nhưng không lưu History)
  const applyVisualChanges = (min: number, max: number) => {
    if (!originalImageData) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImageData.width;
    tempCanvas.height = originalImageData.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Clone dữ liệu gốc
    const freshData = new ImageData(
      new Uint8ClampedArray(originalImageData.data),
      originalImageData.width,
      originalImageData.height
    );

    // Tính toán pixel mới
    const processed = processBrightnessContrast(freshData, min, max);
    ctx.putImageData(processed, 0, 0);

    // Update lên màn hình (tham số false = không push Undo)
    updateImageFromCanvas(tempCanvas, false);
  };

  // 3. Khi người dùng thay đổi Slider (Bất kỳ slider nào từ Dialog)
  const handleBCChange = (newMin: number, newMax: number) => {
    // Cập nhật State (để Dialog hiển thị đúng số)
    setDisplayRange({ min: newMin, max: newMax });
    // Cập nhật hình ảnh
    applyVisualChanges(newMin, newMax);
  };

  // 4. Auto
  const handleBCAuto = () => {
    if (!originalImageData) return;
    // Dùng hàm phân tích mới để lấy min/max thực tế
    const { min, max } = analyzeImageHistogram(originalImageData);
    handleBCChange(min, max);
  };

  // 5. Reset (Về 0-255)
  const handleBCReset = () => {
    handleBCChange(0, 255);
  };

  // 6. Apply (Chốt đơn)
  const handleBCApply = () => {
    // Vẽ lần cuối
    applyVisualChanges(displayRange.min, displayRange.max);

    // Lưu vào Undo History (Lúc này ảnh trên màn hình đã thành ảnh gốc mới)
    pushUndo();

    // Reset thông số hiển thị về mặc định vì pixel đã bị thay đổi vĩnh viễn
    setDisplayRange({ min: 0, max: 255 });
    setOriginalImageData(null);
    setShowBC(false);
  };

  // 7. Đóng (Hủy, nhưng giữ hiển thị preview - Non-destructive viewing)
  const handleBCClose = () => {
    setShowBC(false);
    // Nếu muốn khi đóng mà hủy bỏ thay đổi (như nút Cancel), gọi handleBCReset() ở đây.
    // Nhưng ImageJ thường giữ nguyên view (non-destructive).
  };

  useEffect(() => {
    window.addEventListener('openBrightnessContrast', handleOpenBCEvent);
    return () => {
      window.removeEventListener('openBrightnessContrast', handleOpenBCEvent);
    };
  }, [currentImageURL]); // Re-bind khi URL đổi



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

      <BrightnessContrastDialog
        isOpen={showBC}
        onClose={handleBCClose}
        onApply={handleBCApply}
        onChange={handleBCChange}
        onReset={handleBCReset}
        onAuto={handleBCAuto}
        currentMin={displayRange.min}
        currentMax={displayRange.max}
        histogram={histogramData}
      />
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
            <div
              id="image-wrapper"
              ref={wrapperRef}
              onMouseDown={handlePanMouseDown}
              onMouseMove={handlePanMouseMove}
              onMouseUp={handlePanMouseUp}
              onMouseLeave={handlePanMouseLeave}
              className={`${panMode ? 'pan-mode' : ''} ${isPanning ? 'pan-active' : ''}`}
            >
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
                  transform: scaleToFit ? 'none' : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
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
            disabled={isCropping || panMode}
            imgRef={imgRef}
            frameIndex={currentIndex}
          />

          <BrushOverlay
            tool={activeTool}
            disabled={isCropping || panMode}
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
