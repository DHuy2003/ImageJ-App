import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ThresholdDialog.css';

// Threshold modes matching ImageJ
const MODE_RED = 0;
const MODE_BLACK_AND_WHITE = 1;
const MODE_OVER_UNDER = 2;

const MODES = ['Red', 'B&W', 'Over/Under'];

// Auto-thresholding method names
const METHOD_NAMES = [
  'Default',
  'Huang',
  'IJ_IsoData',
  'Intermodes',
  'IsoData',
  'Li',
  'MaxEntropy',
  'Mean',
  'MinError',
  'Minimum',
  'Moments',
  'Otsu',
  'Percentile',
  'RenyiEntropy',
  'Shanbhag',
  'Triangle',
  'Yen'
];

interface ThresholdDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onChange: (min: number, max: number) => void;
  onReset: () => void;
  onAuto: (method: string, darkBackground: boolean) => void;
  currentMin: number;
  currentMax: number;
  histogram: number[];
  bitDepth: 8 | 16 | 32;
  dataRangeMin: number;
  dataRangeMax: number;
}

interface ThresholdPlotProps {
  histogram: number[];
  lowerThreshold: number;
  upperThreshold: number;
  mode: number;
  hColors?: string[];
}

// Threshold Plot Component (equivalent to ThresholdPlot class in Java)
const ThresholdPlot = ({ histogram, lowerThreshold, upperThreshold, mode, hColors }: ThresholdPlotProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 256;
  const height = 48;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !histogram || histogram.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Find max for scaling (with mode adjustment like Java code)
    let hmax = Math.max(...histogram);
    const modeIndex = histogram.indexOf(hmax);
    let maxCount2 = 0;
    for (let i = 0; i < histogram.length; i++) {
      if (i !== modeIndex && histogram[i] > maxCount2) {
        maxCount2 = histogram[i];
      }
    }
    if (hmax > maxCount2 * 1.5 && maxCount2 !== 0) {
      hmax = Math.round(maxCount2 * 1.2);
    }

    if (hmax === 0) hmax = 1;

    // Draw histogram bars
    const barWidth = width / 256;
    for (let i = 0; i < 256; i++) {
      const barHeight = Math.round((height * histogram[i]) / hmax);
      const x = i * barWidth;

      if (hColors && hColors[i]) {
        ctx.fillStyle = hColors[i];
      } else {
        ctx.fillStyle = '#808080';
      }
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    }

    // Draw threshold overlay based on mode
    if (lowerThreshold >= 0) {
      if (mode === MODE_OVER_UNDER) {
        // Blue for below threshold
        ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
        ctx.fillRect(0, 0, lowerThreshold * barWidth, height);

        // Green for above threshold
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect((upperThreshold + 1) * barWidth, 0, width - (upperThreshold + 1) * barWidth, height);
      } else {
        // Red or B&W overlay for threshold range
        ctx.fillStyle = mode === MODE_RED ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(lowerThreshold * barWidth, 0, (upperThreshold - lowerThreshold + 1) * barWidth, height);
      }

      // Draw threshold lines
      ctx.strokeStyle = mode === MODE_RED ? '#ff0000' : (mode === MODE_BLACK_AND_WHITE ? '#000000' : '#0000ff');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lowerThreshold * barWidth, 0);
      ctx.lineTo(lowerThreshold * barWidth, height);
      ctx.stroke();

      ctx.strokeStyle = mode === MODE_OVER_UNDER ? '#00ff00' : (mode === MODE_RED ? '#ff0000' : '#000000');
      ctx.beginPath();
      ctx.moveTo((upperThreshold + 1) * barWidth, 0);
      ctx.lineTo((upperThreshold + 1) * barWidth, height);
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(0, 0, width, height);
  }, [histogram, lowerThreshold, upperThreshold, mode, hColors]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="threshold-plot-canvas"
    />
  );
};

const ThresholdDialog = ({
  isOpen,
  onClose,
  onApply,
  onChange,
  onReset,
  onAuto,
  currentMin,
  currentMax,
  histogram,
  bitDepth,
  dataRangeMin,
  dataRangeMax
}: ThresholdDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: -1, y: -1 });

  // Threshold state
  const [minThreshold, setMinThreshold] = useState(currentMin);
  const [maxThreshold, setMaxThreshold] = useState(currentMax);
  const [method, setMethod] = useState('Default');
  const [mode, setMode] = useState(MODE_RED);
  const [darkBackground, setDarkBackground] = useState(false);
  const [stackHistogram, setStackHistogram] = useState(false);
  const [rawValues, setRawValues] = useState(false);
  const [noReset, setNoReset] = useState(true);

  // Slider range based on bit depth
  const sliderRange = 256;

  // Convert actual value to slider value (0-255)
  const toSliderValue = useCallback((value: number) => {
    if (bitDepth === 8) return Math.round(value);
    return Math.round(((value - dataRangeMin) / (dataRangeMax - dataRangeMin)) * 255);
  }, [bitDepth, dataRangeMin, dataRangeMax]);

  // Convert slider value to actual value
  const toActualValue = useCallback((sliderValue: number) => {
    if (bitDepth === 8) return sliderValue;
    return dataRangeMin + (sliderValue / 255) * (dataRangeMax - dataRangeMin);
  }, [bitDepth, dataRangeMin, dataRangeMax]);

  // Update local state when props change
  useEffect(() => {
    setMinThreshold(currentMin);
    setMaxThreshold(currentMax);
  }, [currentMin, currentMax]);

  // Center dialog on open
  useEffect(() => {
    if (isOpen && position.x === -1) {
      const centerX = (window.innerWidth - 320) / 2;
      const centerY = (window.innerHeight - 400) / 2;
      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, position.x]);

  // Calculate percentiles
  const percentiles = useMemo(() => {
    if (!histogram || histogram.length === 0) return { below: 0, inside: 0, above: 0 };

    const minSlider = toSliderValue(minThreshold);
    const maxSlider = toSliderValue(maxThreshold);

    let below = 0, inside = 0, above = 0;

    for (let i = 0; i < 256; i++) {
      if (i < minSlider) {
        below += histogram[i] || 0;
      } else if (i <= maxSlider) {
        inside += histogram[i] || 0;
      } else {
        above += histogram[i] || 0;
      }
    }

    const total = below + inside + above;
    if (total === 0) return { below: 0, inside: 0, above: 0 };

    return {
      below: (100 * below / total).toFixed(2),
      inside: (100 * inside / total).toFixed(2),
      above: (100 * above / total).toFixed(2)
    };
  }, [histogram, minThreshold, maxThreshold, toSliderValue]);

  // Handle min slider change
  const handleMinSliderChange = (value: number) => {
    const actualValue = toActualValue(value);
    let newMax = maxThreshold;

    if (actualValue > maxThreshold) {
      newMax = actualValue;
      setMaxThreshold(newMax);
    }

    setMinThreshold(actualValue);
    onChange(actualValue, newMax);
  };

  // Handle max slider change
  const handleMaxSliderChange = (value: number) => {
    const actualValue = toActualValue(value);
    let newMin = minThreshold;

    if (actualValue < minThreshold) {
      newMin = actualValue;
      setMinThreshold(newMin);
    }

    setMaxThreshold(actualValue);
    onChange(newMin, actualValue);
  };

  // Handle input field changes
  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      const clampedValue = Math.max(dataRangeMin, Math.min(dataRangeMax, value));
      setMinThreshold(clampedValue);
      if (clampedValue > maxThreshold) {
        setMaxThreshold(clampedValue);
        onChange(clampedValue, clampedValue);
      } else {
        onChange(clampedValue, maxThreshold);
      }
    }
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      const clampedValue = Math.max(dataRangeMin, Math.min(dataRangeMax, value));
      setMaxThreshold(clampedValue);
      if (clampedValue < minThreshold) {
        setMinThreshold(clampedValue);
        onChange(clampedValue, clampedValue);
      } else {
        onChange(minThreshold, clampedValue);
      }
    }
  };

  // Handle Auto button
  const handleAuto = () => {
    onAuto(method, darkBackground);
  };

  // Handle Reset button
  const handleReset = () => {
    setMinThreshold(dataRangeMin);
    setMaxThreshold(dataRangeMax);
    onReset();
  };

  // Handle Apply button
  const handleApply = () => {
    onApply();
  };

  // Handle Set button (opens dialog in ImageJ, here we just apply current values)
  const handleSet = () => {
    onChange(minThreshold, maxThreshold);
  };

  // Handle method change
  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMethod = e.target.value;
    setMethod(newMethod);
    onAuto(newMethod, darkBackground);
  };

  // Handle mode change
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(parseInt(e.target.value));
  };

  // Handle dark background change
  const handleDarkBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDarkBackground = e.target.checked;
    setDarkBackground(newDarkBackground);
    // Re-run auto threshold with new setting
    onAuto(method, newDarkBackground);
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.threshold-dialog-header')) {
      setIsDragging(true);
      const rect = dialogRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Format display value
  const formatValue = (value: number) => {
    if (bitDepth === 8) {
      return Math.round(value).toString();
    } else if (bitDepth === 16) {
      return Math.round(value).toString();
    } else {
      return value.toFixed(4);
    }
  };

  if (!isOpen) return null;

  const minSliderValue = toSliderValue(minThreshold);
  const maxSliderValue = toSliderValue(maxThreshold);

  return (
    <div className="threshold-dialog-overlay">
      <div
        ref={dialogRef}
        className="threshold-dialog"
        style={{
          left: position.x >= 0 ? position.x : undefined,
          top: position.y >= 0 ? position.y : undefined
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="threshold-dialog-header">
          <span className="threshold-dialog-title">Threshold</span>
          <button className="threshold-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="threshold-dialog-content">
          {/* Histogram Plot */}
          <div className="threshold-plot-container">
            <ThresholdPlot
              histogram={histogram}
              lowerThreshold={minSliderValue}
              upperThreshold={maxSliderValue}
              mode={mode}
            />
          </div>

          {/* Percentiles */}
          <div className="threshold-percentiles">
            {mode === MODE_OVER_UNDER ? (
              <span>below: {percentiles.below}%, above: {percentiles.above}%</span>
            ) : (
              <span>{percentiles.inside}%</span>
            )}
          </div>

          {/* Min Slider */}
          <div className="threshold-slider-row">
            <input
              type="range"
              min={0}
              max={sliderRange - 1}
              value={minSliderValue}
              onChange={(e) => handleMinSliderChange(parseInt(e.target.value))}
              className="threshold-slider"
            />
            <input
              type="text"
              value={formatValue(minThreshold)}
              onChange={handleMinInputChange}
              className="threshold-input"
            />
          </div>

          {/* Max Slider */}
          <div className="threshold-slider-row">
            <input
              type="range"
              min={0}
              max={sliderRange - 1}
              value={maxSliderValue}
              onChange={(e) => handleMaxSliderChange(parseInt(e.target.value))}
              className="threshold-slider"
            />
            <input
              type="text"
              value={formatValue(maxThreshold)}
              onChange={handleMaxInputChange}
              className="threshold-input"
            />
          </div>

          {/* Method and Mode Choices */}
          <div className="threshold-choices">
            <select
              value={method}
              onChange={handleMethodChange}
              className="threshold-select"
            >
              {METHOD_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={mode}
              onChange={handleModeChange}
              className="threshold-select"
            >
              {MODES.map((name, index) => (
                <option key={name} value={index}>{name}</option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="threshold-checkboxes">
            <label className="threshold-checkbox-label">
              <input
                type="checkbox"
                checked={darkBackground}
                onChange={handleDarkBackgroundChange}
              />
              Dark background
            </label>
            <label className="threshold-checkbox-label">
              <input
                type="checkbox"
                checked={stackHistogram}
                onChange={(e) => setStackHistogram(e.target.checked)}
              />
              Stack histogram
            </label>
            <label className="threshold-checkbox-label">
              <input
                type="checkbox"
                checked={noReset}
                onChange={(e) => setNoReset(e.target.checked)}
              />
              Don't reset range
            </label>
            <label className="threshold-checkbox-label">
              <input
                type="checkbox"
                checked={rawValues}
                onChange={(e) => setRawValues(e.target.checked)}
              />
              Raw values
            </label>
          </div>

          {/* Buttons */}
          <div className="threshold-buttons">
            <button className="threshold-btn" onClick={handleAuto}>Auto</button>
            <button className="threshold-btn" onClick={handleApply}>Apply</button>
            <button className="threshold-btn" onClick={handleReset}>Reset</button>
            <button className="threshold-btn" onClick={handleSet}>Set</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThresholdDialog;

// Export auto-thresholding methods for use in other components
export { METHOD_NAMES, MODES, MODE_RED, MODE_BLACK_AND_WHITE, MODE_OVER_UNDER };

