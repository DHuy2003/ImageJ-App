import { useCallback, useEffect, useRef, useState } from 'react';
import './FiltersDialog.css';

// Filter types
export type FilterType =
    | 'convolve'
    | 'gaussian-blur'
    | 'median'
    | 'mean'
    | 'minimum'
    | 'maximum'
    | 'unsharp-mask'
    | 'variance'
    | 'circular-masks';

// Filter dialog titles
const FILTER_TITLES: Record<FilterType, string> = {
    'convolve': 'Convolve...',
    'gaussian-blur': 'Gaussian Blur...',
    'median': 'Median...',
    'mean': 'Mean...',
    'minimum': 'Minimum...',
    'maximum': 'Maximum...',
    'unsharp-mask': 'Unsharp Mask...',
    'variance': 'Variance...',
    'circular-masks': 'Circular Masks',
};

// Default kernels for Convolve
const DEFAULT_KERNELS: Record<string, { name: string; kernel: string }> = {
    'mexican-hat': {
        name: 'Mexican Hat (9x9)',
        kernel: `0 0 0 -1 -1 -1 0 0 0
0 0 -2 -3 -3 -3 -2 0 0
0 -2 -2 -1 -1 -1 -2 -2 0
-1 -3 -1 12 24 12 -1 -3 -1
-1 -3 -1 24 40 24 -1 -3 -1
-1 -3 -1 12 24 12 -1 -3 -1
0 -2 -2 -1 -1 -1 -2 -2 0
0 0 -2 -3 -3 -3 -2 0 0
0 0 0 -1 -1 -1 0 0 0`,
    },
    'blur-3x3': {
        name: 'Blur (3x3)',
        kernel: `1 1 1
1 1 1
1 1 1`,
    },
    'sharpen-3x3': {
        name: 'Sharpen (3x3)',
        kernel: `-1 -1 -1
-1 9 -1
-1 -1 -1`,
    },
    'edge-detect': {
        name: 'Edge Detect (3x3)',
        kernel: `-1 -1 -1
-1 8 -1
-1 -1 -1`,
    },
    'emboss': {
        name: 'Emboss (3x3)',
        kernel: `-2 -1 0
-1 1 1
0 1 2`,
    },
    'laplacian': {
        name: 'Laplacian (3x3)',
        kernel: `0 -1 0
-1 4 -1
0 -1 0`,
    },
};

interface FiltersDialogProps {
    isOpen: boolean;
    filterType: FilterType | null;
    onClose: () => void;
    onApply: (filterType: FilterType, params: FilterParams) => void;
    onPreview: (filterType: FilterType, params: FilterParams) => void;
    onReset: () => void;
}

export interface FilterParams {
    // Convolve
    kernel?: number[];
    kernelSize?: number;
    normalize?: boolean;
    // Gaussian Blur
    sigma?: number;
    // Median, Mean, Minimum, Maximum, Variance
    radius?: number;
    // Unsharp Mask
    maskWeight?: number;
}

const FiltersDialog = ({
    isOpen,
    filterType,
    onClose,
    onApply,
    onPreview,
    onReset,
}: FiltersDialogProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({ x: -1, y: -1 });

    // Convolve state
    const [kernelText, setKernelText] = useState(DEFAULT_KERNELS['mexican-hat'].kernel);
    const [selectedPreset, setSelectedPreset] = useState('mexican-hat');
    const [normalizeKernel, setNormalizeKernel] = useState(true);

    // Gaussian Blur state
    const [sigma, setSigma] = useState(2.0);

    // Radius-based filters state
    const [radius, setRadius] = useState(2);

    // Unsharp Mask state
    const [unsharpSigma, setUnsharpSigma] = useState(1.0);
    const [maskWeight, setMaskWeight] = useState(0.6);

    // Preview state
    const [previewEnabled, setPreviewEnabled] = useState(false);

    // Reset state when filter type changes
    useEffect(() => {
        if (filterType === 'convolve') {
            setKernelText(DEFAULT_KERNELS['mexican-hat'].kernel);
            setSelectedPreset('mexican-hat');
            setNormalizeKernel(true);
        } else if (filterType === 'gaussian-blur') {
            setSigma(2.0);
        } else if (filterType === 'unsharp-mask') {
            setUnsharpSigma(1.0);
            setMaskWeight(0.6);
        } else {
            setRadius(2);
        }
        setPreviewEnabled(false);
    }, [filterType]);

    // Center dialog on open
    useEffect(() => {
        if (isOpen && position.x === -1) {
            const centerX = (window.innerWidth - 400) / 2;
            const centerY = (window.innerHeight - 350) / 2;
            setPosition({ x: centerX, y: centerY });
        }
    }, [isOpen, position.x]);

    // Preview effect
    useEffect(() => {
        if (!previewEnabled || !filterType) return;

        const params = getFilterParams();
        if (params) {
            onPreview(filterType, params);
        }
    }, [previewEnabled, kernelText, normalizeKernel, sigma, radius, unsharpSigma, maskWeight]);

    // Get current filter parameters
    const getFilterParams = useCallback((): FilterParams | null => {
        if (!filterType) return null;

        switch (filterType) {
            case 'convolve': {
                const lines = kernelText.trim().split('\n').filter(l => l.trim());
                const kernel: number[] = [];
                for (const line of lines) {
                    const values = line.trim().split(/\s+/).map(v => parseFloat(v));
                    if (values.some(isNaN)) return null;
                    kernel.push(...values);
                }
                const size = Math.sqrt(kernel.length);
                if (size !== Math.floor(size) || size % 2 === 0) return null;
                return { kernel, kernelSize: size, normalize: normalizeKernel };
            }
            case 'gaussian-blur':
                return { sigma };
            case 'median':
            case 'mean':
            case 'minimum':
            case 'maximum':
            case 'variance':
                return { radius };
            case 'unsharp-mask':
                return { sigma: unsharpSigma, maskWeight };
            default:
                return {};
        }
    }, [filterType, kernelText, normalizeKernel, sigma, radius, unsharpSigma, maskWeight]);

    // Handle Apply
    const handleApply = () => {
        if (!filterType) return;
        const params = getFilterParams();
        if (params) {
            onApply(filterType, params);
            onClose();
        }
    };

    // Handle OK (same as Apply but also closes)
    const handleOK = () => {
        handleApply();
    };

    // Handle Cancel
    const handleCancel = () => {
        if (previewEnabled) {
            onReset();
        }
        onClose();
    };

    // Handle preset change
    const handlePresetChange = (preset: string) => {
        setSelectedPreset(preset);
        if (DEFAULT_KERNELS[preset]) {
            setKernelText(DEFAULT_KERNELS[preset].kernel);
        }
    };

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.filter-dialog-header')) {
            setIsDragging(true);
            const rect = dialogRef.current?.getBoundingClientRect();
            if (rect) {
                setDragOffset({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                });
            }
        }
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y,
                });
            }
        },
        [isDragging, dragOffset]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!isOpen || !filterType) return null;

    // Render Convolve dialog content
    const renderConvolveContent = () => (
        <>
            <div className="filter-field">
                <label>Preset:</label>
                <select
                    value={selectedPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="filter-select"
                >
                    {Object.entries(DEFAULT_KERNELS).map(([key, { name }]) => (
                        <option key={key} value={key}>
                            {name}
                        </option>
                    ))}
                    <option value="custom">Custom</option>
                </select>
            </div>
            <div className="filter-field kernel-field">
                <label>Kernel:</label>
                <textarea
                    value={kernelText}
                    onChange={(e) => {
                        setKernelText(e.target.value);
                        setSelectedPreset('custom');
                    }}
                    className="filter-textarea"
                    rows={9}
                    spellCheck={false}
                    placeholder="Enter kernel values separated by spaces, one row per line"
                />
            </div>
            <div className="filter-checkbox-row">
                <label className="filter-checkbox-label">
                    <input
                        type="checkbox"
                        checked={normalizeKernel}
                        onChange={(e) => setNormalizeKernel(e.target.checked)}
                    />
                    Normalize Kernel
                </label>
            </div>
            <p className="filter-hint">
                Kernel must be square with odd dimensions (3x3, 5x5, 7x7, etc.)
            </p>
        </>
    );

    // Render Gaussian Blur dialog content
    const renderGaussianBlurContent = () => (
        <>
            <div className="filter-field">
                <label>Sigma (Radius):</label>
                <div className="filter-input-row">
                    <input
                        type="range"
                        min={0.1}
                        max={20}
                        step={0.1}
                        value={sigma}
                        onChange={(e) => setSigma(parseFloat(e.target.value))}
                        className="filter-slider"
                    />
                    <input
                        type="number"
                        value={sigma}
                        min={0.1}
                        max={100}
                        step={0.1}
                        onChange={(e) => setSigma(parseFloat(e.target.value) || 0.1)}
                        className="filter-number-input"
                    />
                </div>
            </div>
            <p className="filter-hint">
                Sigma is the standard deviation of the Gaussian function.
                Larger values produce more blur.
            </p>
        </>
    );

    // Render radius-based filter content (Median, Mean, Minimum, Maximum, Variance)
    const renderRadiusContent = () => (
        <>
            <div className="filter-field">
                <label>Radius:</label>
                <div className="filter-input-row">
                    <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        className="filter-slider"
                    />
                    <input
                        type="number"
                        value={radius}
                        min={1}
                        max={100}
                        step={1}
                        onChange={(e) => setRadius(parseInt(e.target.value) || 1)}
                        className="filter-number-input"
                    />
                </div>
            </div>
            <p className="filter-hint">
                Larger radius values produce stronger effects but take longer to process.
            </p>
        </>
    );

    // Render Unsharp Mask dialog content
    const renderUnsharpMaskContent = () => (
        <>
            <div className="filter-field">
                <label>Radius (Sigma):</label>
                <div className="filter-input-row">
                    <input
                        type="range"
                        min={0.1}
                        max={20}
                        step={0.1}
                        value={unsharpSigma}
                        onChange={(e) => setUnsharpSigma(parseFloat(e.target.value))}
                        className="filter-slider"
                    />
                    <input
                        type="number"
                        value={unsharpSigma}
                        min={0.1}
                        max={100}
                        step={0.1}
                        onChange={(e) => setUnsharpSigma(parseFloat(e.target.value) || 0.1)}
                        className="filter-number-input"
                    />
                </div>
            </div>
            <div className="filter-field">
                <label>Mask Weight:</label>
                <div className="filter-input-row">
                    <input
                        type="range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={maskWeight}
                        onChange={(e) => setMaskWeight(parseFloat(e.target.value))}
                        className="filter-slider"
                    />
                    <input
                        type="number"
                        value={maskWeight}
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        onChange={(e) => setMaskWeight(parseFloat(e.target.value) || 0.1)}
                        className="filter-number-input"
                    />
                </div>
            </div>
            <p className="filter-hint">
                Radius is the blur amount to subtract. Mask Weight determines sharpening strength.
            </p>
        </>
    );

    // Render content based on filter type
    const renderContent = () => {
        switch (filterType) {
            case 'convolve':
                return renderConvolveContent();
            case 'gaussian-blur':
                return renderGaussianBlurContent();
            case 'median':
            case 'mean':
            case 'minimum':
            case 'maximum':
            case 'variance':
                return renderRadiusContent();
            case 'unsharp-mask':
                return renderUnsharpMaskContent();
            case 'circular-masks':
                return (
                    <p className="filter-hint">
                        Click OK to generate a stack showing the circular masks used by
                        Median, Mean, Minimum, Maximum, and Variance filters for various radii.
                    </p>
                );
            default:
                return null;
        }
    };

    return (
        <div className="filter-dialog-overlay">
            <div
                ref={dialogRef}
                className="filter-dialog"
                style={{
                    left: position.x >= 0 ? position.x : undefined,
                    top: position.y >= 0 ? position.y : undefined,
                }}
                onMouseDown={handleMouseDown}
            >
                <div className="filter-dialog-header">
                    <span className="filter-dialog-title">
                        {filterType ? FILTER_TITLES[filterType] : 'Filter'}
                    </span>
                    <button className="filter-close-btn" onClick={handleCancel}>
                        ×
                    </button>
                </div>

                <div className="filter-dialog-content">
                    {renderContent()}

                    {filterType !== 'circular-masks' && (
                        <div className="filter-checkbox-row preview-checkbox">
                            <label className="filter-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={previewEnabled}
                                    onChange={(e) => {
                                        setPreviewEnabled(e.target.checked);
                                        if (!e.target.checked) {
                                            onReset();
                                        }
                                    }}
                                />
                                Preview
                            </label>
                        </div>
                    )}

                    <div className="filter-buttons">
                        <button className="filter-btn" onClick={handleOK}>
                            OK
                        </button>
                        <button className="filter-btn" onClick={handleCancel}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FiltersDialog;

