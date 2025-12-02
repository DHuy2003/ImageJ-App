import { useEffect, useState } from 'react';
import { MousePointer, Hand, Circle, Square, Brush, Eraser, X } from 'lucide-react';
import './ToolBar.css';
import {
  handleCircleClick,
  handleHandClick,
  handleMousePointerClick,
  handleSquareClick,
  handleBrushClick,
  TOOLBAR_EVENT_NAME,
  getCurrentToolbarTool,
  emitToolbarAction,          
  type ToolbarAction,
  type ToolbarTool,
  handleEraserClick,
} from '../../utils/tool-bar/toolBarUtils';
import type { BrushSettings } from '../../types/brush';

const TOOL_COLORS = [
  '#000000', '#595959', '#808080', '#bfbfbf', '#ffffff',
  '#e60000', '#ff8a00', '#ffd500', '#ffee00', '#ffeb00',
  '#ff00ff', '#ff0000', '#ff6600', '#ffaa00', '#ffdd55',
  '#008000', '#00b050', '#00b0f0', '#0078d4', '#0050ef',
  '#7030a0', '#a64dff', '#c27ba0', '#8b4513', '#5b3a29',
  '#ff99cc', '#ffcc99', '#ffff99', '#99ffcc', '#99ccff',
];
const MAX_BRUSH_SIZE = 15;

const ToolBar = () => {
  const [activeTool, setActiveTool] = useState<ToolbarTool>(() => getCurrentToolbarTool());
  const [isPanMode, setIsPanMode] = useState(false);
  const [showBrushSettings, setShowBrushSettings] = useState(false);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 8,
    color: '#0078d4',
  });
  const previewWidth = 220;
  const previewHeight = Math.max(brushSettings.size + 20, 40);
  const centerY = previewHeight / 2;
  const isWhite = brushSettings.color.toLowerCase() === '#ffffff';

  useEffect(() => {
    const listener = (e: Event) => {
      const action = (e as CustomEvent<ToolbarAction>).detail;

      if (action.type === 'SET_TOOL') {
        setActiveTool(action.tool);
      }

      if (action.type === 'PAN_MODE') {
        setIsPanMode(action.enabled);
      }
    };

    window.addEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
    return () => window.removeEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
  }, []);

  useEffect(() => {
    if (activeTool !== 'brush') {
      setShowBrushSettings(false);
    }
  }, [activeTool]);

  const isToolActive = (tool: ToolbarTool) => !isPanMode && activeTool === tool;

  const applyBrushSettings = (next: BrushSettings) => {
    setBrushSettings(next);
    emitToolbarAction({ type: 'BRUSH_SETTINGS', settings: next });
  };

  const handleBrushButtonClick = () => {
    handleBrushClick();
    setShowBrushSettings(prev => !prev);
    emitToolbarAction({ type: 'BRUSH_SETTINGS', settings: brushSettings });
  };



  return (
    <div id="toolbar">
      <ul id="selection">
        <button
          className={`selection-btn ${isToolActive('pointer') ? 'selection-btn-active' : ''}`}
          onClick={handleMousePointerClick}
        >
          <MousePointer className="selection-item" />
        </button>

        <button
          className={`selection-btn ${isToolActive('rect') ? 'selection-btn-active' : ''}`}
          onClick={handleSquareClick}
        >
          <Square className="selection-item" />
        </button>

        <button
          className={`selection-btn ${isToolActive('circle') ? 'selection-btn-active' : ''}`}
          onClick={handleCircleClick}
        >
          <Circle className="selection-item" />
        </button>

        <button
          className={`selection-btn ${isPanMode ? 'selection-btn-active' : ''}`}
          onClick={handleHandClick}
        >
          <Hand className="selection-item" />
        </button>

        <div className="brush-wrapper">
          <button
            className={`selection-btn ${isToolActive('brush') ? 'selection-btn-active' : ''}`}
            onClick={handleBrushButtonClick}
          >
            <Brush className="selection-item" />
          </button>

          {showBrushSettings && (
            <div className="brush-popup">
              <div className="brush-popup-header">
                <div className="brush-popup-title">Colors</div>
                <button
                  className="brush-popup-close"
                  onClick={() => setShowBrushSettings(false)}
                  aria-label="Close brush settings"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="brush-popup-section">
                <div className="brush-color-grid">
                  {TOOL_COLORS.map(color => (
                    <button
                      key={color}
                      className={`brush-color-swatch ${
                        brushSettings.color === color ? 'brush-color-active' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => applyBrushSettings({ ...brushSettings, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="brush-popup-section">
                <div className="brush-popup-title">Thickness</div>
                <input
                  type="range"
                  min={5}
                  max={MAX_BRUSH_SIZE}
                  value={brushSettings.size}
                  onChange={e =>
                    applyBrushSettings({
                      ...brushSettings,
                      size: Number(e.target.value),
                    })
                  }
                />
                <div className="brush-thickness-preview">
                  <svg
                    width={previewWidth}
                    height={previewHeight}
                    viewBox={`0 0 ${previewWidth} ${previewHeight}`}
                  >
                    <path
                      d={`M10 ${centerY} 
                          Q ${previewWidth * 0.35} ${centerY - 10} 
                            ${previewWidth * 0.65} ${centerY} 
                          T ${previewWidth - 10} ${centerY}`}
                      stroke={brushSettings.color}
                      strokeWidth={brushSettings.size}
                      fill="none"
                      strokeLinecap="round"
                      style={{
                        filter: isWhite ? 'drop-shadow(0 0 1px #000)' : 'none',
                      }}
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className={`selection-btn ${isToolActive('eraser') ? 'selection-btn-active' : ''}`}
          onClick={handleEraserClick}
        >
          <Eraser className="selection-item" />
        </button>
      </ul>
    </div>
  );
};

export default ToolBar;
