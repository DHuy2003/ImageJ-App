export const handleZoomIn = (): void => {
    const event = new CustomEvent('imageZoomIn');
    window.dispatchEvent(event);
};
export const handleZoomOut = (): void => {
    const event = new CustomEvent('imageZoomOut');
    window.dispatchEvent(event);
};
export const handleScaleToFit = (): void => {
    const event = new CustomEvent('imageScaleToFit');
    window.dispatchEvent(event);
};
