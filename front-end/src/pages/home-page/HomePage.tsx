
import './HomePage.css';
import Logo from '../../assets/images/logo.png';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { uploadCellImages } from '../../utils/common/uploadImages';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

const HomePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewWindow = searchParams.get("newWindow") === "true";

  useEffect(() => {
    if (isNewWindow) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('newWindow');
      window.history.replaceState({}, '', newUrl);
    }
  }, [isNewWindow]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return; 
    try {
      await axios.post(`${API_BASE_URL}/reset`);
  
      await uploadCellImages(files, navigate, true);
    } catch (error) {
      console.error("Error resetting + uploading dataset", error);
    }
  };

  const handleUploadClick = () => {
    document.getElementById('file-input')?.click();
  };

  return (
    <div id="main">

      <div id="content">
          <div id="logo">
              <img src={Logo} alt="ImageJ Logo"/>
          </div>

          <div id="title">
              <h1>Welcome to CellTracker Pro</h1>
              <h2>Advanced cell analysis and tracking platform for biological research</h2>
          </div>

          <div id="getting-started">
              <p>Getting Started:</p>
              <ul>
                  <li>Upload multiple cell microscopy images</li>
                  <li>Navigate through frames using the thumbnail panel</li>
                  <li>Run analysis to track cell behavior over time</li>
                  <li>Search relevant research articles</li>
              </ul>
          </div>

          <div id="upload">
              <button id="upload-btn" onClick={handleUploadClick}>Upload Your First Dataset</button>
              <input type="file" id="file-input" accept = "image/*" onChange={handleFileChange} multiple/>
          </div>
      </div>

    </div>
  )
};

export default HomePage;

