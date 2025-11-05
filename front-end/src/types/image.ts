export interface ImageInfo {
    id: number;
    filename: string;
    url: string;
    width: number;
    height: number;
    bitDepth: number;
    size: number;
    uploaded_on: string;
    mask_filename: string | null;
    mask_filepath: string | null;
    mask_url?: string | null;
    status: string;
    last_edited_on: string | null;
}
