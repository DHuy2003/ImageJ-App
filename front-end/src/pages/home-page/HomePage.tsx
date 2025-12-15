import './HomePage.css';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  const handleStartClick = () => {
    navigate('/display-images');
  };
  return (
    <div id="main">

      <div id="content">
          <div id="logo">
              <img src={'./images/logo.png'} alt="ImageJ Logo"/>
          </div>

          <div id="title">
              <h1>Welcome to CellTracker Pro</h1>
              <h2>Advanced cell analysis and tracking platform for biological research</h2>
          </div>

          <div id="getting-started">
              <p>Getting Started:</p>
              <ul>
                  <li>Upload multiple cell microscopy images via File menu</li>
                  <li>Navigate through frames using the thumbnail panel</li>
                  <li>Run analysis to track cell behavior over time</li>
                  <li>Search relevant research articles</li>
              </ul>
          </div>

          <div id="upload">
              <button id="upload-btn" onClick={handleStartClick}>Start Using</button>
          </div>
      </div>

    </div>
  )
};

export default HomePage;

