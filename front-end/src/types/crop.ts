export type CropOverlayProps = {
    onCrop: (cropArea: DOMRect) => void;
    onCancel: () => void;
    imgRef: React.RefObject<HTMLImageElement | null>;
};

export type CropOverlayHandle = {
    getRect: () => DOMRect | null;
    getRelativeRect: () =>
        | { left: number; top: number; width: number; height: number }
        | null;
};