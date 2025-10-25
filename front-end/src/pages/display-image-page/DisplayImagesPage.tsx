import { useLocation } from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';
import { FaFileCircleXmark } from "react-icons/fa6"
import './DisplayImagesPage.css';
import { useEffect, useState } from 'react';

type ImageInfo = {
  filename: string;
  url: string;
  width: number;
  height: number;
  bitDepth: string;
  format: string;
  size: number;
}

const DisplayImagesPage = () => {
  const location = useLocation();
  const [imageArray, setImageArray] = useState<ImageInfo[]>([]);

  useEffect(() => {
    const stateImageArray = location.state?.imageArray;
    const storedImageArray = localStorage.getItem("imageArray");
    if (stateImageArray) {
      setImageArray(stateImageArray);
    } else if (storedImageArray) {
      try {
        const parsedArray = JSON.parse(storedImageArray);
          setImageArray(parsedArray);
      } catch (error) {
        console.error("Error parsing stored image array:", error);
      }
    }
  }, [location.state]);
  

  if (!imageArray || imageArray.length === 0) {
    return (
      <>
        <NavBar />
        <ToolBar />
        <div id="no-image">
          <h2 id="no-image-mess">No image uploaded</h2>
          <FaFileCircleXmark id='no-image-icon' />          
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar></NavBar>
      <ToolBar></ToolBar>
      <ImageView imageArray={imageArray}></ImageView>
    </>
  );
};

export default DisplayImagesPage;
