// Zoom utility functions
export const handleZoomIn = () => {
    const event = new CustomEvent('zoomIn');
    window.dispatchEvent(event);
};

export const handleZoomOut = () => {
    const event = new CustomEvent('zoomOut');
    window.dispatchEvent(event);
};

export const handleZoomToSelection = () => {
    const event = new CustomEvent('zoomToSelection');
    window.dispatchEvent(event);
};

export const handleScaleToFit = () => {
    const event = new CustomEvent('scaleToFit');
    window.dispatchEvent(event);
};

// Image type conversion utility functions
const convertImageType = async (type: '8-bit' | '16-bit' | '32-bit Float' | 'RGB Color') => {
    const imageArrayString = sessionStorage.getItem("imageArray");
    if (!imageArrayString) {
        alert('No image available to convert.');
        return;
    }

    const imageArray = JSON.parse(imageArrayString);
    if (imageArray.length === 0) {
        alert('No image available to convert.');
        return;
    }

    // Get current image index
    const currentIndexString = sessionStorage.getItem("currentImageIndex");
    const currentIndex = currentIndexString ? parseInt(currentIndexString, 10) : 0;
    const currentImage = imageArray[currentIndex];

    if (!currentImage || !currentImage.url) {
        alert('No image selected.');
        return;
    }

    // Load the image
    const img = new Image();
    // Only set crossOrigin if the image URL is from a different origin
    // For data URLs and same-origin images, we don't need it
    if (currentImage.url.startsWith('http://') || currentImage.url.startsWith('https://')) {
        // Check if it's from a different origin
        try {
            const urlObj = new URL(currentImage.url);
            if (urlObj.origin !== window.location.origin) {
                img.crossOrigin = 'anonymous';
            }
        } catch (e) {
            // If URL parsing fails, try without crossOrigin
        }
    }

    return new Promise<void>((resolve, reject) => {
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Draw original image to canvas
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let newImageData: ImageData;

            switch (type) {
                case '8-bit':
                    // Convert to 8-bit grayscale
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                        data[i] = gray;     // R
                        data[i + 1] = gray; // G
                        data[i + 2] = gray; // B
                        // Alpha stays the same
                    }
                    newImageData = imageData;
                    break;

                case '16-bit':
                    // Convert to 16-bit grayscale
                    // Scale 8-bit values (0-255) to 16-bit range (0-65535), then back to 8-bit for display
                    for (let i = 0; i < data.length; i += 4) {
                        const red = data[i];
                        const green = data[i + 1];
                        const blue = data[i + 2];

                        // Calculate luminance
                        const gray = 0.299 * red + 0.587 * green + 0.114 * blue;

                        // Scale 8-bit value (0-255) to 16-bit (0-65535)
                        const uint16Value = Math.round((gray / 255.0) * 65535);

                        // Convert back to 8-bit for canvas display (scale 0-65535 to 0-255)
                        const backTo8Bit = Math.round((uint16Value / 65535.0) * 255);

                        data[i] = backTo8Bit;     // R
                        data[i + 1] = backTo8Bit; // G
                        data[i + 2] = backTo8Bit; // B
                    }
                    newImageData = imageData;
                    break;

                case '32-bit Float':
                    // Convert to 32-bit float grayscale
                    // Normalize values to [0.0, 1.0] range, then convert back to 8-bit for display
                    for (let i = 0; i < data.length; i += 4) {
                        const red = data[i];
                        const green = data[i + 1];
                        const blue = data[i + 2];

                        // Calculate luminance
                        const gray = 0.299 * red + 0.587 * green + 0.114 * blue;

                        // Normalize 8-bit value (0-255) to float (0.0-1.0)
                        const floatValue = gray / 255.0;

                        // Convert back to 8-bit for canvas display (scale 0.0-1.0 to 0-255)
                        const backTo8Bit = Math.round(floatValue * 255);

                        data[i] = backTo8Bit;     // R
                        data[i + 1] = backTo8Bit; // G
                        data[i + 2] = backTo8Bit; // B
                    }
                    newImageData = imageData;
                    break;

                case 'RGB Color':
                    // Convert to RGB color - if grayscale, convert to color by preserving original RGB values
                    // Check if image is grayscale (all channels have same value)
                    let isGrayscale = true;
                    for (let i = 0; i < Math.min(data.length, 100); i += 4) {
                        if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) {
                            isGrayscale = false;
                            break;
                        }
                    }

                    if (isGrayscale) {
                        // Convert grayscale to RGB by applying a color mapping
                        // Use a simple colorization: map intensity to a color gradient
                        for (let i = 0; i < data.length; i += 4) {
                            const intensity = data[i];
                            // Create a color gradient (blue to red)
                            data[i] = Math.min(255, intensity + 50);     // R: increase red
                            data[i + 1] = intensity;                      // G: keep green
                            data[i + 2] = Math.max(0, intensity - 30);   // B: decrease blue
                        }
                    }
                    // If already RGB, keep as is
                    newImageData = imageData;
                    break;

                default:
                    reject(new Error('Unknown image type'));
                    return;
            }

            // Put the converted image data back
            ctx.putImageData(newImageData, 0, 0);

            // Convert to data URL
            const newSrc = canvas.toDataURL('image/png');

            // Update the image in the array
            const updatedArray = [...imageArray];
            const newBitDepth = type === '8-bit' ? 8 : type === '16-bit' ? 16 : type === '32-bit Float' ? 32 : 24;

            updatedArray[currentIndex] = {
                ...updatedArray[currentIndex],
                url: newSrc,
                bitDepth: newBitDepth,
            };

            // Update sessionStorage
            sessionStorage.setItem("imageArray", JSON.stringify(updatedArray));

            // Dispatch event to update the image view
            const event = new CustomEvent('imageTypeChanged', {
                detail: { imageArray: updatedArray, currentIndex }
            });
            window.dispatchEvent(event);

            resolve();
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = currentImage.url;
    });
};

export const handleConvertTo8Bit = async () => {
    try {
        await convertImageType('8-bit');
    } catch (error) {
        console.error('Error converting to 8-bit:', error);
        alert('Failed to convert image to 8-bit.');
    }
};

export const handleConvertTo16Bit = async () => {
    try {
        await convertImageType('16-bit');
    } catch (error) {
        console.error('Error converting to 16-bit:', error);
        alert('Failed to convert image to 16-bit.');
    }
};

export const handleConvertTo32BitFloat = async () => {
    try {
        await convertImageType('32-bit Float');
    } catch (error) {
        console.error('Error converting to 32-bit Float:', error);
        alert('Failed to convert image to 32-bit Float.');
    }
};

export const handleConvertToRGBColor = async () => {
    try {
        await convertImageType('RGB Color');
    } catch (error) {
        console.error('Error converting to RGB Color:', error);
        alert('Failed to convert image to RGB Color.');
    }
};

