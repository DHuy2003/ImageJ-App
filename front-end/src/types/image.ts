export type ImageInfo = {
    id: number;
    filename: string;
    url?: string;
    width: number;
    height: number;
    bitDepth: number;
    size: number;
    uploaded_on: string;
    mask_filename: string | null;
    mask_filepath: string | null;
    mask_url?: string | null;
    status: string;
    last_edited_on?: string | null;
    cropped_url?: string | null;
};

export type ImageViewProps = {
    imageArray: ImageInfo[];
};

// --- CÁC TYPE MỚI ĐƯỢC THÊM ---
export type ImageActionType = 'ZOOM_IN' | 'ZOOM_OUT' | 'SCALE_TO_FIT' | 'ZOOM_TO_SELECTION';

export type ImageEventPayload = {
    type: ImageActionType;
};

export type Translation = {
    x: number;
    y: number;
};

// --- KẾT THÚC PHẦN THÊM MỚI ---