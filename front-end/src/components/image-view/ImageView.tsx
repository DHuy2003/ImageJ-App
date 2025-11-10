import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ImageInfo } from '../../types/image';
import formatFileSize from '../../utils/common/formatFileSize';
import CropOverlay from '../crop-overlay/CropOverlay';
import './ImageView.css';

type ImageViewProps = {
  imageArray: ImageInfo[];
};

const ImageView = ({ imageArray }: ImageViewProps) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentImageURL, setCurrentImageURL] = useState<string>();
  const currentFile = imageArray[currentIndex];
  const [isCropping, setIsCropping] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showProperties, setShowProperties] = useState(true); // New state for properties
  const imgRef = useRef<HTMLImageElement>(null);
  const imageDisplayRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [selectionArea, setSelectionArea] = useState<DOMRect | null>(null);

  // Bật crop mode khi event được phát
  useEffect(() => {
    const listener = () => setIsCropping(true);
    window.addEventListener('enableCropMode', listener);
    return () => window.removeEventListener('enableCropMode', listener);
  }, []);

  // Store selection area when cropping
  useEffect(() => {
    if (isCropping && imgRef.current) {
      const updateSelection = () => {
        const cropOverlay = document.querySelector('.crop-overlay') as HTMLElement;
        if (cropOverlay && imgRef.current) {
          const overlayRect = cropOverlay.getBoundingClientRect();
          const imgRect = imgRef.current.getBoundingClientRect();
          // Store relative to image
          setSelectionArea({
            ...overlayRect,
            left: overlayRect.left - imgRect.left,
            top: overlayRect.top - imgRect.top,
          } as DOMRect);
        }
      };

      // Update selection periodically while cropping
      const interval = setInterval(updateSelection, 100);
      updateSelection(); // Initial update

      return () => clearInterval(interval);
    } else {
      // Clear selection when not cropping
      setSelectionArea(null);
    }
  }, [isCropping]);

  // Zoom event listeners
  useEffect(() => {
    const handleZoomIn = () => {
      setZoomLevel((prev) => {
        const newZoom = Math.min(prev * 1.25, 10); // Max zoom 10x
        return newZoom;
      });
    };

    const handleZoomOut = () => {
      setZoomLevel((prev) => {
        const newZoom = Math.max(prev / 1.25, 0.1); // Min zoom 0.1x
        return newZoom;
      });
    };

    const handleZoomToSelection = () => {
      // Try to get selection from crop overlay if active
      const cropOverlay = document.querySelector('.crop-overlay') as HTMLElement;
      if (!cropOverlay && !selectionArea) {
        alert('No selection area available. Please create a selection first using the crop tool.');
        return;
      }

      if (!imgRef.current || !imageDisplayRef.current) return;

      const img = imgRef.current;
      const display = imageDisplayRef.current;
      const imgRect = img.getBoundingClientRect();
      const displayRect = display.getBoundingClientRect();

      let selectionRect: DOMRect;
      if (cropOverlay) {
        const overlayRect = cropOverlay.getBoundingClientRect();
        selectionRect = {
          ...overlayRect,
          left: overlayRect.left - imgRect.left,
          top: overlayRect.top - imgRect.top,
        } as DOMRect;
      } else if (selectionArea) {
        selectionRect = selectionArea;
      } else {
        return;
      }

      // Calculate zoom to fit selection in display (with some padding)
      const padding = 0.9; // 90% of display
      const scaleX = (displayRect.width * padding) / selectionRect.width;
      const scaleY = (displayRect.height * padding) / selectionRect.height;
      const baseScale = imgRect.width / img.naturalWidth;
      const newZoom = Math.min(scaleX, scaleY) * baseScale;

      // Calculate pan to center selection
      const selectionCenterX = selectionRect.left + selectionRect.width / 2;
      const selectionCenterY = selectionRect.top + selectionRect.height / 2;
      const imgCenterX = imgRect.width / 2;
      const imgCenterY = imgRect.height / 2;

      setZoomLevel(Math.max(newZoom, 1)); // Don't zoom out below 100%
      setPanX((imgCenterX - selectionCenterX) * newZoom);
      setPanY((imgCenterY - selectionCenterY) * newZoom);
    };

    const handleScaleToFit = () => {
      if (!imgRef.current || !imageDisplayRef.current) return;

      const img = imgRef.current;
      const display = imageDisplayRef.current;

      const calculateFit = () => {
        const displayRect = display.getBoundingClientRect();
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          // Image not loaded yet, wait for it
          return;
        }
        const scaleX = displayRect.width / img.naturalWidth;
        const scaleY = displayRect.height / img.naturalHeight;
        const newZoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

        setZoomLevel(newZoom);
        setPanX(0);
        setPanY(0);
      };

      if (img.complete && img.naturalWidth > 0) {
        calculateFit();
      } else {
        img.onload = calculateFit;
      }
    };

    window.addEventListener('zoomIn', handleZoomIn);
    window.addEventListener('zoomOut', handleZoomOut);
    window.addEventListener('zoomToSelection', handleZoomToSelection);
    window.addEventListener('scaleToFit', handleScaleToFit);

    return () => {
      window.removeEventListener('zoomIn', handleZoomIn);
      window.removeEventListener('zoomOut', handleZoomOut);
      window.removeEventListener('zoomToSelection', handleZoomToSelection);
      window.removeEventListener('scaleToFit', handleScaleToFit);
    };
  }, [selectionArea]);

  // Reset zoom when image changes
  useEffect(() => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
    setSelectionArea(null);
  }, [currentImageURL]);

  // Listen for image type changes
  useEffect(() => {
    const handleImageTypeChanged = (e: CustomEvent) => {
      const { imageArray: updatedArray, currentIndex: updatedIndex } = e.detail;
      if (updatedArray && updatedArray[updatedIndex]) {
        const updatedImage = updatedArray[updatedIndex];
        // Update the current image URL to trigger re-render
        setCurrentImageURL(`${updatedImage.url}?t=${Date.now()}`);
        // Update the image array in the component if needed
        // The parent component should handle the array update, but we'll update local state
        if (updatedIndex === currentIndex) {
          // Force re-render with new image
          setCurrentImageURL(updatedImage.url);
        }
      }
    };

    window.addEventListener('imageTypeChanged', handleImageTypeChanged as EventListener);
    return () => window.removeEventListener('imageTypeChanged', handleImageTypeChanged as EventListener);
  }, [currentIndex]);

  // Cập nhật URL khi đổi ảnh
  useEffect(() => {
    if (currentFile?.url && currentFile.url !== currentImageURL) {
      setCurrentImageURL(currentFile.url);
    }
    console.log('Current File in ImageView:', currentFile);
    console.log('Current File Mask URL:', currentFile?.mask_url);
  }, [currentFile, currentImageURL]); // Added currentImageURL to dependencies to avoid unnecessary logs

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < imageArray.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const handleToggleMask = () => {
    setShowMask((prev) => !prev);
    setShowProperties((prev) => !prev); // Toggle properties visibility as well
  };

  return (
    <div id="image-view">
      {currentFile && showProperties && ( // Conditionally render properties
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
            disabled={!currentFile?.mask_url} // Disable if no mask_url
          >
            {showMask ? "Hide Mask" : "Show Mask"}
          </button>

          <button className="image-controls-btn" onClick={handleNext} disabled={currentIndex === imageArray.length - 1}>
            Next Frame
            <ChevronRight className="image-controls-icon" />
          </button>
        </div>

        <div
          id="image-display"
          ref={imageDisplayRef}
          className={showMask ? 'show-mask-layout' : ''}
          style={{
            overflow: zoomLevel > 1 ? 'auto' : 'hidden',
            position: 'relative',
          }}
        >
          {currentImageURL && (
            <>
              <div
                style={{
                  width: showMask ? '50%' : '100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: zoomLevel > 1 ? 'auto' : 'visible',
                  transform: `translate(${panX}px, ${panY}px)`,
                }}
              >
                <img
                  ref={imgRef}
                  src={currentImageURL}
                  alt={currentFile?.filename}
                  className={showMask ? 'small-image' : ''}
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
              {showMask && currentFile?.mask_url && (
                <img
                  src={currentFile.mask_url}
                  alt={`${currentFile?.filename} mask`}
                  className="mask-image small-image"
                  style={{ maxWidth: '50%', maxHeight: '100%', objectFit: 'contain' }}
                />
              )}
            </>
          )}

          {isCropping && (
            <CropOverlay
              imgRef={imgRef}
              onCrop={(cropRect) => {
                const img = imgRef.current;
                if (!img) return;

                const imgRect = img.getBoundingClientRect();
                // Account for zoom and pan
                const adjustedLeft = (cropRect.left - imgRect.left - panX) / zoomLevel;
                const adjustedTop = (cropRect.top - imgRect.top - panY) / zoomLevel;
                const adjustedWidth = cropRect.width / zoomLevel;
                const adjustedHeight = cropRect.height / zoomLevel;

                const scaleX = img.naturalWidth / imgRect.width;
                const scaleY = img.naturalHeight / imgRect.height;

                const cropX = adjustedLeft * scaleX;
                const cropY = adjustedTop * scaleY;
                const cropW = adjustedWidth * scaleX;
                const cropH = adjustedHeight * scaleY;

                const canvas = document.createElement("canvas");
                canvas.width = cropW;
                canvas.height = cropH;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                const image = new Image();
                console.log("image src", img.src);
                image.src = img.src;
                image.onload = () => {
                  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                  const newSrc = canvas.toDataURL("image/png");

                  const confirmReplace = window.confirm("Bạn có muốn thay thế ảnh gốc không?");
                  if (confirmReplace) {
                    const updatedArray = [...imageArray];
                    updatedArray[currentIndex] = {
                      ...updatedArray[currentIndex],
                      url: newSrc,
                    };

                    // ✅ Cập nhật ảnh hiển thị ngay
                    setCurrentImageURL(`${newSrc}?t=${Date.now()}`);

                    // ✅ Lưu sessionStorage để sau còn tải về
                    sessionStorage.setItem("imageArray", JSON.stringify(updatedArray));

                    console.log("✅ Cập nhật thành công:", updatedArray[currentIndex]);
                  }

                  setIsCropping(false);
                  setZoomLevel(1);
                  setPanX(0);
                  setPanY(0);
                };
              }}
              onCancel={() => {
                setIsCropping(false);
                setSelectionArea(null);
              }}
            />
          )}
        </div>

        <p>Frame {currentIndex + 1} of {imageArray.length}</p>
      </div>

      <div id="image-gallery">
        <h2>Gallery</h2>
        {imageArray.map((image, index) => {
          const isActive = index === currentIndex;
          return (
            <div key={index} className="gallery-item">
              <img
                src={image.url}
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
