import { useLocation } from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';

const DisplayImagesPage = () => {
  const location = useLocation();
  const { fileArray } = location.state as { fileArray: File[] };

  return (
    <>
      <NavBar></NavBar>
      <ToolBar></ToolBar>
      <ImageView fileArray={fileArray}></ImageView>
    </>
  );
};

export default DisplayImagesPage;
