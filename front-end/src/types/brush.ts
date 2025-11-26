import type { RoiTool } from "./roi";

export type BrushOverlayProps = {
  tool: RoiTool;
  disabled: boolean;
  imgRef: React.RefObject<HTMLImageElement | null>;
}
