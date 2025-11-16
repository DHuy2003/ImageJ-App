import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import './ImageView.css';
import { formatFileSize, base64ToBytes} from '../../utils/common/formatFileSize';
import type { ImageViewProps } from '../../types/image';
import CropOverlay from '../crop-overlay/CropOverlay';
import type { CropOverlayHandle } from '../../types/crop';
import { useNavigate } from 'react-router-dom';
import type { ToolbarAction } from '../../types/toolbar';
import { TOOLBAR_EVENT_NAME } from '../../utils/tool-bar/toolBarUtils';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import { showSelectionRequired, type RoiTool, type SelectedRoiInfo } from '../../types/roi';

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
  
    return () => {
      window.removeEventListener('editClear', onClear);
      window.removeEventListener('editClearOutside', onClearOutside);
      window.removeEventListener('editFill', onFill as EventListener);
      window.removeEventListener('editInvert', onInvert);     
      window.removeEventListener('editDraw', onDraw);
    };
  }, [selectedRoi, currentIndex, imageArray, currentImageURL]);  

  useEffect(() => {
    if (currentFile) {
      if (currentFile.cropped_url) {
        setCurrentImageURL(currentFile.cropped_url);
      } else if (currentFile.url) {
        setCurrentImageURL(currentFile.url);
      }
    }
  }, [currentFile, currentIndex]);

  const handleCrop = (cropRect: DOMRect) => {
    const img = imgRef.current;
    if (!img) return;

    const imgRect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    let cropX = (cropRect.left - imgRect.left) * scaleX;
    let cropY = (cropRect.top - imgRect.top) * scaleY;
    let cropW = cropRect.width * scaleX;
    let cropH = cropRect.height * scaleY;

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

        <div id="image-display" className={showMask ? 'show-mask-layout' : ''}>
          {currentImageURL && (
            <img
              ref={imgRef}
              crossOrigin="anonymous"          
              referrerPolicy="no-referrer"
              src={currentImageURL}
              alt={currentFile?.filename}
              className={showMask ? 'small-image' : ''}
            />
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
