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

export const handleOpenColorBalance = (): void => {
    window.dispatchEvent(new CustomEvent('openColorBalance'));
};

// ============================================
// COLOR BALANCE PROCESSING
// ============================================

export type ColorChannel = 'Red' | 'Green' | 'Blue' | 'Cyan' | 'Magenta' | 'Yellow' | 'All';

/**
 * Check if a pixel has the specified color characteristic
 * @param r - Red value
 * @param g - Green value
 * @param b - Blue value
 * @param channel - Color channel to check
 * @param threshold - Minimum difference to consider as "having" that color
 * @returns true if pixel has the specified color
 */
const pixelHasColor = (r: number, g: number, b: number, channel: ColorChannel, threshold: number = 15): boolean => {
    switch (channel) {
        case 'Red':
            // Red: R is higher than G and B
            return r > g + threshold && r > b + threshold;
        case 'Green':
            // Green: G is higher than R and B
            return g > r + threshold && g > b + threshold;
        case 'Blue':
            // Blue: B is higher than R and G
            return b > r + threshold && b > g + threshold;
        case 'Cyan':
            // Cyan: G and B are high, R is low (opposite of Red)
            return g > r + threshold && b > r + threshold;
        case 'Magenta':
            // Magenta: R and B are high, G is low (opposite of Green)
            return r > g + threshold && b > g + threshold;
        case 'Yellow':
            // Yellow: R and G are high, B is low (opposite of Blue)
            return r > b + threshold && g > b + threshold;
        case 'All':
            return true; // All pixels
        default:
            return false;
    }
};

/**
 * Process color balance adjustment for a specific color channel
 * Only affects pixels that actually contain the selected color
 * @param imageData - Source image data
 * @param min - Minimum display value (0-255)
 * @param max - Maximum display value (0-255)
 * @param channel - Color channel to adjust
 * @returns Processed ImageData
 */
export const processColorBalance = (
    imageData: ImageData,
    min: number,
    max: number,
    channel: ColorChannel
): ImageData => {
    const data = imageData.data;
    const range = max - min;
    const factor = 255 / (range === 0 ? 1 : range);

    // Helper function to apply adjustment to a single value
    const adjust = (value: number): number => {
        const adjusted = (value - min) * factor;
        return Math.max(0, Math.min(255, adjusted));
    };

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Skip pixels that don't have the selected color (except for 'All')
        if (channel !== 'All' && !pixelHasColor(r, g, b, channel)) {
            continue;
        }

        switch (channel) {
            case 'Red':
                // Adjust only red channel for red pixels
                data[i] = adjust(r);
                break;
            case 'Green':
                // Adjust only green channel for green pixels
                data[i + 1] = adjust(g);
                break;
            case 'Blue':
                // Adjust only blue channel for blue pixels
                data[i + 2] = adjust(b);
                break;
            case 'Cyan':
                // Cyan affects Red channel inversely for cyan pixels
                data[i] = 255 - adjust(255 - r);
                break;
            case 'Magenta':
                // Magenta affects Green channel inversely for magenta pixels
                data[i + 1] = 255 - adjust(255 - g);
                break;
            case 'Yellow':
                // Yellow affects Blue channel inversely for yellow pixels
                data[i + 2] = 255 - adjust(255 - b);
                break;
            case 'All':
                // Adjust all channels equally (like standard brightness/contrast)
                data[i] = adjust(r);
                data[i + 1] = adjust(g);
                data[i + 2] = adjust(b);
                break;
        }
    }

    return imageData;
};

/**
 * Get histogram for a specific color channel
 * @param imageData - Source image data
 * @param channel - Color channel to analyze
 * @returns 256-bin histogram array
 */
export const getColorChannelHistogram = (
    imageData: ImageData,
    channel: ColorChannel
): number[] => {
    const histogram = new Array(256).fill(0);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        let value: number;

        switch (channel) {
            case 'Red':
                value = data[i];
                break;
            case 'Green':
                value = data[i + 1];
                break;
            case 'Blue':
                value = data[i + 2];
                break;
            case 'Cyan':
                // Cyan = 255 - Red
                value = 255 - data[i];
                break;
            case 'Magenta':
                // Magenta = 255 - Green
                value = 255 - data[i + 1];
                break;
            case 'Yellow':
                // Yellow = 255 - Blue
                value = 255 - data[i + 2];
                break;
            case 'All':
            default:
                // Grayscale luminance
                value = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                break;
        }

        histogram[value]++;
    }

    return histogram;
};

/**
 * Analyze histogram for a specific color channel and find min/max values
 * @param imageData - Source image data
 * @param channel - Color channel to analyze
 * @returns Object with histogram bins and min/max values
 */
export const analyzeColorChannelHistogram = (
    imageData: ImageData,
    channel: ColorChannel
): { bins: number[]; min: number; max: number } => {
    const bins = getColorChannelHistogram(imageData, channel);
    let min = 255;
    let max = 0;

    for (let i = 0; i < 256; i++) {
        if (bins[i] > 0) {
            if (i < min) min = i;
            if (i > max) max = i;
        }
    }

    return { bins, min, max };
};

interface BitDepthConversionDetail {
    bitDepth: number; // Bit Depth mục tiêu (8, 16, 32)
    currentBitDepth: number; // Bit Depth hiện tại của ảnh (từ NavBar)
    isColor: boolean; // Dùng cho RGB
}

export const handleConvertBitDepth = (bitDepth: number, currentBitDepth: number, isColor: boolean = false): void => {
    const detail: BitDepthConversionDetail = { bitDepth, currentBitDepth, isColor };
    window.dispatchEvent(new CustomEvent('convertBitDepth', { detail }));
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

export const handleOpenImageSize = (): void => {
    window.dispatchEvent(new CustomEvent('openImageSize'));
};

export const handleOpenThreshold = (): void => {
    window.dispatchEvent(new CustomEvent('openThreshold'));
};

// ============================================
// AUTO-THRESHOLDING ALGORITHMS
// Based on ImageJ AutoThresholder
// ============================================

/**
 * Get histogram from ImageData (256 bins)
 */
export const getHistogram = (imageData: ImageData): number[] => {
    const histogram = new Array(256).fill(0);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale using luminance formula
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        histogram[gray]++;
    }
    
    return histogram;
};

/**
 * Default (IJ_IsoData) auto-threshold method
 * This is the iterative intermeans method
 */
const thresholdDefault = (histogram: number[]): number => {
    const count = histogram.length;
    let total = 0;
    
    for (let i = 0; i < count; i++) {
        total += histogram[i];
    }
    
    if (total === 0) return 0;
    
    // Initial guess at threshold
    let threshold = 0;
    for (let i = 0; i < count; i++) {
        threshold += i * histogram[i];
    }
    threshold = Math.round(threshold / total);
    
    // Iterate until threshold is stable
    let lastThreshold = -1;
    while (threshold !== lastThreshold) {
        lastThreshold = threshold;
        
        let sum1 = 0, count1 = 0;
        for (let i = 0; i <= threshold; i++) {
            sum1 += i * histogram[i];
            count1 += histogram[i];
        }
        
        let sum2 = 0, count2 = 0;
        for (let i = threshold + 1; i < count; i++) {
            sum2 += i * histogram[i];
            count2 += histogram[i];
        }
        
        const mean1 = count1 > 0 ? sum1 / count1 : 0;
        const mean2 = count2 > 0 ? sum2 / count2 : 0;
        threshold = Math.round((mean1 + mean2) / 2);
    }
    
    return threshold;
};

/**
 * Otsu's threshold selection method
 */
const thresholdOtsu = (histogram: number[]): number => {
    let total = 0;
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
    }
    
    if (total === 0) return 0;
    
    let sumB = 0;
    let wB = 0;
    let maximum = 0;
    let threshold = 0;
    let sum1 = 0;
    
    for (let i = 0; i < 256; i++) {
        sum1 += i * histogram[i];
    }
    
    for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB === 0) continue;
        
        const wF = total - wB;
        if (wF === 0) break;
        
        sumB += i * histogram[i];
        
        const mB = sumB / wB;
        const mF = (sum1 - sumB) / wF;
        
        const between = wB * wF * (mB - mF) * (mB - mF);
        
        if (between >= maximum) {
            threshold = i;
            maximum = between;
        }
    }
    
    return threshold;
};

/**
 * Huang's fuzzy thresholding method
 */
const thresholdHuang = (histogram: number[]): number => {
    let total = 0;
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
    }
    
    if (total === 0) return 0;
    
    // Find first and last non-zero bins
    let first = 0, last = 255;
    for (let i = 0; i < 256; i++) {
        if (histogram[i] > 0) { first = i; break; }
    }
    for (let i = 255; i >= 0; i--) {
        if (histogram[i] > 0) { last = i; break; }
    }
    
    if (first === last) return first;
    
    // Calculate fuzzy entropy
    let bestThreshold = first;
    let minEntropy = Number.MAX_VALUE;
    
    for (let t = first + 1; t < last; t++) {
        let muB = 0, muF = 0;
        let sumB = 0, sumF = 0;
        
        for (let i = first; i <= t; i++) {
            muB += i * histogram[i];
            sumB += histogram[i];
        }
        if (sumB > 0) muB /= sumB;
        
        for (let i = t + 1; i <= last; i++) {
            muF += i * histogram[i];
            sumF += histogram[i];
        }
        if (sumF > 0) muF /= sumF;
        
        let entropy = 0;
        for (let i = first; i <= last; i++) {
            const mu = i <= t ? muB : muF;
            if (histogram[i] > 0) {
                const diff = Math.abs(i - mu);
                const membership = 1 / (1 + diff / 255);
                if (membership > 0 && membership < 1) {
                    entropy -= histogram[i] * (membership * Math.log(membership) + 
                               (1 - membership) * Math.log(1 - membership));
                }
            }
        }
        
        if (entropy < minEntropy) {
            minEntropy = entropy;
            bestThreshold = t;
        }
    }
    
    return bestThreshold;
};

/**
 * Intermodes thresholding
 */
const thresholdIntermodes = (histogram: number[]): number => {
    // Smooth histogram
    const smoothed = [...histogram];
    let iter = 0;
    const maxIter = 10000;
    
    while (!isBimodal(smoothed) && iter < maxIter) {
        const temp = [...smoothed];
        for (let i = 1; i < 255; i++) {
            smoothed[i] = (temp[i - 1] + temp[i] + temp[i + 1]) / 3;
        }
        iter++;
    }
    
    // Find two peaks
    let peak1 = 0, peak2 = 255;
    let maxVal = 0;
    
    for (let i = 0; i < 128; i++) {
        if (smoothed[i] > maxVal) {
            maxVal = smoothed[i];
            peak1 = i;
        }
    }
    
    maxVal = 0;
    for (let i = 128; i < 256; i++) {
        if (smoothed[i] > maxVal) {
            maxVal = smoothed[i];
            peak2 = i;
        }
    }
    
    return Math.round((peak1 + peak2) / 2);
};

const isBimodal = (histogram: number[]): boolean => {
    let modes = 0;
    for (let i = 1; i < 255; i++) {
        if (histogram[i - 1] < histogram[i] && histogram[i + 1] < histogram[i]) {
            modes++;
            if (modes > 2) return false;
        }
    }
    return modes === 2;
};

/**
 * Li's Minimum Cross Entropy thresholding
 */
const thresholdLi = (histogram: number[]): number => {
    let total = 0;
    let sum = 0;
    
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
        sum += i * histogram[i];
    }
    
    if (total === 0) return 0;
    
    let mean = sum / total;
    let threshold = Math.round(mean);
    let newThreshold = 0;
    
    for (let iter = 0; iter < 1000; iter++) {
        let sumB = 0, countB = 0;
        let sumF = 0, countF = 0;
        
        for (let i = 0; i < 256; i++) {
            if (i <= threshold) {
                sumB += i * histogram[i];
                countB += histogram[i];
            } else {
                sumF += i * histogram[i];
                countF += histogram[i];
            }
        }
        
        const meanB = countB > 0 ? sumB / countB : 0;
        const meanF = countF > 0 ? sumF / countF : mean;
        
        if (meanB <= 0 || meanF <= 0) break;
        
        newThreshold = Math.round((Math.log(meanB) - Math.log(meanF)) / 
                                   (1 / meanF - 1 / meanB));
        
        if (newThreshold < 0) newThreshold = 0;
        if (newThreshold > 255) newThreshold = 255;
        
        if (newThreshold === threshold) break;
        threshold = newThreshold;
    }
    
    return threshold;
};

/**
 * Maximum Entropy thresholding
 */
const thresholdMaxEntropy = (histogram: number[]): number => {
    let total = 0;
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
    }
    
    if (total === 0) return 0;
    
    // Normalize histogram
    const norm = histogram.map(h => h / total);
    
    let maxEntropy = -Number.MAX_VALUE;
    let threshold = 0;
    
    for (let t = 0; t < 256; t++) {
        // Background entropy
        let sumB = 0;
        for (let i = 0; i <= t; i++) {
            sumB += norm[i];
        }
        
        if (sumB <= 0 || sumB >= 1) continue;
        
        let entropyB = 0;
        for (let i = 0; i <= t; i++) {
            if (norm[i] > 0) {
                const p = norm[i] / sumB;
                entropyB -= p * Math.log(p);
            }
        }
        
        // Foreground entropy
        let entropyF = 0;
        const sumF = 1 - sumB;
        for (let i = t + 1; i < 256; i++) {
            if (norm[i] > 0) {
                const p = norm[i] / sumF;
                entropyF -= p * Math.log(p);
            }
        }
        
        const totalEntropy = entropyB + entropyF;
        
        if (totalEntropy > maxEntropy) {
            maxEntropy = totalEntropy;
            threshold = t;
        }
    }
    
    return threshold;
};

/**
 * Mean thresholding
 */
const thresholdMean = (histogram: number[]): number => {
    let total = 0;
    let sum = 0;
    
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
        sum += i * histogram[i];
    }
    
    return total > 0 ? Math.round(sum / total) : 0;
};

/**
 * Minimum thresholding (minimum between two peaks)
 */
const thresholdMinimum = (histogram: number[]): number => {
    // Smooth histogram
    const smoothed = [...histogram];
    const maxIter = 10000;
    let iter = 0;
    
    while (!isBimodal(smoothed) && iter < maxIter) {
        const temp = [...smoothed];
        for (let i = 1; i < 255; i++) {
            smoothed[i] = (temp[i - 1] + temp[i] + temp[i + 1]) / 3;
        }
        iter++;
    }
    
    // Find minimum between peaks
    let minVal = Number.MAX_VALUE;
    let threshold = 128;
    
    for (let i = 1; i < 255; i++) {
        if (smoothed[i] < minVal && smoothed[i - 1] >= smoothed[i] && smoothed[i + 1] >= smoothed[i]) {
            minVal = smoothed[i];
            threshold = i;
        }
    }
    
    return threshold;
};

/**
 * Triangle thresholding
 */
const thresholdTriangle = (histogram: number[]): number => {
    // Find first and last non-zero bins
    let min = 0, max = 255;
    for (let i = 0; i < 256; i++) {
        if (histogram[i] > 0) { min = i; break; }
    }
    for (let i = 255; i >= 0; i--) {
        if (histogram[i] > 0) { max = i; break; }
    }
    
    if (min >= max) return min;
    
    // Find the peak
    let peakIdx = min;
    let peakVal = histogram[min];
    for (let i = min; i <= max; i++) {
        if (histogram[i] > peakVal) {
            peakVal = histogram[i];
            peakIdx = i;
        }
    }
    
    // Line from peak to end
    const flipLow = peakIdx < (max - peakIdx);
    const start = flipLow ? peakIdx : max;
    const end = flipLow ? max : peakIdx;
    
    // Calculate distances
    let maxDist = 0;
    let threshold = start;
    
    const a = peakVal;
    const b = histogram[end];
    const lineLen = end - start;
    
    for (let i = start; i <= end; i++) {
        const d = Math.abs((histogram[i] - a) * lineLen - (b - a) * (i - start)) / 
                  Math.sqrt(lineLen * lineLen + (b - a) * (b - a));
        if (d > maxDist) {
            maxDist = d;
            threshold = i;
        }
    }
    
    return flipLow ? threshold : max - (threshold - peakIdx);
};

/**
 * Yen thresholding
 */
const thresholdYen = (histogram: number[]): number => {
    let total = 0;
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
    }
    
    if (total === 0) return 0;
    
    const norm = histogram.map(h => h / total);
    
    // Cumulative sum
    const P1 = new Array(256).fill(0);
    P1[0] = norm[0];
    for (let i = 1; i < 256; i++) {
        P1[i] = P1[i - 1] + norm[i];
    }
    
    // Cumulative sum of squares
    const P1_sq = new Array(256).fill(0);
    P1_sq[0] = norm[0] * norm[0];
    for (let i = 1; i < 256; i++) {
        P1_sq[i] = P1_sq[i - 1] + norm[i] * norm[i];
    }
    
    const P2_sq = new Array(256).fill(0);
    P2_sq[255] = 0;
    for (let i = 254; i >= 0; i--) {
        P2_sq[i] = P2_sq[i + 1] + norm[i + 1] * norm[i + 1];
    }
    
    let maxCrit = -Number.MAX_VALUE;
    let threshold = 0;
    
    for (let t = 0; t < 255; t++) {
        const crit = -Math.log(P1_sq[t] * P2_sq[t]) + 2 * Math.log(P1[t] * (1 - P1[t]));
        if (crit > maxCrit) {
            maxCrit = crit;
            threshold = t;
        }
    }
    
    return threshold;
};

/**
 * Get threshold using specified method
 */
export const getAutoThreshold = (histogram: number[], method: string): number => {
    switch (method) {
        case 'Default':
        case 'IJ_IsoData':
            return thresholdDefault(histogram);
        case 'Huang':
            return thresholdHuang(histogram);
        case 'Intermodes':
            return thresholdIntermodes(histogram);
        case 'IsoData':
            return thresholdDefault(histogram);
        case 'Li':
            return thresholdLi(histogram);
        case 'MaxEntropy':
            return thresholdMaxEntropy(histogram);
        case 'Mean':
            return thresholdMean(histogram);
        case 'MinError':
            return thresholdOtsu(histogram); // Similar to Otsu
        case 'Minimum':
            return thresholdMinimum(histogram);
        case 'Moments':
            return thresholdMean(histogram); // Simplified
        case 'Otsu':
            return thresholdOtsu(histogram);
        case 'Percentile':
            return thresholdMean(histogram); // Simplified
        case 'RenyiEntropy':
            return thresholdMaxEntropy(histogram); // Similar
        case 'Shanbhag':
            return thresholdMaxEntropy(histogram); // Similar
        case 'Triangle':
            return thresholdTriangle(histogram);
        case 'Yen':
            return thresholdYen(histogram);
        default:
            return thresholdDefault(histogram);
    }
};

/**
 * Apply threshold to image data
 * @param imageData - Source image data
 * @param minThreshold - Minimum threshold (0-255)
 * @param maxThreshold - Maximum threshold (0-255)
 * @param mode - Threshold mode: 'red', 'bw', 'over_under'
 */
export const applyThresholdPreview = (
    imageData: ImageData,
    minThreshold: number,
    maxThreshold: number,
    mode: 'red' | 'bw' | 'over_under' = 'red'
): ImageData => {
    const data = imageData.data;
    const result = new ImageData(
        new Uint8ClampedArray(data),
        imageData.width,
        imageData.height
    );
    const resultData = result.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const inRange = gray >= minThreshold && gray <= maxThreshold;
        
        if (mode === 'red') {
            if (inRange) {
                resultData[i] = 255;     // Red
                resultData[i + 1] = 0;   // Green
                resultData[i + 2] = 0;   // Blue
            }
            // Keep original if not in range
        } else if (mode === 'bw') {
            if (inRange) {
                resultData[i] = resultData[i + 1] = resultData[i + 2] = 0; // Black
            } else {
                resultData[i] = resultData[i + 1] = resultData[i + 2] = 255; // White
            }
        } else if (mode === 'over_under') {
            if (gray < minThreshold) {
                resultData[i] = 0;       // Blue
                resultData[i + 1] = 0;
                resultData[i + 2] = 255;
            } else if (gray > maxThreshold) {
                resultData[i] = 0;       // Green
                resultData[i + 1] = 255;
                resultData[i + 2] = 0;
            }
            // Keep original if in range
        }
    }
    
    return result;
};

/**
 * Apply threshold to create binary mask
 */
export const applyThresholdMask = (
    imageData: ImageData,
    minThreshold: number,
    maxThreshold: number
): ImageData => {
    const data = imageData.data;
    const result = new ImageData(
        new Uint8ClampedArray(data.length),
        imageData.width,
        imageData.height
    );
    const resultData = result.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const inRange = gray >= minThreshold && gray <= maxThreshold;
        
        const value = inRange ? 255 : 0;
        resultData[i] = value;
        resultData[i + 1] = value;
        resultData[i + 2] = value;
        resultData[i + 3] = 255;
    }
    
    return result;
};

interface ResizeOptions {
    newWidth: number;
    newHeight: number;
    interpolation?: 'NearestNeighbor' | 'Bilinear' | 'Bicubic'; 
}

export const processImageResize = (
    imageData: ImageData,
    options: ResizeOptions
): ImageData => {
    const { newWidth, newHeight } = options;

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = imageData.width;
    originalCanvas.height = imageData.height;
    const originalCtx = originalCanvas.getContext('2d')!;
    originalCtx.putImageData(imageData, 0, 0);

    const newCanvas = document.createElement('canvas');
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    const newCtx = newCanvas.getContext('2d')!;

    newCtx.imageSmoothingEnabled = true;

    // Vẽ ảnh gốc lên canvas mới với kích thước mục tiêu
    newCtx.drawImage(originalCanvas, 0, 0, newWidth, newHeight);

    // Lấy ImageData mới từ canvas đã resize
    const newImageData = newCtx.getImageData(0, 0, newWidth, newHeight);

    return newImageData;
};


export const flipHorizontal = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  canvas.width = width;
  canvas.height = height;


  // Flip horizontally using transform
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, width, height, size);
};


/**
 * Flip image vertically
 */
export const flipVertical = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  canvas.width = width;
  canvas.height = height;


  // Flip vertically using transform
  ctx.translate(0, height);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, width, height, size);
};


/**
 * Rotate image left 90 degrees (counter-clockwise)
 */
export const rotateLeft90 = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  // Swap dimensions for 90-degree rotation
  canvas.width = height;
  canvas.height = width;


  // Rotate 90 degrees counter-clockwise (left)
  ctx.translate(0, width);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, height, width, size);
};


/**
 * Rotate image right 90 degrees (clockwise)
 */
export const rotateRight90 = (
  img: HTMLImageElement | null,
  onComplete: (dataUrl: string, width: number, height: number, size: number) => void
): void => {
  if (!img) return;


  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;


  const width = img.naturalWidth;
  const height = img.naturalHeight;


  if (width === 0 || height === 0) return;


  // Swap dimensions for 90-degree rotation
  canvas.width = height;
  canvas.height = width;


  // Rotate 90 degrees clockwise (right)
  ctx.translate(height, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0, width, height);


  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const size = Math.ceil(base64.length * 0.75);


  onComplete(dataUrl, height, width, size);
};


/**
 * Handler functions that dispatch events (for NavBar integration)
 */
export const handleFlipHorizontal = (): void => {
  const event = new CustomEvent('imageFlipHorizontal');
  window.dispatchEvent(event);
};


export const handleFlipVertical = (): void => {
  const event = new CustomEvent('imageFlipVertical');
  window.dispatchEvent(event);
};


export const handleRotateLeft90 = (): void => {
  const event = new CustomEvent('imageRotateLeft90');
  window.dispatchEvent(event);
};


export const handleRotateRight90 = (): void => {
  const event = new CustomEvent('imageRotateRight90');
  window.dispatchEvent(event);
};

// ============================================
// BIT DEPTH CONVERSION UTILITIES
// Based on ImageJ TypeConverter logic
// ============================================

/** Bit depth type constants */
const BYTE = 0;   // 8-bit
const SHORT = 1;  // 16-bit
const FLOAT = 2;  // 32-bit
const RGB = 3;    // RGB color

/** RGB to grayscale weighting factors (ITU-R BT.601) */
const DEFAULT_RGB_WEIGHTS = { r: 0.299, g: 0.587, b: 0.114 };

interface ConversionResult {
    data: Uint8ClampedArray | Uint16Array | Float32Array;
    width: number;
    height: number;
    bitDepth: 8 | 16 | 32;
    min?: number;
    max?: number;
}

interface ImageDataInfo {
    data: Uint8ClampedArray | Uint16Array | Float32Array;
    width: number;
    height: number;
    bitDepth: 8 | 16 | 32;
    isColor?: boolean;
    min?: number;
    max?: number;
}

/**
 * Get the type constant for the given bit depth
 */
const getType = (bitDepth: number, isColor: boolean = false): number => {
    if (isColor) return RGB;
    switch (bitDepth) {
        case 8: return BYTE;
        case 16: return SHORT;
        case 32: return FLOAT;
        default: return BYTE;
    }
};

/**
 * Calculate min and max values from the data array
 */
const calculateMinMax = (data: Uint8ClampedArray | Uint16Array | Float32Array, _bitDepth: number, isColor: boolean = false): { min: number; max: number } => {
    let min = Infinity;
    let max = -Infinity;

    if (isColor && data instanceof Uint8ClampedArray) {
        // For RGBA data, calculate grayscale min/max
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * DEFAULT_RGB_WEIGHTS.r + 
                        data[i + 1] * DEFAULT_RGB_WEIGHTS.g + 
                        data[i + 2] * DEFAULT_RGB_WEIGHTS.b;
            if (gray < min) min = gray;
            if (gray > max) max = gray;
        }
    } else {
        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
    }

    return { min, max };
};

// ============================================
// CONVERT TO 8-BIT (BYTE)
// ============================================

/**
 * Converts a 16-bit ShortProcessor to 8-bit ByteProcessor
 * @param pixels16 - 16-bit pixel data
 * @param width - image width
 * @param height - image height
 * @param doScaling - whether to scale values to fit 0-255 range
 * @param min - minimum value for scaling
 * @param max - maximum value for scaling
 */
const convertShortToByte = (
    pixels16: Uint16Array,
    width: number,
    height: number,
    doScaling: boolean = true,
    min?: number,
    max?: number
): Uint8ClampedArray => {
    const size = width * height;
    const pixels8 = new Uint8ClampedArray(size);

    if (doScaling) {
        // Calculate min/max if not provided
        if (min === undefined || max === undefined) {
            const stats = calculateMinMax(pixels16, 16);
            min = stats.min;
            max = stats.max;
        }
        const scale = 256.0 / (max - min + 1);

        for (let i = 0; i < size; i++) {
            let value = (pixels16[i] & 0xffff) - min;
            if (value < 0) value = 0;
            value = Math.round(value * scale);
            if (value > 255) value = 255;
            pixels8[i] = value;
        }
    } else {
        // No scaling - just clamp to 255
        for (let i = 0; i < size; i++) {
            let value = pixels16[i] & 0xffff;
            if (value > 255) value = 255;
            pixels8[i] = value;
        }
    }

    return pixels8;
};

/**
 * Converts a 32-bit FloatProcessor to 8-bit ByteProcessor
 * @param pixels32 - 32-bit float pixel data
 * @param width - image width
 * @param height - image height
 * @param doScaling - whether to scale values to fit 0-255 range
 * @param min - minimum value for scaling
 * @param max - maximum value for scaling
 */
const convertFloatToByte = (
    pixels32: Float32Array,
    width: number,
    height: number,
    doScaling: boolean = true,
    min?: number,
    max?: number
): Uint8ClampedArray => {
    const size = width * height;
    const pixels8 = new Uint8ClampedArray(size);

    if (doScaling) {
        // Calculate min/max if not provided
        if (min === undefined || max === undefined) {
            const stats = calculateMinMax(pixels32, 32);
            min = stats.min;
            max = stats.max;
        }
        const range = max - min;
        const scale = range === 0 ? 1.0 : 255.0 / range;

        for (let i = 0; i < size; i++) {
            let value = Math.round((pixels32[i] - min) * scale);
            if (value < 0) value = 0;
            if (value > 255) value = 255;
            pixels8[i] = value;
        }
    } else {
        // No scaling - just clamp
        for (let i = 0; i < size; i++) {
            let value = Math.round(pixels32[i]);
            if (value < 0) value = 0;
            if (value > 255) value = 255;
            pixels8[i] = value;
        }
    }

    return pixels8;
};

/**
 * Converts RGB ColorProcessor to 8-bit grayscale ByteProcessor
 * Uses weighted conversion: g = r*rw + g*gw + b*bw
 * @param pixelsRGBA - RGBA pixel data (Uint8ClampedArray from ImageData)
 * @param width - image width
 * @param height - image height
 * @param weights - RGB weights for grayscale conversion
 */
const convertRGBToByte = (
    pixelsRGBA: Uint8ClampedArray,
    width: number,
    height: number,
    weights: { r: number; g: number; b: number } = DEFAULT_RGB_WEIGHTS
): Uint8ClampedArray => {
    const size = width * height;
    const pixels8 = new Uint8ClampedArray(size);
    const { r: rw, g: gw, b: bw } = weights;

    for (let i = 0; i < size; i++) {
        const idx = i * 4;
        const r = pixelsRGBA[idx];
        const g = pixelsRGBA[idx + 1];
        const b = pixelsRGBA[idx + 2];
        pixels8[i] = Math.round(r * rw + g * gw + b * bw);
    }

    return pixels8;
};

/**
 * Main function to convert any image to 8-bit
 * @param imageInfo - Image data information
 * @param doScaling - whether to scale values
 */
export const convertTo8Bit = (
    imageInfo: ImageDataInfo,
    doScaling: boolean = true
): ConversionResult => {
    const { data, width, height, bitDepth, isColor = false, min, max } = imageInfo;
    const type = getType(bitDepth, isColor);

    let result: Uint8ClampedArray;

    switch (type) {
        case BYTE:
            // Already 8-bit, return copy
            if (data instanceof Uint8ClampedArray && !isColor) {
                result = new Uint8ClampedArray(data);
            } else if (isColor && data instanceof Uint8ClampedArray) {
                result = convertRGBToByte(data, width, height);
            } else {
                result = new Uint8ClampedArray(data);
            }
            break;
        case SHORT:
            result = convertShortToByte(data as Uint16Array, width, height, doScaling, min, max);
            break;
        case FLOAT:
            result = convertFloatToByte(data as Float32Array, width, height, doScaling, min, max);
            break;
        case RGB:
            result = convertRGBToByte(data as Uint8ClampedArray, width, height);
            break;
        default:
            result = new Uint8ClampedArray(width * height);
    }

    return {
        data: result,
        width,
        height,
        bitDepth: 8
    };
};

// ============================================
// CONVERT TO 16-BIT (SHORT)
// ============================================

/**
 * Converts an 8-bit ByteProcessor to 16-bit ShortProcessor
 * @param pixels8 - 8-bit pixel data
 * @param width - image width
 * @param height - image height
 */
const convertByteToShort = (
    pixels8: Uint8ClampedArray,
    width: number,
    height: number
): Uint16Array => {
    const size = width * height;
    const pixels16 = new Uint16Array(size);

    for (let i = 0; i < size; i++) {
        pixels16[i] = pixels8[i] & 0xff;
    }

    return pixels16;
};

/**
 * Converts a 32-bit FloatProcessor to 16-bit ShortProcessor
 * @param pixels32 - 32-bit float pixel data
 * @param width - image width
 * @param height - image height
 * @param doScaling - whether to scale values to fit 0-65535 range
 * @param min - minimum value for scaling
 * @param max - maximum value for scaling
 */
const convertFloatToShort = (
    pixels32: Float32Array,
    width: number,
    height: number,
    doScaling: boolean = true,
    min?: number,
    max?: number
): Uint16Array => {
    const size = width * height;
    const pixels16 = new Uint16Array(size);

    // Calculate min/max if not provided
    if (min === undefined || max === undefined) {
        const stats = calculateMinMax(pixels32, 32);
        min = stats.min;
        max = stats.max;
    }

    const range = max - min;
    const scale = range === 0 ? 1.0 : 65535.0 / range;

    for (let i = 0; i < size; i++) {
        let value: number;
        if (doScaling) {
            value = (pixels32[i] - min) * scale;
        } else {
            value = pixels32[i];
        }
        if (value < 0) value = 0;
        if (value > 65535) value = 65535;
        pixels16[i] = Math.round(value);
    }

    return pixels16;
};

/**
 * Main function to convert any image to 16-bit
 * @param imageInfo - Image data information
 * @param doScaling - whether to scale values
 */
export const convertTo16Bit = (
    imageInfo: ImageDataInfo,
    doScaling: boolean = true
): ConversionResult => {
    const { data, width, height, bitDepth, isColor = false, min, max } = imageInfo;
    const type = getType(bitDepth, isColor);

    let result: Uint16Array;

    switch (type) {
        case BYTE:
            result = convertByteToShort(data as Uint8ClampedArray, width, height);
            break;
        case SHORT:
            // Already 16-bit, return copy
            result = new Uint16Array(data as Uint16Array);
            break;
        case FLOAT:
            result = convertFloatToShort(data as Float32Array, width, height, doScaling, min, max);
            break;
        case RGB:
            // First convert RGB to byte, then byte to short
            const pixels8 = convertRGBToByte(data as Uint8ClampedArray, width, height);
            result = convertByteToShort(pixels8, width, height);
            break;
        default:
            result = new Uint16Array(width * height);
    }

    return {
        data: result,
        width,
        height,
        bitDepth: 16
    };
};

// ============================================
// CONVERT TO 32-BIT (FLOAT)
// ============================================

/**
 * Converts an 8-bit ByteProcessor to 32-bit FloatProcessor
 * Optionally applies calibration table
 * @param pixels8 - 8-bit pixel data
 * @param width - image width
 * @param height - image height
 * @param cTable - optional calibration table (256 entries for 8-bit)
 */
const convertByteToFloat = (
    pixels8: Uint8ClampedArray,
    width: number,
    height: number,
    cTable?: Float32Array | null
): Float32Array => {
    const size = width * height;
    const pixels32 = new Float32Array(size);

    if (cTable && cTable.length === 256) {
        for (let i = 0; i < size; i++) {
            pixels32[i] = cTable[pixels8[i] & 255];
        }
    } else {
        for (let i = 0; i < size; i++) {
            pixels32[i] = pixels8[i] & 255;
        }
    }

    return pixels32;
};

/**
 * Converts a 16-bit ShortProcessor to 32-bit FloatProcessor
 * Optionally applies calibration table
 * @param pixels16 - 16-bit pixel data
 * @param width - image width
 * @param height - image height
 * @param cTable - optional calibration table (65536 entries for 16-bit)
 */
const convertShortToFloat = (
    pixels16: Uint16Array,
    width: number,
    height: number,
    cTable?: Float32Array | null
): Float32Array => {
    const size = width * height;
    const pixels32 = new Float32Array(size);

    if (cTable && cTable.length === 65536) {
        for (let i = 0; i < size; i++) {
            pixels32[i] = cTable[pixels16[i] & 0xffff];
        }
    } else {
        for (let i = 0; i < size; i++) {
            pixels32[i] = pixels16[i] & 0xffff;
        }
    }

    return pixels32;
};

/**
 * Converts RGB ColorProcessor to 32-bit grayscale FloatProcessor
 * Uses weighted conversion: g = r*rw + g*gw + b*bw
 * @param pixelsRGBA - RGBA pixel data (Uint8ClampedArray from ImageData)
 * @param width - image width
 * @param height - image height
 * @param weights - RGB weights for grayscale conversion
 */
const convertRGBToFloat = (
    pixelsRGBA: Uint8ClampedArray,
    width: number,
    height: number,
    weights: { r: number; g: number; b: number } = DEFAULT_RGB_WEIGHTS
): Float32Array => {
    const size = width * height;
    const pixels32 = new Float32Array(size);
    const { r: rw, g: gw, b: bw } = weights;

    for (let i = 0; i < size; i++) {
        const idx = i * 4;
        const r = pixelsRGBA[idx];
        const g = pixelsRGBA[idx + 1];
        const b = pixelsRGBA[idx + 2];
        pixels32[i] = r * rw + g * gw + b * bw;
    }

    return pixels32;
};

/**
 * Main function to convert any image to 32-bit
 * @param imageInfo - Image data information
 * @param cTable - optional calibration table
 */
export const convertTo32Bit = (
    imageInfo: ImageDataInfo,
    cTable?: Float32Array | null
): ConversionResult => {
    const { data, width, height, bitDepth, isColor = false } = imageInfo;
    const type = getType(bitDepth, isColor);

    let result: Float32Array;

    switch (type) {
        case BYTE:
            result = convertByteToFloat(data as Uint8ClampedArray, width, height, cTable);
            break;
        case SHORT:
            result = convertShortToFloat(data as Uint16Array, width, height, cTable);
            break;
        case FLOAT:
            // Already 32-bit, return copy
            result = new Float32Array(data as Float32Array);
            break;
        case RGB:
            result = convertRGBToFloat(data as Uint8ClampedArray, width, height);
            break;
        default:
            result = new Float32Array(width * height);
    }

    const stats = calculateMinMax(result, 32);

    return {
        data: result,
        width,
        height,
        bitDepth: 32,
        min: stats.min,
        max: stats.max
    };
};

// ============================================
// UTILITY FUNCTIONS FOR ImageData CONVERSION
// ============================================

/**
 * Convert grayscale data back to RGBA ImageData for display
 * @param grayData - grayscale pixel data (any bit depth)
 * @param width - image width
 * @param height - image height
 * @param bitDepth - bit depth of input data
 * @param min - minimum value for scaling (for 16/32-bit)
 * @param max - maximum value for scaling (for 16/32-bit)
 */
export const grayToImageData = (
    grayData: Uint8ClampedArray | Uint16Array | Float32Array,
    width: number,
    height: number,
    bitDepth: 8 | 16 | 32 = 8,
    min?: number,
    max?: number
): ImageData => {
    const size = width * height;
    const rgba = new Uint8ClampedArray(size * 4);

    // Calculate scaling if needed
    if (min === undefined || max === undefined) {
        const stats = calculateMinMax(grayData, bitDepth);
        min = stats.min;
        max = stats.max;
    }

    const range = max - min;
    const scale = range === 0 ? 1.0 : 255.0 / range;

    for (let i = 0; i < size; i++) {
        let value: number;
        if (bitDepth === 8) {
            value = grayData[i];
        } else {
            // Scale 16-bit or 32-bit to 8-bit for display
            value = Math.round((grayData[i] - min!) * scale);
            if (value < 0) value = 0;
            if (value > 255) value = 255;
        }

        const idx = i * 4;
        rgba[idx] = value;     // R
        rgba[idx + 1] = value; // G
        rgba[idx + 2] = value; // B
        rgba[idx + 3] = 255;   // A (fully opaque)
    }

    return new ImageData(rgba, width, height);
};

/**
 * Extract grayscale data from ImageData
 * @param imageData - source ImageData
 * @param isColor - treat as color image (use RGB weights)
 */
export const imageDataToGray = (
    imageData: ImageData,
    isColor: boolean = false
): Uint8ClampedArray => {
    const { data, width, height } = imageData;
    const size = width * height;
    const gray = new Uint8ClampedArray(size);

    if (isColor) {
        const { r: rw, g: gw, b: bw } = DEFAULT_RGB_WEIGHTS;
        for (let i = 0; i < size; i++) {
            const idx = i * 4;
            gray[i] = Math.round(data[idx] * rw + data[idx + 1] * gw + data[idx + 2] * bw);
        }
    } else {
        // Assume grayscale (R = G = B), just take red channel
        for (let i = 0; i < size; i++) {
            gray[i] = data[i * 4];
        }
    }

    return gray;
};