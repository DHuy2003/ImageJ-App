export const dispatchNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { message, type }
    }));
};

const clamp = (value: number): number => Math.max(0, Math.min(255, value));

/**
 * Creates a new ImageData object with the same dimensions.
 */
const createOutputImage = (source: ImageData): ImageData => {
    return new ImageData(source.width, source.height);
};

/**
 * Applies a convolution kernel to the image.
 * @param imageData Source image data
 * @param kernel Flat array representing 3x3 kernel
 * @param divisor Value to divide the convolution sum by (normalization)
 * @param offset Value to add to the result (brightness offset)
 */

export const checkIsBinary = (imageData: ImageData): boolean => {
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        const val = data[i]; // Check Red channel (assuming grayscale/binary)
        // If we find a pixel that is neither 0 nor 255, it's not binary
        // We allow a tiny margin for compression artifacts if needed, but strictly 0/255 is safer for algorithms
        if (val !== 0 && val !== 255) {
            return false;
        }
    }
    return true;
};

const applyConvolution = (
    imageData: ImageData,
    kernel: number[],
    divisor: number = 1,
    offset: number = 0
): ImageData => {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    // Kernel is assumed to be 3x3
    // k0 k1 k2
    // k3 k4 k5
    // k6 k7 k8

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;

            // Apply 3x3 Kernel
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const py = y + ky;
                    const px = x + kx;

                    // Edge handling: Extend border pixels
                    const safeY = Math.min(Math.max(py, 0), height - 1);
                    const safeX = Math.min(Math.max(px, 0), width - 1);

                    const idx = (safeY * width + safeX) * 4;
                    const weight = kernel[(ky + 1) * 3 + (kx + 1)];

                    r += src[idx] * weight;
                    g += src[idx + 1] * weight;
                    b += src[idx + 2] * weight;
                }
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = clamp(r / divisor + offset);
            dst[dstIdx + 1] = clamp(g / divisor + offset);
            dst[dstIdx + 2] = clamp(b / divisor + offset);
            dst[dstIdx + 3] = src[dstIdx + 3]; // Preserve alpha
        }
    }

    return output;
};

// --- 1. Smooth ---

/**
 * Blurs the image using a 3x3 average neighborhood.
 */
export const processSmooth = (imageData: ImageData): ImageData => {
    // 1 1 1
    // 1 1 1
    // 1 1 1
    const kernel = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    return applyConvolution(imageData, kernel, 9);
};

// --- 2. Sharpen ---

/**
 * Increases contrast and accentuates detail.
 * Weights:
 * -1 -1 -1
 * -1 12 -1
 * -1 -1 -1
 */
export const processSharpen = (imageData: ImageData): ImageData => {
    const kernel = [
        -1, -1, -1,
        -1, 12, -1,
        -1, -1, -1
    ];
    // Sum of weights is 12 - 8 = 4. Dividing by 4 preserves average brightness.
    return applyConvolution(imageData, kernel, 4);
};

// --- 3. Find Edges ---

/**
 * Uses a Sobel edge detector to highlight sharp changes.
 * Combines Vertical and Horizontal derivatives.
 */
export const processFindEdges = (imageData: ImageData): ImageData => {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    // Kernel 1 (Vertical changes / Horizontal Edges)
    //  1  2  1
    //  0  0  0
    // -1 -2 -1
    const k1 = [1, 2, 1, 0, 0, 0, -1, -2, -1];

    // Kernel 2 (Horizontal changes / Vertical Edges)
    //  1  0 -1
    //  2  0 -2
    //  1  0 -1
    const k2 = [1, 0, -1, 2, 0, -2, 1, 0, -1];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r1 = 0, g1 = 0, b1 = 0;
            let r2 = 0, g2 = 0, b2 = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const py = Math.min(Math.max(y + ky, 0), height - 1);
                    const px = Math.min(Math.max(x + kx, 0), width - 1);
                    const idx = (py * width + px) * 4;

                    const kIdx = (ky + 1) * 3 + (kx + 1);

                    r1 += src[idx] * k1[kIdx];
                    g1 += src[idx + 1] * k1[kIdx];
                    b1 += src[idx + 2] * k1[kIdx];

                    r2 += src[idx] * k2[kIdx];
                    g2 += src[idx + 1] * k2[kIdx];
                    b2 += src[idx + 2] * k2[kIdx];
                }
            }

            // Magnitude = sqrt(K1^2 + K2^2)
            const r = Math.sqrt(r1 * r1 + r2 * r2);
            const g = Math.sqrt(g1 * g1 + g2 * g2);
            const b = Math.sqrt(b1 * b1 + b2 * b2);

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = clamp(r);
            dst[dstIdx + 1] = clamp(g);
            dst[dstIdx + 2] = clamp(b);
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

// --- Binary Helpers ---

/**
 * Calculates Otsu's threshold for the image.
 * Assumes the image is converted to grayscale first for calculation.
 */
export const calculateOtsuThreshold = (imageData: ImageData): number => {
    const { data } = imageData;
    const histogram = new Array(256).fill(0);
    let totalPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
        histogram[gray]++;
        totalPixels++;
    }
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 0;
    for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = totalPixels - wB;
        if (wF === 0) break;
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const varBetween = wB * wF * (mB - mF) * (mB - mF);
        if (varBetween > maxVar) {
            maxVar = varBetween;
            threshold = t;
        }
    }

    return Math.floor(threshold * 0.95);
};

// --- 5. Make Binary ---

export const processMakeBinary = (
    imageData: ImageData,
    threshold?: number
): ImageData => {
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    const thresh = threshold !== undefined ? threshold : calculateOtsuThreshold(imageData);

    for (let i = 0; i < src.length; i += 4) {
        // Simple grayscale conversion
        const gray = (src[i] + src[i + 1] + src[i + 2]) / 3;

        // Standard Binary: > Threshold is White (255), <= Threshold is Black (0)
        const val = gray > thresh ? 255 : 0;

        dst[i] = val;
        dst[i + 1] = val;
        dst[i + 2] = val;
        dst[i + 3] = src[i + 3];
    }

    return output;
};

// --- 6. Convert to Mask ---

export const processConvertToMask = (imageData: ImageData, threshold?: number): ImageData => {
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;
    const thresh = threshold !== undefined ? threshold : calculateOtsuThreshold(imageData);

    for (let i = 0; i < src.length; i += 4) {
        const gray = (src[i] + src[i + 1] + src[i + 2]) / 3;

        // Inverted Binary: > Threshold is Black (0), <= Threshold is White (255)
        const val = gray > thresh ? 0 : 255;

        dst[i] = val;
        dst[i + 1] = val;
        dst[i + 2] = val;
        dst[i + 3] = src[i + 3];
    }
    return output;
};

// --- Morphology Helpers (Erode/Dilate) ---

/**
 * Applies a generic rank filter (Min or Max).
 * @param type 'min' or 'max'
 */
const applyRankFilter = (imageData: ImageData, type: 'min' | 'max'): ImageData => {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rVal = type === 'min' ? 255 : 0;
            let gVal = type === 'min' ? 255 : 0;
            let bVal = type === 'min' ? 255 : 0;

            // 3x3 Neighborhood
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const py = Math.min(Math.max(y + ky, 0), height - 1);
                    const px = Math.min(Math.max(x + kx, 0), width - 1);
                    const idx = (py * width + px) * 4;

                    if (type === 'min') {
                        rVal = Math.min(rVal, src[idx]);
                        gVal = Math.min(gVal, src[idx + 1]);
                        bVal = Math.min(bVal, src[idx + 2]);
                    } else {
                        rVal = Math.max(rVal, src[idx]);
                        gVal = Math.max(gVal, src[idx + 1]);
                        bVal = Math.max(bVal, src[idx + 2]);
                    }
                }
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = rVal;
            dst[dstIdx + 1] = gVal;
            dst[dstIdx + 2] = bVal;
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }
    return output;
};

// --- 7. Erode ---

/**
 * Erode (Co): Removes pixels from the edges of objects.
 * Assumption: Objects are White (255) and Background is Black (0).
 * To shrink a White object, we need to bring in Black pixels.
 * Uses MIN filter (if any neighbor is 0, pixel becomes 0).
 */
export const processErode = (imageData: ImageData): ImageData | null => {
    if (!checkIsBinary(imageData)) {
        dispatchNotification("Erode requires a binary image. Use 'Make Binary' first.", 'info');
        return null;
    }
    return applyRankFilter(imageData, 'min');
};

// --- 8. Dilate ---

/**
 * Dilate (Giãn): Adds pixels to the edges of objects.
 * Assumption: Objects are White (255) and Background is Black (0).
 * To grow a White object, we need to expand White pixels.
 * Uses MAX filter (if any neighbor is 255, pixel becomes 255).
 */
export const processDilate = (imageData: ImageData): ImageData | null => {
    if (!checkIsBinary(imageData)) {
        dispatchNotification("Dilate requires a binary image. Use 'Make Binary' first.", 'info');
        return null;
    }
    return applyRankFilter(imageData, 'max');
};

// --- 9. Open ---

/**
 * Open (Mở): Erosion followed by Dilation.
 * Removes small white noise (salt) from black background.
 */
export const processOpen = (imageData: ImageData): ImageData | null => {
    if (!checkIsBinary(imageData)) {
        dispatchNotification("Open requires a binary image. Use 'Make Binary' first.", 'info');
        return null;
    }

    const eroded = processErode(imageData);
    if (!eroded) return null;
    const opened = processDilate(eroded);
    return opened;
};

// --- 10. Close ---

/**
 * Close (Đóng): Dilation followed by Erosion.
 * Fills small black holes (pepper) inside white objects.
 */
export const processClose = (imageData: ImageData): ImageData | null => {
    if (!checkIsBinary(imageData)) {
        dispatchNotification("Close requires a binary image. Use 'Make Binary' first.", 'info');
        return null;
    }
    const dilated = processDilate(imageData);
    if (!dilated) return null;
    const closed = processErode(dilated);
    return closed;
};

const calculateEDM = (width: number, height: number, grid: Uint8Array): Float32Array => {
    const dist = new Float32Array(width * height);
    const INF = width * height * 2;
    for (let i = 0; i < width * height; i++) {
        dist[i] = grid[i] === 1 ? INF : 0;
    }
    // Pass 1
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (dist[idx] > 0) {
                let min = dist[idx];
                if (x > 0) min = Math.min(min, dist[idx - 1] + 1);
                if (y > 0) min = Math.min(min, dist[idx - width] + 1);
                if (x > 0 && y > 0) min = Math.min(min, dist[idx - width - 1] + 1.414);
                if (x < width - 1 && y > 0) min = Math.min(min, dist[idx - width + 1] + 1.414);
                dist[idx] = min;
            }
        }
    }
    // Pass 2
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const idx = y * width + x;
            if (dist[idx] > 0) {
                let min = dist[idx];
                if (x < width - 1) min = Math.min(min, dist[idx + 1] + 1);
                if (y < height - 1) min = Math.min(min, dist[idx + width] + 1);
                if (x < width - 1 && y < height - 1) min = Math.min(min, dist[idx + width + 1] + 1.414);
                if (x > 0 && y < height - 1) min = Math.min(min, dist[idx + width - 1] + 1.414);
                dist[idx] = min;
            }
        }
    }
    return dist;
};

// Smooth the EDM to avoid over-segmentation
const smoothEDM = (width: number, height: number, edm: Float32Array): Float32Array => {
    const smoothed = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            const cIdx = y * width + x;
            sum += edm[cIdx] * 4; // Center weight

            // 3x3 approx Gaussian
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    if (kx === 0 && ky === 0) continue;
                    const py = y + ky;
                    const px = x + kx;
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        const weight = (Math.abs(kx) + Math.abs(ky) === 2) ? 1 : 2;
                        sum += edm[py * width + px] * weight;
                    } else {
                        sum += edm[cIdx] * ((Math.abs(kx) + Math.abs(ky) === 2) ? 1 : 2); // Mirror center for boundary
                    }
                }
            }
            smoothed[cIdx] = sum / 16.0;
        }
    }
    return smoothed;
}

export const processWatershed = (imageData: ImageData): ImageData | null => {
    if (!checkIsBinary(imageData)) {
        dispatchNotification("Watershed requires a binary image. Use 'Make Binary' first.", 'info');
        return null;
    }

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;

    // --- Step 1: Detect Polarity (Is Background Black or White?) ---
    const corners = [
        0,
        (width - 1) * 4,
        (height - 1) * width * 4,
        (width * height - 1) * 4
    ];
    let sumCorners = 0;
    corners.forEach(idx => sumCorners += src[idx]);
    const avgCorner = sumCorners / 4;

    // Determine polarity
    const isBackgroundBlack = avgCorner < 128;

    // --- Step 2: Prepare Binary Grid (1=Object, 0=Background) ---
    const grid = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const val = src[i * 4];
        if (isBackgroundBlack) {
            // Background Black (0), Object White (255) -> Grid: 1 if val>128
            grid[i] = val > 128 ? 1 : 0;
        } else {
            // Background White (255), Object Black (0) -> Grid: 1 if val<128
            grid[i] = val < 128 ? 1 : 0;
        }
    }

    // --- Step 3: Calculate and Smooth EDM ---
    const rawEdm = calculateEDM(width, height, grid);
    const edm = smoothEDM(width, height, rawEdm);

    // --- Step 4: Find Ultimate Eroded Points (Seeds) ---
    const labels = new Int32Array(width * height).fill(0);
    let currentLabel = 1;
    const queue: number[] = [];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (grid[idx] === 0) continue;

            const d = edm[idx];
            let isMax = true;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (edm[idx + dy * width + dx] > d) {
                        isMax = false;
                        break;
                    }
                }
            }
            if (isMax) {
                let existingLabel = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const neighborIdx = (y + dy) * width + (x + dx);
                        if (labels[neighborIdx] > 0) {
                            existingLabel = labels[neighborIdx];
                            break;
                        }
                    }
                }
                if (existingLabel > 0) {
                    labels[idx] = existingLabel;
                } else {
                    labels[idx] = currentLabel++;
                }
                queue.push(idx);
            }
        }
    }

    // --- Step 5: Watershed Flood (Expand Labels) ---
    const outputGrid = new Uint8Array(grid); // 1=Object, 0=Background
    let head = 0;

    while (head < queue.length) {
        const idx = queue[head++];
        const lbl = labels[idx];
        const x = idx % width;
        const y = Math.floor(idx / width);

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;

                    if (outputGrid[nIdx] === 0) continue;

                    if (labels[nIdx] === 0) {
                        labels[nIdx] = lbl;
                        queue.push(nIdx);
                    } else if (labels[nIdx] !== lbl && labels[nIdx] !== -1) {
                        // Conflict! Different label met.
                        // Turn pixel into Background (0) to create a separation line.
                        outputGrid[nIdx] = 0;
                        labels[nIdx] = -1;
                    }
                }
            }
        }
    }

    // --- Step 6: Generate Output Image ---
    const output = createOutputImage(imageData);
    const dst = output.data;

    // Map colors back: 
    // Object (1 in outputGrid) -> White (if bg black) or Black (if bg white)
    // Background/Line (0 in outputGrid) -> Black (if bg black) or White (if bg white)

    const colorObject = isBackgroundBlack ? 255 : 0;
    const colorBg = isBackgroundBlack ? 0 : 255;

    for (let i = 0; i < width * height; i++) {
        const val = outputGrid[i] === 1 ? colorObject : colorBg;

        const dstIdx = i * 4;
        dst[dstIdx] = val;
        dst[dstIdx + 1] = val;
        dst[dstIdx + 2] = val;
        dst[dstIdx + 3] = src[dstIdx + 3];
    }
    return output;
};

// ============================================
// FILTER FUNCTIONS (Process > Filters submenu)
// ============================================

/**
 * Convolve: Applies spatial convolution using a custom kernel.
 * The kernel must be square with odd dimensions.
 * @param imageData Source image data
 * @param kernel Flat array representing the kernel coefficients (row-major order)
 * @param normalize If true, divide by the sum of coefficients to preserve brightness
 */
export const processConvolve = (
    imageData: ImageData,
    kernel: number[],
    normalize: boolean = true
): ImageData => {
    const size = Math.sqrt(kernel.length);
    if (size !== Math.floor(size) || size % 2 === 0) {
        dispatchNotification('Kernel must be square with odd dimensions', 'error');
        return imageData;
    }

    let divisor = 1;
    if (normalize) {
        const sum = kernel.reduce((a, b) => a + b, 0);
        divisor = sum !== 0 ? sum : 1;
    }

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;
    const halfSize = Math.floor(size / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;

            for (let ky = -halfSize; ky <= halfSize; ky++) {
                for (let kx = -halfSize; kx <= halfSize; kx++) {
                    // Edge handling: duplicate edge pixels
                    const py = Math.min(Math.max(y + ky, 0), height - 1);
                    const px = Math.min(Math.max(x + kx, 0), width - 1);
                    const idx = (py * width + px) * 4;
                    const weight = kernel[(ky + halfSize) * size + (kx + halfSize)];

                    r += src[idx] * weight;
                    g += src[idx + 1] * weight;
                    b += src[idx + 2] * weight;
                }
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = clamp(r / divisor);
            dst[dstIdx + 1] = clamp(g / divisor);
            dst[dstIdx + 2] = clamp(b / divisor);
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

/**
 * Gaussian Blur: Smooths image using convolution with a Gaussian function.
 * @param imageData Source image data
 * @param sigma Standard deviation (radius of decay to exp(-0.5) ~ 61%)
 */
export const processGaussianBlur = (imageData: ImageData, sigma: number): ImageData => {
    if (sigma <= 0) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;

    // Calculate kernel size: 6*sigma is a common rule (3 sigma on each side)
    const kernelRadius = Math.ceil(sigma * 3);
    const kernelSize = kernelRadius * 2 + 1;

    // Generate 1D Gaussian kernel
    const kernel1D: number[] = [];
    let sum = 0;
    for (let i = -kernelRadius; i <= kernelRadius; i++) {
        const val = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel1D.push(val);
        sum += val;
    }
    // Normalize
    for (let i = 0; i < kernel1D.length; i++) {
        kernel1D[i] /= sum;
    }

    // Apply separable Gaussian: horizontal pass then vertical pass
    const temp = new Float32Array(width * height * 4);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let k = -kernelRadius; k <= kernelRadius; k++) {
                const px = Math.min(Math.max(x + k, 0), width - 1);
                const idx = (y * width + px) * 4;
                const weight = kernel1D[k + kernelRadius];
                r += src[idx] * weight;
                g += src[idx + 1] * weight;
                b += src[idx + 2] * weight;
                a += src[idx + 3] * weight;
            }
            const tempIdx = (y * width + x) * 4;
            temp[tempIdx] = r;
            temp[tempIdx + 1] = g;
            temp[tempIdx + 2] = b;
            temp[tempIdx + 3] = a;
        }
    }

    // Vertical pass
    const output = createOutputImage(imageData);
    const dst = output.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let k = -kernelRadius; k <= kernelRadius; k++) {
                const py = Math.min(Math.max(y + k, 0), height - 1);
                const tempIdx = (py * width + x) * 4;
                const weight = kernel1D[k + kernelRadius];
                r += temp[tempIdx] * weight;
                g += temp[tempIdx + 1] * weight;
                b += temp[tempIdx + 2] * weight;
                a += temp[tempIdx + 3] * weight;
            }
            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = clamp(Math.round(r));
            dst[dstIdx + 1] = clamp(Math.round(g));
            dst[dstIdx + 2] = clamp(Math.round(b));
            dst[dstIdx + 3] = clamp(Math.round(a));
        }
    }

    return output;
};

/**
 * Generate a circular mask for a given radius.
 * Used by Median, Mean, Minimum, Maximum, and Variance filters.
 */
const generateCircularMask = (radius: number): { offsets: [number, number][], size: number } => {
    const offsets: [number, number][] = [];
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= r2) {
                offsets.push([dx, dy]);
            }
        }
    }

    return { offsets, size: offsets.length };
};

/**
 * Median Filter: Reduces noise by replacing each pixel with the median of neighboring values.
 * Uses histogram-based approach for O(1) median finding per pixel (much faster than sorting).
 * @param imageData Source image data
 * @param radius Neighborhood radius
 */
export const processMedian = (imageData: ImageData, radius: number): ImageData => {
    if (radius < 1) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    const { offsets, size } = generateCircularMask(radius);
    const medianPos = Math.floor(size / 2);

    // Use histogram-based median for each channel (O(256) = O(1) per pixel)
    const rHist = new Uint32Array(256);
    const gHist = new Uint32Array(256);
    const bHist = new Uint32Array(256);

    // Helper to find median from histogram
    const findMedian = (hist: Uint32Array, targetPos: number): number => {
        let count = 0;
        for (let i = 0; i < 256; i++) {
            count += hist[i];
            if (count > targetPos) return i;
        }
        return 255;
    };

    for (let y = 0; y < height; y++) {
        // Reset histograms for each row
        rHist.fill(0);
        gHist.fill(0);
        bHist.fill(0);

        // Initialize histogram for first pixel in row
        for (const [dx, dy] of offsets) {
            const px = Math.min(Math.max(dx, 0), width - 1);
            const py = Math.min(Math.max(y + dy, 0), height - 1);
            const idx = (py * width + px) * 4;
            rHist[src[idx]]++;
            gHist[src[idx + 1]]++;
            bHist[src[idx + 2]]++;
        }

        // Process first pixel
        const dstIdx0 = y * width * 4;
        dst[dstIdx0] = findMedian(rHist, medianPos);
        dst[dstIdx0 + 1] = findMedian(gHist, medianPos);
        dst[dstIdx0 + 2] = findMedian(bHist, medianPos);
        dst[dstIdx0 + 3] = src[dstIdx0 + 3];

        // Slide window across the row
        for (let x = 1; x < width; x++) {
            // Remove pixels from left edge, add pixels from right edge
            for (const [dx, dy] of offsets) {
                // Remove old pixel (x-1 + dx)
                const oldPx = Math.min(Math.max(x - 1 + dx, 0), width - 1);
                const oldPy = Math.min(Math.max(y + dy, 0), height - 1);
                const oldIdx = (oldPy * width + oldPx) * 4;

                // Add new pixel (x + dx)
                const newPx = Math.min(Math.max(x + dx, 0), width - 1);
                const newPy = Math.min(Math.max(y + dy, 0), height - 1);
                const newIdx = (newPy * width + newPx) * 4;

                // Only update if the pixel positions actually changed
                if (oldPx !== newPx || oldPy !== newPy) {
                    rHist[src[oldIdx]]--;
                    gHist[src[oldIdx + 1]]--;
                    bHist[src[oldIdx + 2]]--;

                    rHist[src[newIdx]]++;
                    gHist[src[newIdx + 1]]++;
                    bHist[src[newIdx + 2]]++;
                }
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = findMedian(rHist, medianPos);
            dst[dstIdx + 1] = findMedian(gHist, medianPos);
            dst[dstIdx + 2] = findMedian(bHist, medianPos);
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

/**
 * Mean Filter: Smooths the image by replacing each pixel with the neighborhood mean.
 * @param imageData Source image data
 * @param radius Neighborhood radius
 */
export const processMean = (imageData: ImageData, radius: number): ImageData => {
    if (radius < 1) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    const { offsets, size } = generateCircularMask(radius);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rSum = 0, gSum = 0, bSum = 0;

            for (const [dx, dy] of offsets) {
                const px = Math.min(Math.max(x + dx, 0), width - 1);
                const py = Math.min(Math.max(y + dy, 0), height - 1);
                const idx = (py * width + px) * 4;
                rSum += src[idx];
                gSum += src[idx + 1];
                bSum += src[idx + 2];
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = clamp(Math.round(rSum / size));
            dst[dstIdx + 1] = clamp(Math.round(gSum / size));
            dst[dstIdx + 2] = clamp(Math.round(bSum / size));
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

/**
 * Minimum Filter (Grayscale Erosion): Replaces each pixel with the smallest value in the neighborhood.
 * @param imageData Source image data
 * @param radius Neighborhood radius
 */
export const processMinimumFilter = (imageData: ImageData, radius: number): ImageData => {
    if (radius < 1) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    const { offsets } = generateCircularMask(radius);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rMin = 255, gMin = 255, bMin = 255;

            for (const [dx, dy] of offsets) {
                const px = Math.min(Math.max(x + dx, 0), width - 1);
                const py = Math.min(Math.max(y + dy, 0), height - 1);
                const idx = (py * width + px) * 4;
                rMin = Math.min(rMin, src[idx]);
                gMin = Math.min(gMin, src[idx + 1]);
                bMin = Math.min(bMin, src[idx + 2]);
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = rMin;
            dst[dstIdx + 1] = gMin;
            dst[dstIdx + 2] = bMin;
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

/**
 * Maximum Filter (Grayscale Dilation): Replaces each pixel with the largest value in the neighborhood.
 * @param imageData Source image data
 * @param radius Neighborhood radius
 */
export const processMaximumFilter = (imageData: ImageData, radius: number): ImageData => {
    if (radius < 1) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    const { offsets } = generateCircularMask(radius);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rMax = 0, gMax = 0, bMax = 0;

            for (const [dx, dy] of offsets) {
                const px = Math.min(Math.max(x + dx, 0), width - 1);
                const py = Math.min(Math.max(y + dy, 0), height - 1);
                const idx = (py * width + px) * 4;
                rMax = Math.max(rMax, src[idx]);
                gMax = Math.max(gMax, src[idx + 1]);
                bMax = Math.max(bMax, src[idx + 2]);
            }

            const dstIdx = (y * width + x) * 4;
            dst[dstIdx] = rMax;
            dst[dstIdx + 1] = gMax;
            dst[dstIdx + 2] = bMax;
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

/**
 * Unsharp Mask: Sharpens image by subtracting a blurred version and rescaling.
 * @param imageData Source image data
 * @param sigma Standard deviation (blur radius) of the Gaussian blur to subtract
 * @param maskWeight Strength of filtering (0 to 0.9, where 0.9 is very strong)
 */
export const processUnsharpMask = (
    imageData: ImageData,
    sigma: number,
    maskWeight: number
): ImageData => {
    if (sigma <= 0 || maskWeight <= 0) return imageData;

    // Clamp mask weight to valid range
    const weight = Math.min(0.9, Math.max(0, maskWeight));

    // Get blurred version
    const blurred = processGaussianBlur(imageData, sigma);

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const blurData = blurred.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    // Unsharp mask formula: output = (original + weight * (original - blurred)) / (1 + weight)
    // This can be simplified to: output = original + weight * (original - blurred)
    // when we want to preserve the contrast of large structures

    for (let i = 0; i < src.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const original = src[i + c];
            const blur = blurData[i + c];
            const diff = original - blur;
            // Apply unsharp mask: add weighted high-pass filtered version
            const val = original + (weight / (1 - weight)) * diff;
            dst[i + c] = clamp(Math.round(val));
        }
        dst[i + 3] = src[i + 3]; // Preserve alpha
    }

    return output;
};

/**
 * Variance Filter: Highlights edges by replacing each pixel with the neighborhood variance.
 * Two-pass approach: first calculates all variances, then normalizes to 0-255 range.
 * @param imageData Source image data
 * @param radius Neighborhood radius
 */
export const processVariance = (imageData: ImageData, radius: number): ImageData => {
    if (radius < 1) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createOutputImage(imageData);
    const dst = output.data;

    const { offsets, size } = generateCircularMask(radius);

    // First pass: calculate all variance values and find max for normalization
    const variances = new Float32Array(width * height * 3);
    let maxVar = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate mean first using running sum (more efficient)
            let rSum = 0, gSum = 0, bSum = 0;
            let rSumSq = 0, gSumSq = 0, bSumSq = 0;

            for (const [dx, dy] of offsets) {
                const px = Math.min(Math.max(x + dx, 0), width - 1);
                const py = Math.min(Math.max(y + dy, 0), height - 1);
                const idx = (py * width + px) * 4;
                const r = src[idx];
                const g = src[idx + 1];
                const b = src[idx + 2];
                rSum += r;
                gSum += g;
                bSum += b;
                rSumSq += r * r;
                gSumSq += g * g;
                bSumSq += b * b;
            }

            // Variance = E[X²] - E[X]² (more efficient formula)
            const rVar = (rSumSq / size) - (rSum / size) ** 2;
            const gVar = (gSumSq / size) - (gSum / size) ** 2;
            const bVar = (bSumSq / size) - (bSum / size) ** 2;

            const varIdx = (y * width + x) * 3;
            variances[varIdx] = Math.max(0, rVar); // Clamp to avoid tiny negative due to floating point
            variances[varIdx + 1] = Math.max(0, gVar);
            variances[varIdx + 2] = Math.max(0, bVar);

            maxVar = Math.max(maxVar, rVar, gVar, bVar);
        }
    }

    // Second pass: normalize and output
    // Use sqrt for better visualization (standard deviation), then scale to 0-255
    const maxStd = Math.sqrt(maxVar);
    const scale = maxStd > 0 ? 255 / maxStd : 1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const varIdx = (y * width + x) * 3;
            const dstIdx = (y * width + x) * 4;

            // Output standard deviation scaled to 0-255
            dst[dstIdx] = clamp(Math.round(Math.sqrt(variances[varIdx]) * scale));
            dst[dstIdx + 1] = clamp(Math.round(Math.sqrt(variances[varIdx + 1]) * scale));
            dst[dstIdx + 2] = clamp(Math.round(Math.sqrt(variances[varIdx + 2]) * scale));
            dst[dstIdx + 3] = src[dstIdx + 3];
        }
    }

    return output;
};

/**
 * Generate circular masks stack for visualization.
 * Creates ImageData objects showing the circular masks used for various radii.
 * Returns an array of { radius, imageData } objects.
 */
export const generateCircularMasksStack = (): { radius: number; imageData: ImageData }[] => {
    const masks: { radius: number; imageData: ImageData }[] = [];
    const radii = [1, 2, 3, 4, 5, 10, 15, 20];

    for (const radius of radii) {
        const size = radius * 2 + 1;
        const imageData = new ImageData(size, size);
        const data = imageData.data;

        const { offsets } = generateCircularMask(radius);
        const offsetSet = new Set(offsets.map(([dx, dy]) => `${dx + radius},${dy + radius}`));

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const isInMask = offsetSet.has(`${x},${y}`);

                if (isInMask) {
                    // White pixel for mask
                    data[idx] = 255;
                    data[idx + 1] = 255;
                    data[idx + 2] = 255;
                } else {
                    // Black pixel for background
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                }
                data[idx + 3] = 255; // Full opacity
            }
        }

        masks.push({ radius, imageData });
    }

    return masks;
};

/**
 * Generate a composite image showing all circular masks with labels.
 * Creates a single image with all masks arranged in a grid with radius labels.
 * Returns a data URL that can be displayed.
 */
export const generateCircularMasksComposite = (): { dataUrl: string; width: number; height: number } => {
    const radii = [1, 2, 3, 4, 5, 10, 15, 20];
    const padding = 20;
    const labelHeight = 25;
    const cellPadding = 10;
    
    // Calculate dimensions for each mask cell
    const maskSizes = radii.map(r => r * 2 + 1);
    const maxMaskSize = Math.max(...maskSizes);
    
    // Arrange in 2 rows of 4
    const cols = 4;
    const rows = 2;
    const cellWidth = maxMaskSize + cellPadding * 2;
    const cellHeight = maxMaskSize + labelHeight + cellPadding * 2;
    
    const canvasWidth = cols * cellWidth + padding * 2;
    const canvasHeight = rows * cellHeight + padding * 2;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    
    // Fill background with dark gray
    ctx.fillStyle = '#1a1f28';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw each mask
    radii.forEach((radius, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const cellX = padding + col * cellWidth;
        const cellY = padding + row * cellHeight;
        
        const maskSize = radius * 2 + 1;
        const { offsets } = generateCircularMask(radius);
        const offsetSet = new Set(offsets.map(([dx, dy]) => `${dx + radius},${dy + radius}`));
        
        // Center the mask in the cell
        const maskX = cellX + cellPadding + (maxMaskSize - maskSize) / 2;
        const maskY = cellY + cellPadding + (maxMaskSize - maskSize) / 2;
        
        // Draw mask background (dark)
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(maskX - 2, maskY - 2, maskSize + 4, maskSize + 4);
        
        // Draw each pixel of the mask (scaled up for visibility)
        const pixelSize = Math.max(1, Math.floor(40 / maskSize)); // Scale small masks
        const scaledSize = maskSize * pixelSize;
        const scaledMaskX = cellX + cellPadding + (maxMaskSize * pixelSize - scaledSize) / 2 / pixelSize + (maxMaskSize - scaledSize / pixelSize) / 2;
        const scaledMaskY = cellY + cellPadding + (maxMaskSize - maskSize) / 2;
        
        for (let y = 0; y < maskSize; y++) {
            for (let x = 0; x < maskSize; x++) {
                const isInMask = offsetSet.has(`${x},${y}`);
                ctx.fillStyle = isInMask ? '#ffffff' : '#000000';
                ctx.fillRect(
                    maskX + x,
                    maskY + y,
                    1,
                    1
                );
            }
        }
        
        // Draw border around mask
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1;
        ctx.strokeRect(maskX - 1, maskY - 1, maskSize + 2, maskSize + 2);
        
        // Draw label
        ctx.fillStyle = '#e8ecf1';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        const labelX = cellX + cellWidth / 2;
        const labelY = cellY + cellPadding + maxMaskSize + labelHeight - 5;
        ctx.fillText(`r=${radius} (${maskSize}×${maskSize})`, labelX, labelY);
        
        // Draw pixel count
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText(`${offsets.length} pixels`, labelX, labelY + 12);
    });
    
    // Add title
    ctx.fillStyle = '#e8ecf1';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Circular Masks for Rank Filters', padding, 15);
    
    return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvasWidth,
        height: canvasHeight
    };
};

/**
 * Parse kernel text input into a flat array of numbers.
 * Validates that the kernel is square with odd dimensions.
 */
export const parseKernelText = (text: string): { kernel: number[]; size: number } | null => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return null;

    const rows: number[][] = [];
    for (const line of lines) {
        const values = line.trim().split(/\s+/).map(v => parseFloat(v));
        if (values.some(isNaN)) return null;
        rows.push(values);
    }

    // Check all rows have same length
    const width = rows[0].length;
    if (rows.some(row => row.length !== width)) return null;

    // Check it's square
    if (rows.length !== width) return null;

    // Check it's odd
    if (width % 2 === 0) return null;

    // Flatten to 1D array
    const kernel = rows.flat();
    return { kernel, size: width };
};