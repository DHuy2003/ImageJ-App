import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft} from 'lucide-react';
import './ImageView.css';
import formatFileSize from '../../utils/common/formatFileSize';
import type { ImageInfo } from '../../types/image';
import CropOverlay from '../crop-overlay/CropOverlay';

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

  // Bật crop mode khi event được phát
  useEffect(() => {
    const listener = () => setIsCropping(true);
    window.addEventListener('enableCropMode', listener);
    return () => window.removeEventListener('enableCropMode', listener);
  }, []);

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

        <div id="image-display" className={showMask ? 'show-mask-layout' : ''}> {/* Add class for conditional layout */}
          {currentImageURL && <img ref={imgRef} src={currentImageURL} alt={currentFile?.filename} className={showMask ? 'small-image' : ''}/>}
          {showMask && currentFile?.mask_url && (
            <img
              src={currentFile.mask_url}
              alt={`${currentFile?.filename} mask`}
              className="mask-image small-image" // Add small-image class
              style={{ }} // Remove opacity
            />
          )}

          {isCropping && (
            <CropOverlay
              imgRef={imgRef}
              onCrop={(cropRect) => {
                const img = imgRef.current;
                if (!img) return;

                const imgRect = img.getBoundingClientRect();
                const scaleX = img.naturalWidth / imgRect.width;
                const scaleY = img.naturalHeight / imgRect.height;

                const cropX = (cropRect.left - imgRect.left) * scaleX;
                const cropY = (cropRect.top - imgRect.top) * scaleY;
                const cropW = cropRect.width * scaleX;
                const cropH = cropRect.height * scaleY;

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
                };
              }}
              onCancel={() => setIsCropping(false)}
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
