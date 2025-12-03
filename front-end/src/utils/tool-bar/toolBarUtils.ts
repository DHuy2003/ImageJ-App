import type { BrushSettings } from "../../types/brush";

export const TOOLBAR_EVENT_NAME = 'toolbar-action';
export type ToolbarTool = 'pointer' | 'rect' | 'circle' | 'hand' | 'brush' | 'eraser';

export type ToolbarAction =
  | { type: 'SET_TOOL'; tool: ToolbarTool }
  | { type: 'PAN_MODE'; enabled: boolean }
  | { type: 'BRUSH_SETTINGS'; settings: BrushSettings }
  | { type: 'ERASER_SETTINGS'; settings: { size: number } };

let currentTool: ToolbarTool = 'pointer';
let isPanMode = false;

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

const setPanModeInternal = (enabled: boolean) => {
  if (isPanMode === enabled) return;
  isPanMode = enabled;
  emitToolbarAction({ type: 'PAN_MODE', enabled });
};

export const handleMousePointerClick = () => {
  setPanModeInternal(false);
  emitToolbarAction({ type: 'SET_TOOL', tool: 'pointer' });
  const clearSelectionEvent = new CustomEvent('editSelectNone');
  window.dispatchEvent(clearSelectionEvent);
};

export const handleSquareClick = () => {
  setPanModeInternal(false);
  emitToolbarAction({ type: 'SET_TOOL', tool: 'rect' });
};

export const handleCircleClick = () => {
  setPanModeInternal(false);
  emitToolbarAction({ type: 'SET_TOOL', tool: 'circle' });
};

export const handleHandClick = () => {
  setPanModeInternal(true);
};

export const handleBrushClick = () => {
  setPanModeInternal(false);
  emitToolbarAction({ type: 'SET_TOOL', tool: 'brush' });
};

export const handleEraserClick = () => {
  setPanModeInternal(false);
  emitToolbarAction({ type: 'SET_TOOL', tool: 'eraser' });
};
