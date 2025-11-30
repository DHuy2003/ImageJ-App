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

export const handleOpenBrightnessContrast = (): void => {
    window.dispatchEvent(new CustomEvent('openBrightnessContrast'));
};


export const processBrightnessContrast = (
    imageData: ImageData,
    min: number,
    max: number
): ImageData => {
    const data = imageData.data;
    const range = max - min;
    // Hệ số nhân để kéo giãn histogram
    const factor = 255 / (range === 0 ? 1 : range);

    for (let i = 0; i < data.length; i += 4) {
        let r = (data[i] - min) * factor;
        data[i] = r < 0 ? 0 : r > 255 ? 255 : r;

        let g = (data[i + 1] - min) * factor;
        data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;

        let b = (data[i + 2] - min) * factor;
        data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    return imageData;
};

export const analyzeImageHistogram = (imageData: ImageData) => {
    const data = imageData.data;
    const bins = new Array(256).fill(0);
    let min = 255;
    let max = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const val = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        if (bins[val] !== undefined) {
            bins[val]++;
        }
        if (val < min) min = val;
        if (val > max) max = val;
    }
    return { bins, min, max };
};