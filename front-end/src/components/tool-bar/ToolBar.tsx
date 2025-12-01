import { useEffect, useState } from 'react';
import { MousePointer, Hand, Circle, Square, Brush } from 'lucide-react';
import './ToolBar.css';
import {
  handleCircleClick,
  handleHandClick,
  handleMousePointerClick,
  handleSquareClick,
  handleBrushClick,
  TOOLBAR_EVENT_NAME,
  getCurrentToolbarTool,
  type ToolbarAction,
  type ToolbarTool,
} from '../../utils/tool-bar/toolBarUtils';

const ToolBar = () => {
  const [activeTool, setActiveTool] = useState<ToolbarTool>(() => getCurrentToolbarTool());
  const [isPanMode, setIsPanMode] = useState(false);

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

  const isToolActive = (tool: ToolbarTool) => !isPanMode && activeTool === tool;

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

        <button
          className={`selection-btn ${isToolActive('brush') ? 'selection-btn-active' : ''}`}
          onClick={handleBrushClick}
        >
          <Brush className="selection-item" />
        </button>
      </ul>
    </div>
  );
};

export default ToolBar;
