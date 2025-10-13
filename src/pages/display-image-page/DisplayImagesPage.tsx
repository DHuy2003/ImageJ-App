import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const DisplayImagesPage: React.FC = () => {
  const location = useLocation();
  const { fileArray } = location.state as { fileArray: File[] };
  const [imagePreviews, setImagePreviews] = useState<{file: File, url: string}[]>([]);

  useEffect(() => {
    if (fileArray && fileArray.length > 0) {
      const previews = fileArray.map(file => ({ file, url: URL.createObjectURL(file) }));
      setImagePreviews(previews);
    }
  }, [fileArray]);

  if (!fileArray || fileArray.length === 0) {
    return <p>No images uploaded.</p>;
  }

  return (
    <div className="display-images-container">
      <h1>Uploaded Images</h1>
      <div className="image-grid">
        {imagePreviews.map((image, index) => (
          <img key={index} src={image.url} alt={`Uploaded ${index}`} className="uploaded-image" />
        ))}
      </div>
    </div>
  );
};

export default DisplayImagesPage;
