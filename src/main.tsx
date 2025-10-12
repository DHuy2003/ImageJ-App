import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.tsx';
import DisplayImagesPage from './pages/DisplayImagesPage.tsx';
import NavBar from './components/NavBar.tsx';
import ToolBar from './components/ToolBar';

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
