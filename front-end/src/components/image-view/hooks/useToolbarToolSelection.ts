import { useEffect } from 'react';
import type { ToolbarAction } from '../../../utils/tool-bar/toolBarUtils';
import type { RoiTool } from '../../../types/roi';
import { TOOLBAR_EVENT_NAME } from '../../../utils/tool-bar/toolBarUtils';

const useToolbarToolSelection = (
  setActiveTool: (tool: RoiTool) => void,
  setPanMode?: (enabled: boolean) => void,  
) => {
  useEffect(() => {
    const listener = (e: Event) => {
      const action = (e as CustomEvent<ToolbarAction>).detail;

      if (action.type === 'SET_TOOL') {
        setActiveTool(action.tool as RoiTool);
      }

      if (action.type === 'PAN_MODE' && setPanMode) {
        setPanMode(action.enabled);
      }
    };

    window.addEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);

    return () => {
      window.removeEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
    };
  }, [setActiveTool, setPanMode]);
};

export default useToolbarToolSelection;
