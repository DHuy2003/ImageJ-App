import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import './ImageView.css';
import { formatFileSize, base64ToBytes} from '../../utils/common/formatFileSize';
import type { ImageViewProps } from '../../types/image';
import CropOverlay from '../crop-overlay/CropOverlay';
import type { CropOverlayHandle } from '../../types/crop';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  useEffect(() => {
    const listener = () => setIsCropping(true);
    window.addEventListener('enableCropMode', listener);
    return () => window.removeEventListener('enableCropMode', listener);
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
