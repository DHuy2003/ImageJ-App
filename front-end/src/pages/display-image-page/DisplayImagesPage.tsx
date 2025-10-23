import { useLocation } from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';

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
  const { imageArray } = location.state as { imageArray: ImageInfo[] };

  return (
    <>
      <NavBar></NavBar>
      <ToolBar></ToolBar>
      <ImageView imageArray={imageArray}></ImageView>
    </>
  );
};

export default DisplayImagesPage;
