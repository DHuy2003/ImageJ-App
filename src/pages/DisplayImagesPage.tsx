import React from 'react';
import { useLocation } from 'react-router-dom';

const DisplayImagesPage: React.FC = () => {
  const location = useLocation();
  const { imageUrls } = location.state as { imageUrls: string[] };

  if (!imageUrls || imageUrls.length === 0) {
    return <p>No images uploaded.</p>;
  }

  return (
    <div className="display-images-container">
      <h1>Uploaded Images</h1>
      <div className="image-grid">
        {imageUrls.map((url, index) => (
          <img key={index} src={url} alt={`Uploaded ${index}`} className="uploaded-image" />
        ))}
      </div>
    </div>
  );
};

export default DisplayImagesPage;
