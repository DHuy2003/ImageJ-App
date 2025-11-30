import React, { useEffect, useState } from 'react';
import './ImageSizeDialog.css';

interface ImageSizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (width: number, height: number, depth: number, interpolation: string) => void;
  currentWidth: number;
  currentHeight: number;
}

const ImageSizeDialog: React.FC<ImageSizeDialogProps> = ({
  isOpen,
  onClose,
  onApply,
  currentWidth,
  currentHeight,
}) => {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [depth, setDepth] = useState(1);
  const [constrain, setConstrain] = useState(true);
  const [average, setAverage] = useState(true);
  const [interpolation, setInterpolation] = useState('Bilinear');
  const [aspectRatio, setAspectRatio] = useState(1);

  // Reset state khi mở dialog hoặc ảnh thay đổi
  useEffect(() => {
    if (isOpen) {
      setWidth(currentWidth);
      setHeight(currentHeight);
      setAspectRatio(currentWidth / currentHeight);
    }
  }, [isOpen, currentWidth, currentHeight]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newW = parseInt(e.target.value) || 0;
    setWidth(newW);
    if (constrain) {
      setHeight(Math.round(newW / aspectRatio));
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newH = parseInt(e.target.value) || 0;
    setHeight(newH);
    if (constrain) {
      setWidth(Math.round(newH * aspectRatio));
    }
  };

  const handleApply = () => {
    onApply(width, height, depth, interpolation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-box size-dialog">
        <h3 className="dialog-title">Resize Image</h3>
        
        <div className="dialog-content">
          {/* Inputs Section */}
          <div className="input-group">
            <label>Width (pixels):</label>
            <input 
              type="number" 
              value={width} 
              onChange={handleWidthChange} 
            />
          </div>
          
          <div className="input-group">
            <label>Height (pixels):</label>
            <input 
              type="number" 
              value={height} 
              onChange={handleHeightChange} 
            />
          </div>

          <div className="input-group">
            <label>Depth (images):</label>
            <input 
              type="number" 
              value={depth} 
              onChange={(e) => setDepth(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Checkboxes */}
          <div className="checkbox-group">
            <label>
              <input 
                type="checkbox" 
                checked={constrain} 
                onChange={(e) => setConstrain(e.target.checked)} 
              />
              Constrain aspect ratio
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input 
                type="checkbox" 
                checked={average} 
                onChange={(e) => setAverage(e.target.checked)} 
              />
              Average when downsizing
            </label>
          </div>

          {/* Dropdown */}
          <div className="input-group dropdown-group">
            <label>Interpolation:</label>
            <select 
              value={interpolation} 
              onChange={(e) => setInterpolation(e.target.value)}
            >
              <option value="Nearest Neighbor">Nearest Neighbor</option>
              <option value="Bilinear">Bilinear</option>
              <option value="Bicubic">Bicubic</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="dialog-buttons">
          <button onClick={handleApply} className="btn-ok">OK</button>
          <button onClick={onClose} className="btn-cancel">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ImageSizeDialog;