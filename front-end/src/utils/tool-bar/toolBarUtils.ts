export const TOOLBAR_EVENT_NAME = 'toolbar-action';
export type ToolbarTool = 'pointer' | 'rect' | 'circle' | 'brush';

export type ToolbarAction =
  | { type: 'SET_TOOL'; tool: ToolbarTool }
  | { type: 'PAN_MODE'; enabled: boolean };

let currentTool: ToolbarTool = 'pointer';
export const getCurrentToolbarTool = () => currentTool;

export const emitToolbarAction = (action: ToolbarAction) => {
    if (action.type === 'SET_TOOL') {
      currentTool = action.tool;
    }
  
    window.dispatchEvent(
      new CustomEvent<ToolbarAction>(TOOLBAR_EVENT_NAME, {
        detail: action,
      }),
    );
};

export const handleMousePointerClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'pointer' });
    const clearSelectionEvent = new CustomEvent('editSelectNone');
    window.dispatchEvent(clearSelectionEvent);
};
  
export const handleSquareClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'rect' });
};
  
export const handleCircleClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'circle' });
};  

let isPanMode = false;
export const handleHandClick = () => {
    isPanMode = !isPanMode;
    emitToolbarAction({ type: 'PAN_MODE', enabled: isPanMode });
};

export const handleBrushClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'brush' });
};
