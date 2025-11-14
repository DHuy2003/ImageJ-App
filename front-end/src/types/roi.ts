export type RoiTool = 'pointer' | 'rect' | 'circle';

export type RoiShape = {
  id: number;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RoiOverlayProps = {
  tool: RoiTool;
  disabled?: boolean;
}