
import '../styles/HomePage.css';
import Logo from '../assets/logo.png';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      // In a real application, you would process these files, e.g., upload them to a server
      // For now, we'll just navigate to a new page and pass the file URLs/data if needed.
      const imageUrls = fileArray.map(file => URL.createObjectURL(file));
      navigate('/display-images', { state: { imageUrls } });
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
              <input type="file" id="file-input" accept="image/*" onChange={handleFileChange} multiple/>
          </div>
      </div>

    </div>
  )
};

export default HomePage;

