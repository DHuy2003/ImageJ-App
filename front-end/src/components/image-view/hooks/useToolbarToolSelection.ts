import { useEffect } from 'react';
import type { ToolbarAction } from '../../../types/toolbar';
import type { RoiTool } from '../../../types/roi';
import { TOOLBAR_EVENT_NAME } from '../../../utils/tool-bar/toolBarUtils';

/**
 * Lắng nghe các action từ ToolBar (SET_TOOL) và
 * cập nhật activeTool trong ImageView.
 */
export const useToolbarToolSelection = (
  setActiveTool: (tool: RoiTool) => void,
) => {
  useEffect(() => {
    const listener = (e: Event) => {
      const action = (e as CustomEvent<ToolbarAction>).detail;

      if (action.type === 'SET_TOOL') {
        setActiveTool(action.tool as RoiTool);
      }
    };

    window.addEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);

    return () => {
      window.removeEventListener(TOOLBAR_EVENT_NAME, listener as EventListener);
    };
  }, [setActiveTool]);
};
