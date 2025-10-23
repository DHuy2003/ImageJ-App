import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft} from 'lucide-react';
import './ImageView.css';
import formatFileSize from '../../utils/image-view/formatFileSize';


type ImageInfo = {
  filename: string;
  url: string;
  width: number;
  height: number;
  bitDepth: string;
  size: number;
}

type ImageViewProps = {
  imageArray: ImageInfo[];
}

const ImageView = ({imageArray} : ImageViewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageURL, setCurrentImageURL] = useState<string>("");
  const currentFile = imageArray[currentIndex]; 
  const [currentImageInfo, setCurrentImageInfo] = useState<ImageInfo>();
  
  useEffect(() => {
    if (currentFile && currentFile.url) {
      setCurrentImageURL(currentFile.url);
    }
  }, [currentIndex, currentFile]);

  useEffect(() => {
    if (currentFile) {
      setCurrentImageInfo(currentFile);
    } 
  }, [currentFile]);

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < imageArray.length - 1 ? prevIndex + 1 : prevIndex));
  };

  return (
    <div id="image-view">
      { 
        currentFile && <div id="image-properties">
          <h2>Properties</h2>
          <p>Name: {currentFile.filename}</p>
          <p>Size: {formatFileSize(currentFile.size)}</p>
          <p>Width: {currentFile.width} px</p>
          <p>Height: {currentFile.height} px</p>
          <p>Bit Depth: {currentFile.bitDepth} bit</p>
        </div>
      }
      
      <div id="image-container">
        <div id="image-controls">
          <button className="image-controls-btn" onClick={handlePrev} disabled={currentIndex === 0 || imageArray.length <= 1}>
            <ChevronLeft className="image-controls-icon" />
            Previous Frame</button>
          <button className="image-controls-btn" onClick={handleNext} disabled={currentIndex === imageArray.length - 1}>
            Next Frame
            <ChevronRight className="image-controls-icon"/>
            </button>
        </div>

        <div id='image-display'>
          {currentImageURL && <img src={currentImageURL} alt={currentFile?.filename} />}  
        </div>
        
        <p>Frame {currentIndex + 1} of {imageArray.length} </p>
      </div>

      <div id="image-gallery">
        <h2>Gallery</h2>
        {
          imageArray.map((image, index) => {
            const isActive = index === currentIndex;
            return (
              <img
                key={index}
                src={image.url}
                alt={image.filename}
                onClick={() => setCurrentIndex(index)}
                className={isActive ? 'img-active' : ''}
              />
            );
          })
        }
      </div>

    </div>
  );
}
export default ImageView;