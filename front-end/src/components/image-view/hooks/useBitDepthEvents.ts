import { useEffect, useRef, useCallback } from 'react';
import type { ImageInfo } from '../../../types/image';
import {
    convertTo8Bit,
    convertTo16Bit,
    convertTo32Bit,
    grayToImageData,
    imageDataToGray,
} from '../../../utils/nav-bar/imageUtils';

// Định nghĩa lại interface chi tiết sự kiện
interface BitDepthConversionDetail {
    bitDepth: number;
    currentBitDepth: number;
    isColor: boolean;
}

// Store raw pixel data for different bit depths
export interface RawImageData {
    data8?: Uint8ClampedArray;
    data16?: Uint16Array;
    data32?: Float32Array;
    width: number;
    height: number;
    currentBitDepth: 8 | 16 | 32;
    min: number;
    max: number;
}

interface UseBitDepthEventsProps {
    currentFile: ImageInfo | undefined;
    currentIndex: number;
    setVisibleImages: React.Dispatch<React.SetStateAction<ImageInfo[]>>;
    setDisplayRange: React.Dispatch<React.SetStateAction<{ min: number; max: number }>>;
    setAppliedDisplayRange: React.Dispatch<React.SetStateAction<{ min: number; max: number; bitDepth: number } | null>>;

    // Các hàm utility
    getImageData: () => { ctx: CanvasRenderingContext2D; imageData: ImageData; canvas: HTMLCanvasElement } | null;
    updateImageFromCanvas: (canvas: HTMLCanvasElement, saveToHistory: boolean) => void;
    setOriginalImageData: React.Dispatch<React.SetStateAction<ImageData | null>>;
    pushUndo: () => void;
}

interface UseBitDepthEventsReturn {
    rawImageDataRef: React.MutableRefObject<RawImageData | null>;
    applyDisplayRangeToRawData: (min: number, max: number) => void;
    getCurrentBitDepthRange: () => { min: number; max: number; bitDepth: number };
}

const useBitDepthEvents = ({
    currentFile,
    currentIndex,
    setVisibleImages,
    setDisplayRange,
    setAppliedDisplayRange,
    getImageData,
    updateImageFromCanvas,
    setOriginalImageData,
    pushUndo,
}: UseBitDepthEventsProps): UseBitDepthEventsReturn => {
    // Store raw pixel data for accurate bit depth conversions
    const rawImageDataRef = useRef<RawImageData | null>(null);

    // Get current bit depth range
    const getCurrentBitDepthRange = useCallback((): { min: number; max: number; bitDepth: number } => {
        const bitDepth = (currentFile?.bitDepth || 8) as 8 | 16 | 32;
        if (rawImageDataRef.current) {
            return {
                min: rawImageDataRef.current.min,
                max: rawImageDataRef.current.max,
                bitDepth: rawImageDataRef.current.currentBitDepth,
            };
        }
        // Default ranges based on bit depth
        switch (bitDepth) {
            case 16:
                return { min: 0, max: 255, bitDepth: 16 };
            case 32:
                return { min: 0, max: 255, bitDepth: 32 };
            default:
                return { min: 0, max: 255, bitDepth: 8 };
        }
    }, [currentFile?.bitDepth]);

    // Apply display range to raw data and update canvas
    const applyDisplayRangeToRawData = useCallback((min: number, max: number) => {
        const dataObj = getImageData();
        if (!dataObj) return;

        const { ctx, imageData, canvas } = dataObj;
        const bitDepth = (currentFile?.bitDepth || 8) as 8 | 16 | 32;

        // Initialize raw data if not exists
        if (!rawImageDataRef.current) {
            const grayData = imageDataToGray(imageData, false);
            rawImageDataRef.current = {
                data8: grayData,
                width: imageData.width,
                height: imageData.height,
                currentBitDepth: 8,
                min: 0,
                max: 255,
            };
        }

        const rawData = rawImageDataRef.current;
        let resultImageData: ImageData;

        // Apply display range based on current bit depth
        if (bitDepth === 8 || rawData.currentBitDepth === 8) {
            // For 8-bit, use the existing processBrightnessContrast logic
            const freshData = new ImageData(
                new Uint8ClampedArray(imageData.data),
                imageData.width,
                imageData.height
            );
            
            // Apply contrast stretch based on min/max
            const data = freshData.data;
            const range = max - min;
            const factor = 255 / (range === 0 ? 1 : range);

            for (let i = 0; i < data.length; i += 4) {
                let r = (data[i] - min) * factor;
                data[i] = r < 0 ? 0 : r > 255 ? 255 : r;

                let g = (data[i + 1] - min) * factor;
                data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;

                let b = (data[i + 2] - min) * factor;
                data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
            }
            resultImageData = freshData;
        } else if (rawData.currentBitDepth === 16 && rawData.data16) {
            // For 16-bit, scale with the given min/max range
            resultImageData = grayToImageData(rawData.data16, rawData.width, rawData.height, 16, min, max);
        } else if (rawData.currentBitDepth === 32 && rawData.data32) {
            // For 32-bit, scale with the given min/max range
            resultImageData = grayToImageData(rawData.data32, rawData.width, rawData.height, 32, min, max);
        } else {
            return;
        }

        ctx.putImageData(resultImageData, 0, 0);
        updateImageFromCanvas(canvas, false);
    }, [currentFile?.bitDepth, getImageData, updateImageFromCanvas]);

    useEffect(() => {
        const handleBitDepthConvert = (e: Event) => {
            const customEvent = e as CustomEvent<BitDepthConversionDetail>;
            const targetBitDepth = customEvent.detail.bitDepth as 8 | 16 | 32;
            const isColor = customEvent.detail.isColor;

            if (!currentFile) return;

            const dataObj = getImageData();
            if (!dataObj) return;

            const { ctx, imageData, canvas } = dataObj;
            const currentBitDepth = (currentFile.bitDepth || 8) as 8 | 16 | 32;

            // Skip if already at target bit depth
            if (targetBitDepth === currentBitDepth && !isColor) {
                return;
            }

            // Save to undo before conversion
            pushUndo();
            setOriginalImageData(imageData);

            // Initialize or update raw image data storage
            if (!rawImageDataRef.current || rawImageDataRef.current.width !== imageData.width || rawImageDataRef.current.height !== imageData.height) {
                // First time or image dimensions changed - extract grayscale from current ImageData
                const grayData = imageDataToGray(imageData, isColor);
                rawImageDataRef.current = {
                    data8: grayData,
                    width: imageData.width,
                    height: imageData.height,
                    currentBitDepth: 8,
                    min: 0,
                    max: 255,
                };
            }

            const rawData = rawImageDataRef.current;
            let resultImageData: ImageData;
            let newMin: number;
            let newMax: number;

            // Get current raw data based on stored bit depth
            const getCurrentData = (): Uint8ClampedArray | Uint16Array | Float32Array => {
                if (rawData.currentBitDepth === 32 && rawData.data32) return rawData.data32;
                if (rawData.currentBitDepth === 16 && rawData.data16) return rawData.data16;
                return rawData.data8 || imageDataToGray(imageData, isColor);
            };

            const currentData = getCurrentData();

            // Perform conversion based on target bit depth
            if (targetBitDepth === 8) {
                // Convert to 8-bit
                const result = convertTo8Bit(
                    {
                        data: currentData,
                        width: rawData.width,
                        height: rawData.height,
                        bitDepth: rawData.currentBitDepth,
                        isColor,
                        min: rawData.min,
                        max: rawData.max,
                    },
                    true // doScaling
                );

                rawData.data8 = result.data as Uint8ClampedArray;
                rawData.currentBitDepth = 8;
                rawData.min = 0;
                rawData.max = 255;
                newMin = 0;
                newMax = 255;

                // Convert to ImageData for display
                resultImageData = grayToImageData(result.data as Uint8ClampedArray, rawData.width, rawData.height, 8);
            } else if (targetBitDepth === 16) {
                // Convert to 16-bit
                const result = convertTo16Bit(
                    {
                        data: currentData,
                        width: rawData.width,
                        height: rawData.height,
                        bitDepth: rawData.currentBitDepth,
                        isColor,
                        min: rawData.min,
                        max: rawData.max,
                    },
                    true // doScaling
                );

                rawData.data16 = result.data as Uint16Array;
                rawData.currentBitDepth = 16;
                
                // Calculate actual min/max for 16-bit display
                let min16 = 65535, max16 = 0;
                for (let i = 0; i < rawData.data16.length; i++) {
                    const val = rawData.data16[i];
                    if (val < min16) min16 = val;
                    if (val > max16) max16 = val;
                }
                rawData.min = min16;
                rawData.max = max16;
                newMin = min16;
                newMax = max16;

                // Convert to ImageData for display (scale to 0-255)
                resultImageData = grayToImageData(result.data as Uint16Array, rawData.width, rawData.height, 16, min16, max16);
            } else if (targetBitDepth === 32) {
                // Convert to 32-bit
                const result = convertTo32Bit({
                    data: currentData,
                    width: rawData.width,
                    height: rawData.height,
                    bitDepth: rawData.currentBitDepth,
                    isColor,
                });

                rawData.data32 = result.data as Float32Array;
                rawData.currentBitDepth = 32;
                rawData.min = result.min ?? 0;
                rawData.max = result.max ?? 255;
                newMin = result.min ?? 0;
                newMax = result.max ?? 255;

                // Convert to ImageData for display (scale to 0-255)
                resultImageData = grayToImageData(result.data as Float32Array, rawData.width, rawData.height, 32, result.min, result.max);
            } else {
                // RGB Color (24-bit) - convert back to color display
                newMin = 0;
                newMax = 255;
                resultImageData = imageData; // Keep original color data
            }

            // Update display range
            setDisplayRange({ min: newMin, max: newMax });

            // Store applied display range
            setAppliedDisplayRange({
                min: newMin,
                max: newMax,
                bitDepth: targetBitDepth,
            });

            // Update image properties (bitDepth)
            setVisibleImages((prevImages) =>
                prevImages.map((img, idx) =>
                    idx === currentIndex
                        ? {
                              ...img,
                              bitDepth: targetBitDepth,
                          }
                        : img
                )
            );

            // Apply converted image to canvas
            ctx.putImageData(resultImageData, 0, 0);
            updateImageFromCanvas(canvas, false);
        };

        window.addEventListener('convertBitDepth', handleBitDepthConvert as EventListener);
        return () => {
            window.removeEventListener('convertBitDepth', handleBitDepthConvert as EventListener);
        };
    }, [currentIndex, currentFile, getImageData, updateImageFromCanvas, setOriginalImageData, pushUndo, setDisplayRange, setAppliedDisplayRange, setVisibleImages]);

    // Reset raw image data when changing images
    useEffect(() => {
        rawImageDataRef.current = null;
    }, [currentIndex]);

    return {
        rawImageDataRef,
        applyDisplayRangeToRawData,
        getCurrentBitDepthRange,
    };
};

export default useBitDepthEvents;