import type { ImageEventPayload } from '../../types/image';

export const IMAGE_EVENT_NAME = 'imageEvent';

/**
 * Gửi một sự kiện tùy chỉnh cho các hành động liên quan đến hình ảnh (như zoom).
 * @param detail - Tải trọng (payload) của sự kiện, xác định hành động cần thực hiện.
 */
const dispatchImageEvent = (detail: ImageEventPayload) => {
  window.dispatchEvent(new CustomEvent(IMAGE_EVENT_NAME, { detail }));
};

// Các hàm xử lý được gọi từ NavBar
export const handleZoomIn = () => {
  dispatchImageEvent({ type: 'ZOOM_IN' });
};

export const handleZoomOut = () => {
  dispatchImageEvent({ type: 'ZOOM_OUT' });
};

export const handleScaleToFit = () => {
  dispatchImageEvent({ type: 'SCALE_TO_FIT' });
};

export const handleZoomToSelection = () => {
  dispatchImageEvent({ type: 'ZOOM_TO_SELECTION' });
};