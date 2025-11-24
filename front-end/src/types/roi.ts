import Swal from "sweetalert2";

export type RoiTool = 'pointer' | 'rect' | 'circle' | 'brush';

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
  frameIndex: number;
}

export type SelectedRoiInfo = {
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

export const showSelectionRequired = () => {
  Swal.fire({
    text: "This command requires a selection.",
    icon: 'warning',
    confirmButtonText: 'OK',
    confirmButtonColor: '#3085d6',
  });
};