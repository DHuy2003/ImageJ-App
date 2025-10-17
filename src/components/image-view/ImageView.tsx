import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft} from 'lucide-react';
import './ImageView.css';
import formatFileSize from '../../utils/image-view/formatFileSize';
import getImageInfo from '../../utils/image-view/getImageInfo';

type ImageViewProps = {
  fileArray: File[];
}

type ImageInfo = {
  width?: number;
  height?: number;
  bitDepth?: number | string;
  dateTaken?: string | null;
};

const ImageView = ({fileArray} : ImageViewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageURL, setCurrentImageURL] = useState<string>("");
  const currentFile = fileArray[currentIndex];
  const [currentImageInfo, setCurrentImageInfo] = useState<ImageInfo>();
  
  useEffect(() => {
    if (fileArray && fileArray.length > 0) {
      const url = URL.createObjectURL(fileArray[currentIndex]);
      setCurrentImageURL(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [currentIndex, fileArray]);

  useEffect(() => {
    if (currentFile) {
      const fetchData = async () =>{
        const data = await getImageInfo(currentFile) as ImageInfo;
        setCurrentImageInfo(data);
      }    
      fetchData(); 
    } 
  }, [currentFile]);

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < fileArray.length - 1 ? prevIndex + 1 : prevIndex));
  };

  return (
    <div id="image-view">
      { 
        currentFile && <div id="image-properties">
          <h2>Properties</h2>
          <p>Name: {currentFile.name}</p>
          <p>Format: {currentFile.name.split('.').pop()?.toUpperCase()}</p>
          <p>Size: {formatFileSize(currentFile.size)}</p>
          <p>Type: {currentImageInfo?.bitDepth} bit</p>
          <p>Last Modified: {new Date(currentFile.lastModified).toLocaleString()}</p>
        </div>
      }
      
      <div id="image-container">
        <div id="image-controls">
          <button className="image-controls-btn" onClick={handlePrev} disabled={currentIndex === 0 || fileArray.length <= 1}>
            <ChevronLeft className="image-controls-icon" />
            Previous Frame</button>
          <button className="image-controls-btn" onClick={handleNext} disabled={currentIndex === fileArray.length - 1}>
            Next Frame
            <ChevronRight className="image-controls-icon"/>
            </button>
        </div>

        <div id='image-display'>
          {currentImageURL && <img src={currentImageURL} alt={currentFile?.name} />}  
        </div>
        
        <p>Frame {currentIndex + 1} of {fileArray.length} </p>
      </div>

      <div id="image-gallery">
        <h2>Gallery</h2>
        {
          fileArray.map((file, index) => {
            const isActive = index === currentIndex;
            return (
              <img
                key={index}
                src={URL.createObjectURL(file)}
                alt={file.name}
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