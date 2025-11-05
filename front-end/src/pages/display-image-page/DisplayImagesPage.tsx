import { useLocation} from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';
import { FaFileCircleXmark } from "react-icons/fa6"
import './DisplayImagesPage.css';
import { useEffect, useState } from 'react';
import type { ImageInfo } from '../../types/image';

const DisplayImagesPage = () => {
  const location = useLocation();
  const [imageArray, setImageArray] = useState<ImageInfo[]>([]);
  const isNewWindow = location.state?.isNewWindow === true;
 
  useEffect(() => {
    const stateImageArray = location.state?.imageArray;
    const storedImageArray = sessionStorage.getItem("imageArray");
    
    if (stateImageArray) {
      setImageArray(stateImageArray);
      sessionStorage.setItem("imageArray", JSON.stringify(stateImageArray));
      return;
    }

    if (isNewWindow) {
      setImageArray([]);
      sessionStorage.removeItem("imageArray");
      return;
    }

    if (storedImageArray) {
      const parsedArray = JSON.parse(storedImageArray);
      setImageArray(parsedArray);
      return;
    } else setImageArray([]);

  }, [location.state, isNewWindow]);
  
  useEffect(() => {
    if (!isNewWindow && imageArray.length > 0) {
      sessionStorage.setItem("imageArray", JSON.stringify(imageArray));
    }
  }, [imageArray, isNewWindow]);


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
