export type RoiTool = 'pointer' | 'rect' | 'circle';

export type RoiShape = {
  id: number;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
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
}

export type SelectedRoiInfo = {
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
} | null;