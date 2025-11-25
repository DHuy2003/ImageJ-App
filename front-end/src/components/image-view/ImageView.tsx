import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CropOverlayHandle } from '../../types/crop';
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
  const [undoStack, setUndoStack] = useState<UndoEntry[][]>(() =>
    imageArray.map(() => [] as UndoEntry[]),
  );
  
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

  useEditEvents({
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

      pushUndo();
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
