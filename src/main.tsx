import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home-page/HomePage.tsx';
import DisplayImagesPage from './pages/display-image-page/DisplayImagesPage.tsx';
import NavBar from './components/nav-bar/NavBar.tsx';
import ToolBar from './components/tool-bar/ToolBar.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/display-images" element={<DisplayImagesPage />} />
      </Routes>
    </Router> */}
    <NavBar></NavBar>
    <ToolBar></ToolBar>
  </StrictMode>,
)
