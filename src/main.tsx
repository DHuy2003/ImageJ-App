import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home-page/HomePage.tsx';
import DisplayImagesPage from './pages/display-image-page/DisplayImagesPage.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/display-images" element={<DisplayImagesPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
