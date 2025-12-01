import { useEffect } from 'react';
import type { ImageInfo } from '../../../types/image';
import { processBrightnessContrast } from '../../../utils/nav-bar/imageUtils';

// Định nghĩa lại interface chi tiết sự kiện
interface BitDepthConversionDetail {
    bitDepth: number;
    currentBitDepth: number; 
    isColor: boolean;
}

interface UseBitDepthEventsProps {
    currentFile: ImageInfo | undefined;
    currentIndex: number;
    setVisibleImages: React.Dispatch<React.SetStateAction<ImageInfo[]>>;
    setDisplayRange: React.Dispatch<React.SetStateAction<{ min: number; max: number }>>;
    setAppliedDisplayRange: React.Dispatch<React.SetStateAction<{ min: number; max: number; bitDepth: number } | null>>; // [NEW] Thêm setter mới
    
    // Các hàm utility
    getImageData: () => { ctx: CanvasRenderingContext2D, imageData: ImageData, canvas: HTMLCanvasElement } | null;
    updateImageFromCanvas: (canvas: HTMLCanvasElement, saveToHistory: boolean) => void;
    setOriginalImageData: React.Dispatch<React.SetStateAction<ImageData | null>>;
}

const useBitDepthEvents = ({
    currentFile,
    currentIndex,
    setVisibleImages,
    setDisplayRange,
    setAppliedDisplayRange, // [NEW] Nhận setter mới
    getImageData,
    updateImageFromCanvas,
    setOriginalImageData,
}: UseBitDepthEventsProps) => {

    useEffect(() => {
        const handleBitDepthConvert = (e: Event) => {
            const customEvent = e as CustomEvent<BitDepthConversionDetail>;
            const targetBitDepth = customEvent.detail.bitDepth;
            const isColor = customEvent.detail.isColor;

            if (!currentFile) return;

            let dataObj = getImageData();
            if (!dataObj) return;

            setOriginalImageData(dataObj.imageData); 
            
            const currentBitDepth = currentFile.bitDepth;
            let newMin: number;
            let newMax: number;

            // Logic tính toán Min/Max theo yêu cầu (GIỮ NGUYÊN)
            if (targetBitDepth === 8) {
                newMin = 0;
                newMax = 255;
            } else if (targetBitDepth === 16) {
                newMin = 47;
                newMax = 255;
            } else if (targetBitDepth === 32) {
                if (currentBitDepth === 8) {
                    newMin = 0;
                    newMax = 255;
                } else {
                    newMin = 47;
                    newMax = 255;
                }
            } else if (isColor) {
                newMin = 0;
                newMax = 255;
            } else {
                return;
            }

            // 1. Cập nhật Display Range cho dialog
            setDisplayRange({ min: newMin, max: newMax });
            
            // 2. [NEW] LƯU TRỮ VĨNH VIỄN CÁC THÔNG SỐ NÀY
            setAppliedDisplayRange({
                min: newMin,
                max: newMax,
                bitDepth: targetBitDepth
            });

            // 3. Cập nhật thuộc tính ảnh (bitDepth)
            setVisibleImages(prevImages => prevImages.map((img, idx) => 
                idx === currentIndex 
                ? { 
                    ...img, 
                    bitDepth: targetBitDepth,
                    } 
                : img
            ));

            // 4. Áp dụng Visual Changes (Force Preview) (GIỮ NGUYÊN)
            const { ctx, imageData, canvas } = dataObj;
            const freshData = new ImageData(
                new Uint8ClampedArray(imageData.data),
                imageData.width,
                imageData.height
            );
            
            const processed = processBrightnessContrast(freshData, newMin, newMax);
            ctx.putImageData(processed, 0, 0);
            updateImageFromCanvas(canvas, false);
        };

        window.addEventListener('convertBitDepth', handleBitDepthConvert as EventListener);
        return () => {
            window.removeEventListener('convertBitDepth', handleBitDepthConvert as EventListener);
        };
    }, [currentIndex, currentFile]); 

};

export default useBitDepthEvents;