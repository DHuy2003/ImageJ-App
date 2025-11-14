export type DrawingTool = 'pointer' | 'rect' | 'circle';

export type ToolbarAction =
  | { type: 'SET_TOOL'; tool: DrawingTool }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'PAN_MODE'; enabled: boolean };