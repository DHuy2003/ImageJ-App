export type RoiTool = 'pointer' | 'rect' | 'circle' | 'brush' | 'eraser';

export type RoiShape = {
  id: number;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
};

export type ResizeHandle =
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw';

export type RoiOverlayProps = {
  tool: RoiTool;
  disabled?: boolean;
  imgRef?: React.RefObject<HTMLImageElement | null>;
  frameIndex: number;
}

export type SelectedRoiInfo = {
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
} | null;
