export type ImageInfo = {
    id: number;
    filename: string;
    url?: string;
    original_url?: string | null;
    edited_url?: string | null;
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

export type UndoEntry = {
    url: string;
    width: number;
    height: number;
    size: number;
    bitDepth: number;
};
