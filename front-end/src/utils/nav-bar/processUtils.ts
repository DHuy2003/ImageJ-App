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
    return applyRankFilter(imageData, 'max');
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
    return applyRankFilter(imageData, 'min');
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