import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import type { CropOverlayHandle } from '../../types/crop';
import type { ImageEventPayload, ImageInfo, ImageViewProps, Translation } from '../../types/image';
import { base64ToBytes, formatFileSize } from '../../utils/common/formatFileSize';
import { IMAGE_EVENT_NAME } from '../../utils/nav-bar/imageUtils';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import { type RoiTool, type SelectedRoiInfo } from '../../types/roi';
import './ImageView.css';
import useEditEvents from './hooks/useEditEvents';
import { useToolbarToolSelection } from './hooks/useToolbarToolSelection';
import useFileEvents from './hooks/useFileEvents';
import BrushOverlay from '../brush-overlay/BrushOverlay';


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
  const [cropRectData, setCropRectData] = useState<DOMRect | null>(null);
  const [activeTool, setActiveTool] = useState<RoiTool>('pointer');
  const [selectedRoi, setSelectedRoi] = useState<SelectedRoiInfo>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<string | null>(null);

  // --- THÊM HẰNG SỐ GIỚI HẠN ZOOM ---
  const MAX_SCALE = 30; // Giới hạn zoom in tối đa (ví dụ: 3000%)
  const MIN_SCALE = 0.1;  // Giới hạn zoom out (1 = 100%, khớp với SCALE_TO_FIT)

  // --- STATE MỚI CHO ZOOM VÀ PAN ---
  const [scale, setScale] = useState(1);
  const [translation, setTranslation] = useState<Translation>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Translation>({ x: 0, y: 0 });
  const displayRef = useRef<HTMLDivElement>(null);

  useEditEvents({
    imgRef,
    selectedRoi,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
    imageArray,
    currentIndex,
    undoSnapshot,
    setUndoSnapshot,
    setIsCropping,
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
    setVisibleImages(imageArray);
    setCurrentIndex(0);
    setCurrentImageURL(null);
  }, [imageArray]);

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

  // --- EFFECT MỚI ĐỂ LẮNG NGHE SỰ KIỆN ZOOM TỪ NAVBAR ---
  useEffect(() => {
    const handleImageEvent = (e: Event) => {
      const action = (e as CustomEvent<ImageEventPayload>).detail;
      const displayRect = displayRef.current?.getBoundingClientRect();
      if (!displayRect) return;

      switch (action.type) {
        // --- LOGIC ZOOM_IN ĐÃ SỬA ---
        case 'ZOOM_IN':
          setScale(prevScale => {
            // Kiểm tra giới hạn TỐI ĐA
            if (prevScale >= MAX_SCALE) return MAX_SCALE;

            let newScale = prevScale * 1.2;
            if (newScale > MAX_SCALE) newScale = MAX_SCALE; // Chốt ở MAX_SCALE
            return newScale;
          });
          break;
        // --- LOGIC ZOOM_OUT ĐÃ SỬA ---
        case 'ZOOM_OUT':
          setScale(prevScale => {
            // Kiểm tra giới hạn TỐI THIỂU
            if (prevScale <= MIN_SCALE) return MIN_SCALE;

            let newScale = prevScale / 1.2;

            // Nếu vượt quá giới hạn MIN, reset về MIN
            if (newScale < MIN_SCALE) {
              newScale = MIN_SCALE;
            }
            return newScale;
          });
          break;
        case 'SCALE_TO_FIT':
          setScale(1); // Dùng MIN_SCALE
          setTranslation({ x: 0, y: 0 });
          break;

        // --- LOGIC ZOOM_TO_SELECTION (Giữ nguyên) ---
        case 'ZOOM_TO_SELECTION':
          // (Logic này giữ nguyên)
          if (selectedRoi && displayRect) {
            const { x, y, width, height } = selectedRoi;
            if (width > 0 && height > 0) {
              let newScale = Math.min(
                displayRect.width / width,
                displayRect.height / height
              ) * 0.95;
              // Đảm bảo không zoom in quá MAX_SCALE
              if (newScale > MAX_SCALE) newScale = MAX_SCALE;
              if (newScale < MIN_SCALE) newScale = MIN_SCALE;

              const newX = -(x * newScale) + (displayRect.width - width * newScale) / 2;
              const newY = -(y * newScale) + (displayRect.height - height * newScale) / 2;
              setScale(newScale);
              setTranslation({ x: newX, y: newY });
              break;
            }
          }

          if (isCropping && cropRef.current) {
            const selectionRect = cropRef.current.getRect();
            if (selectionRect && displayRect && selectionRect.width > 0 && selectionRect.height > 0) {
              let newScale = Math.min(
                displayRect.width / selectionRect.width,
                displayRect.height / selectionRect.height
              ) * 0.95;
              if (newScale > MAX_SCALE) newScale = MAX_SCALE;
              if (newScale < MIN_SCALE) newScale = MIN_SCALE;

              const selRelX = selectionRect.left - displayRect.left;
              const selRelY = selectionRect.top - displayRect.top;

              const newX = -selRelX * newScale + (displayRect.width - selectionRect.width * newScale) / 2;
              const newY = -selRelY * newScale + (displayRect.height - selectionRect.height * newScale) / 2;
              setScale(newScale);
              setTranslation({ x: newX, y: newY });
            }
          }
          break;
      }
    };

    window.addEventListener(IMAGE_EVENT_NAME, handleImageEvent as EventListener);
    return () => {
      window.removeEventListener(IMAGE_EVENT_NAME, handleImageEvent as EventListener);
    };
  }, [isCropping, selectedRoi, translation.x, translation.y]);

  useEffect(() => {
    if (currentFile) {
      if (currentFile.cropped_url) {
        setCurrentImageURL(currentFile.cropped_url);
      } else if (currentFile.url) {
        setCurrentImageURL(currentFile.url);
      }
      // Reset zoom/pan khi đổi ảnh
      setScale(1);
    }
  }, [currentFile, currentIndex]);


  const handleCrop = (cropRect: DOMRect) => {
    const img = imgRef.current;
    if (!img) return;
    
    const imgRect = img.getBoundingClientRect();

    let cropX = (cropRect.left - imgRect.left) * (img.naturalWidth / imgRect.width);
    let cropY = (cropRect.top - imgRect.top) * (img.naturalHeight / imgRect.height);
    let cropW = cropRect.width * (img.naturalWidth / imgRect.width);
    let cropH = cropRect.height * (img.naturalHeight / imgRect.height);

    cropX = Math.max(0, Math.min(cropX, img.naturalWidth));
    cropY = Math.max(0, Math.min(cropY, img.naturalHeight));
    cropW = Math.max(1, Math.min(cropW, img.naturalWidth - cropX));
    cropH = Math.max(1, Math.min(cropH, img.naturalHeight - cropY));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    let src = img.currentSrc || img.src;

    if (/^https?:\/\//i.test(src)) {
      src += (src.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
    }
    image.src = src;

    image.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    
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
            bitDepth: 8, 
          } as any;
        }
        return copy;
      });
    
      setIsCropping(false);
      setShowConfirmCrop(false);
      setCropRectData(null);
    };    

    image.onerror = (e) => {
      console.error('Image load (CORS) failed: ', e, src);
      alert('Cannot export cropped image due to CORS. Please refresh after backend CORS fix.');
    };
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

  // --- CÁC HÀM XỬ LÝ CHUỘT MỚI CHO ZOOM/PAN ---

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (isCropping) return; // Không zoom khi đang crop
    e.preventDefault();

    const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2; // Zoom in hoặc out

    setScale(prevScale => {
      let newScale = prevScale * delta;
      // Áp dụng giới hạn
      if (newScale > MAX_SCALE) return MAX_SCALE;
      if (newScale < MIN_SCALE) return MIN_SCALE;
      return newScale;
    });
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Chỉ pan khi dùng tool 'pointer' và không đang crop
    if (activeTool !== 'pointer' || isCropping) return;

    e.preventDefault();
    setIsPanning(true);
    setPanStart({
      x: e.clientX - translation.x,
      y: e.clientY - translation.y,
    });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isPanning || activeTool !== 'pointer' || isCropping) return;

    e.preventDefault();
    setTranslation({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUpOrLeave = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      e.preventDefault();
      setIsPanning(false);
    }
  };
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

        <div id="image-display" className={`${showMask ? 'show-mask-layout' : ''} ${isPanning ? 'is-panning' : ''}`}
          ref={displayRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {currentImageURL && (
            <img
              ref={imgRef}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              src={currentImageURL}
              alt={currentFile?.filename}
              // --- THÊM STYLE CHO ZOOM VÀ PAN ---
              style={{
                transform: `scale(${scale}) translate(${translation.x}px, ${translation.y}px)`,
                transformOrigin: 'top left', // Đặt gốc transform ở góc trên bên trái
                cursor: (activeTool === 'pointer' && !isCropping) ? (isPanning ? 'grabbing' : 'grab') : 'default'
              }}
              className={showMask ? 'small-image' : ''}
              onDragStart={(e) => e.preventDefault()} // Ngăn hành vi kéo ảnh mặc định
            />
          )}

          {showMask && currentFile?.mask_url && (
            <img
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              src={currentFile.mask_url}
              alt={`${currentFile?.filename} mask`}
              className="mask-image small-image"
              // --- ÁP DỤNG CÙNG TRANSFORM CHO MASK ---
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center'
              }}
              onDragStart={(e) => e.preventDefault()}
            />
          )}

          {isCropping && (
            <CropOverlay
              ref={cropRef}
              imgRef={imgRef}
              onCrop={(cropRect) => {
                setCropRectData(cropRect);
                setShowConfirmCrop(true);
              }}
              onCancel={handleCancelCrop}
            />
          )}

          <RoiOverlay tool={activeTool} disabled={isCropping} imgRef={imgRef} />
          <BrushOverlay tool={activeTool} disabled={isCropping} imgRef={imgRef} />

        </div>

        <p>Frame {currentIndex + 1} of {visibleImages.length}</p>

        {isCropping && (
          <div className="crop-controls">
            <button
              onClick={() => {
                const rect = cropRef.current?.getRect();
                if (rect) {
                  setCropRectData(rect);
                  setShowConfirmCrop(true);
                }
              }}
            >
              Crop
            </button>
            <button onClick={handleCancelCrop}>Cancel</button>
          </div>
        )}

        {showConfirmCrop && cropRectData && (
          <div className="confirm-popup">
            <div className="confirm-box">
              <p>Do you want to replace the original image?</p>
              <div className="confirm-buttons">
                <button className="yes" onClick={() => handleCrop(cropRectData)}>Yes</button>
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
