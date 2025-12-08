import React, { useEffect, useState } from 'react';
import './ImageSizeDialog.css';

interface ImageSizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    width: number,
    height: number,
    depth: number,
    interpolation: string,
    average: boolean
  ) => void;
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

  const [interpolation, setInterpolation] = useState("Bilinear");

  const [aspectRatio, setAspectRatio] = useState(1);

  // Reset state khi dialog mở
  useEffect(() => {
    if (isOpen) {
      setWidth(currentWidth);
      setHeight(currentHeight);
      setAspectRatio(currentWidth / currentHeight);
      setDepth(1);
      setConstrain(true);
      setAverage(true);
      setInterpolation("Bilinear");
    }
  }, [isOpen, currentWidth, currentHeight]);


  // =========  HANDLE CONSTRAIN CHECKBOX (GIỐNG IMAGEJ) =========
  const handleConstrainChange = (checked: boolean) => {
    setConstrain(checked);

    if (checked) {
      // Khi bật lại constrain → cập nhật tỷ lệ theo kích thước đang nhập
      if (height > 0) {
        setAspectRatio(width / height);
      }
    }
  };


  // ========= HANDLE WIDTH CHANGE =========
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newW = parseInt(e.target.value) || 0;
    if (newW <= 0) {
      setWidth(0);
      return;
    }

    setWidth(newW);

    if (constrain && aspectRatio > 0) {
      const newH = Math.max(1, Math.round(newW / aspectRatio));
      setHeight(newH);
    }
  };

  // ========= HANDLE HEIGHT CHANGE =========
  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newH = parseInt(e.target.value) || 0;
    if (newH <= 0) {
      setHeight(0);
      return;
    }

    setHeight(newH);

    if (constrain && aspectRatio > 0) {
      const newW = Math.max(1, Math.round(newH * aspectRatio));
      setWidth(newW);
    }
  };


  // ========= APPLY =========
  const handleApply = () => {
    onApply(width, height, depth, interpolation, average);
    onClose();
  };


  // ========= JSX =========
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-box size-dialog">
        <h3 className="dialog-title">Resize Image</h3>

        <div className="dialog-content">

          {/* WIDTH */}
          <div className="input-group">
            <label>Width (pixels):</label>
            <input
              type="number"
              value={width}
              onChange={handleWidthChange}
            />
          </div>

          {/* HEIGHT */}
          <div className="input-group">
            <label>Height (pixels):</label>
            <input
              type="number"
              value={height}
              onChange={handleHeightChange}
            />
          </div>

          {/* DEPTH */}
          <div className="input-group">
            <label>Depth (images):</label>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* CONSTRAIN */}
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={constrain}
                onChange={(e) => handleConstrainChange(e.target.checked)}
              />
              Constrain aspect ratio
            </label>
          </div>

          {/* AVERAGE WHEN DOWNSIZING */}
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

          {/* INTERPOLATION */}
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

        {/* BUTTONS */}
        <div className="dialog-buttons">
          <button onClick={handleApply} className="btn-ok">OK</button>
          <button onClick={onClose} className="btn-cancel">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ImageSizeDialog;
