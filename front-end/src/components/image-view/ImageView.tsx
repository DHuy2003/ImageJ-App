import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CropOverlayHandle } from '../../types/crop';
import type { ImageEventPayload, ImageViewProps, Translation } from '../../types/image';
import type { ToolbarAction } from '../../types/toolbar';
import { base64ToBytes, formatFileSize } from '../../utils/common/formatFileSize';
import { IMAGE_EVENT_NAME } from '../../utils/nav-bar/imageUtils';
import { TOOLBAR_EVENT_NAME } from '../../utils/tool-bar/toolBarUtils';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import { showSelectionRequired, type RoiTool, type SelectedRoiInfo } from '../../types/roi';
import './ImageView.css';


const ImageView = ({ imageArray }: ImageViewProps) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentImageURL, setCurrentImageURL] = useState<string>();
  const currentFile = imageArray[currentIndex];
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
  const navigate = useNavigate();

  // --- THÊM HẰNG SỐ GIỚI HẠN ZOOM ---
  const MAX_SCALE = 30; // Giới hạn zoom in tối đa (ví dụ: 3000%)
  const MIN_SCALE = 0.1;  // Giới hạn zoom out (1 = 100%, khớp với SCALE_TO_FIT)

  // --- STATE MỚI CHO ZOOM VÀ PAN ---
  const [scale, setScale] = useState(1);
  const [translation, setTranslation] = useState<Translation>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Translation>({ x: 0, y: 0 });
  const displayRef = useRef<HTMLDivElement>(null); // Ref cho container #image-display


  useEffect(() => {
    const listener = () => setIsCropping(true);
    window.addEventListener('enableCropMode', listener);
    return () => window.removeEventListener('enableCropMode', listener);
  }, []);

  useEffect(() => {
    const listener = (e: Event) => {
      const action = (e as CustomEvent<ToolbarAction>).detail;

      if (action.type === 'SET_TOOL') {
        setActiveTool(action.tool as RoiTool);
      }
    };

    window.addEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);

    return () => {
      window.removeEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
    };
  }, []);

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
      const ce = e as CustomEvent<{ color?: string }>;
      const color = ce.detail?.color || '#000000';
      applyRoiEdit('fill', selectedRoi, color);
    };

    const onInvert = () => {
      if (!selectedRoi) {
        showSelectionRequired();
        return;
      }
      applyRoiEdit('invert', selectedRoi);
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
  
    window.addEventListener('editClear', onClear);
    window.addEventListener('editClearOutside', onClearOutside);
    window.addEventListener('editFill', onFill as EventListener);

    return () => {
      window.removeEventListener('editClear', onClear);
      window.removeEventListener('editClearOutside', onClearOutside);
      window.removeEventListener('editFill', onFill as EventListener);
      window.removeEventListener('editInvert', onInvert);     
      window.removeEventListener('editDraw', onDraw);
    };
  }, [selectedRoi, currentIndex, imageArray, currentImageURL]);

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

    // --- LOGIC CROP GIỮ NGUYÊN ---
    // (Lưu ý: Phép tính crop này dựa trên naturalWidth/Height,
    // nó độc lập với scale và translation của view hiện tại, nên vẫn đúng)
    const imgRect = img.getBoundingClientRect();

    // Tính tọa độ crop dựa trên vị trí của cropRect so với imgRect (đã scale)
    let cropX = (cropRect.left - imgRect.left) * (img.naturalWidth / imgRect.width);
    let cropY = (cropRect.top - imgRect.top) * (img.naturalHeight / imgRect.height);
    let cropW = cropRect.width * (img.naturalWidth / imgRect.width);
    let cropH = cropRect.height * (img.naturalHeight / imgRect.height);

    // Clamp giá trị (giữ nguyên)
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

      const base64 = newSrc.split(",")[1];
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
      navigate("/display-images", {
        state: { imageArray: updatedImageArray },
        replace: true,
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

  const saveUndoSnapshot = () => {
    if (!currentImageURL) return;
    setUndoSnapshot(currentImageURL);
  };

  const applyRoiEdit = (
    mode: 'clear' | 'clearOutside' | 'fill' | 'invert' | 'draw',
    roi: SelectedRoiInfo,
    color?: string
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
                data[idx]     = 255 - data[idx];     // R
                data[idx + 1] = 255 - data[idx + 1]; // G
                data[idx + 2] = 255 - data[idx + 2]; // B
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

  useEffect(() => {
    const onUndo = () => {
      if (!undoSnapshot) {
        return;
      }

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
  }, [undoSnapshot, currentIndex, imageArray, navigate]);

  const handleCancelCrop = () => {
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < imageArray.length - 1 ? prevIndex + 1 : prevIndex));
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
          <button className="image-controls-btn" onClick={handlePrev} disabled={currentIndex === 0 || imageArray.length <= 1}>
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

          <button className="image-controls-btn" onClick={handleNext} disabled={currentIndex === imageArray.length - 1}>
            Next Frame
            <ChevronRight className="image-controls-icon" />
          </button>
        </div>

        <div id="image-display" className={`${showMask ? 'show-mask-layout' : ''} ${isPanning ? 'is-panning' : ''}`}
          // --- THÊM REF VÀ CÁC TRÌNH XỬ LÝ CHUỘT ---
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

        </div>

        <p>Frame {currentIndex + 1} of {imageArray.length}</p>

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
        {imageArray.map((image, index) => {
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
