export type ToolbarTool = 'pointer' | 'rect' | 'circle';

export type ToolbarAction =
  | { type: 'SET_TOOL'; tool: ToolbarTool }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'PAN_MODE'; enabled: boolean };