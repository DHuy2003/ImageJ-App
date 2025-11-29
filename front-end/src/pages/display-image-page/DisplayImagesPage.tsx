import { useLocation } from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';
import { FaFileCircleXmark } from "react-icons/fa6"
import './DisplayImagesPage.css';
import { useEffect, useState } from 'react';
import type { ImageInfo } from '../../types/image';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

const DisplayImagesPage = () => {
  const [imageArray, setImageArray] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axios.get(`${API_BASE_URL}/`);
        const images: ImageInfo[] = res.data.images ?? [];
        setImageArray(images);
      } catch (err: any) {
        setError("Failed to load images. Please try reloading or re-uploading the dataset.");
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [location.key]);

  useEffect(() => {
    const onDatasetCleared = () => {
      setImageArray([]);
    };

    window.addEventListener('datasetCleared', onDatasetCleared);
    return () => {
      window.removeEventListener('datasetCleared', onDatasetCleared);
    };
  }, []);

  if (loading) {
    return (
      <div className="display-images-page">
        <NavBar />
        <ToolBar />
        <div id="no-image">
          <h2 id="no-image-mess">Loading images...</h2>
        </div>
      </div>
    );
  }
  
  if (error || !imageArray || imageArray.length === 0) {
    return (
      <div className="display-images-page">
        <NavBar />
        <ToolBar />
        <div id="no-image">
          <h2 id="no-image-mess">
            {error || "No image uploaded"}
          </h2>
          <FaFileCircleXmark id='no-image-icon' />          
        </div>
      </div>
    );
  }
  
  return (
    <div className="display-images-page">
      <NavBar />
      <ToolBar />
      <ImageView imageArray={imageArray} />
    </div>
  );
};

export default DisplayImagesPage;
