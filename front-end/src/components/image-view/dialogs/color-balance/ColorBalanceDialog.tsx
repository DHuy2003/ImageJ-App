import React, { useEffect, useRef, useState } from 'react';
import './ColorBalanceDialog.css';

export type ColorChannel = 'Red' | 'Green' | 'Blue' | 'Cyan' | 'Magenta' | 'Yellow' | 'All';

interface ColorBalanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: () => void;
    onChange: (min: number, max: number, channel: ColorChannel) => void;
    onReset: () => void;
    onAuto: () => void;
    currentMin: number;
    currentMax: number;
    histogram: number[];
    selectedChannel: ColorChannel;
    onChannelChange: (channel: ColorChannel) => void;
}

const COLOR_CHANNELS: ColorChannel[] = ['Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow', 'All'];

const ColorBalanceDialog: React.FC<ColorBalanceDialogProps> = ({
    isOpen,
    onClose,
    onApply,
    onChange,
    onReset,
    onAuto,
    currentMin,
    currentMax,
    histogram,
    selectedChannel,
    onChannelChange,
}) => {
    // --- STATE ---
    const [brightness, setBrightness] = useState(128);
    const [sliderBounds, setSliderBounds] = useState({ min: 0, max: 255 });

    // State for Draggable logic
    const [position, setPosition] = useState({ x: 150, y: 150 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // State for 'Set' dialog
    const [isSetOpen, setIsSetOpen] = useState(false);
    const [setTempMin, setSetTempMin] = useState(0);
    const [setTempMax, setSetTempMax] = useState(255);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Get color for histogram based on selected channel
    const getHistogramColor = (): string => {
        switch (selectedChannel) {
            case 'Red': return '#e74c3c';
            case 'Green': return '#2ecc71';
            case 'Blue': return '#3498db';
            case 'Cyan': return '#00bcd4';
            case 'Magenta': return '#e91e63';
            case 'Yellow': return '#ffc107';
            case 'All': return '#888';
            default: return '#888';
        }
    };

    // Draw histogram
    useEffect(() => {
        if (!isOpen || !canvasRef.current || !histogram || histogram.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear and draw white background
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);

        // Calculate max count (smart scaling - skip 0 and 255)
        let maxCount = 0;
        for (let i = 1; i < 255; i++) {
            if (histogram[i] > maxCount) maxCount = histogram[i];
        }

        // Fallback for binary images
        if (maxCount === 0) {
            for (let i = 0; i < 256; i++) {
                if (histogram[i] > maxCount) maxCount = histogram[i];
            }
        }
        if (maxCount === 0) maxCount = 1;

        // Draw histogram bars
        ctx.fillStyle = getHistogramColor();
        const binWidth = width / 256;

        for (let i = 0; i < 256; i++) {
            const count = histogram[i];
            let barHeight = (count / maxCount) * height;
            if (barHeight > height) barHeight = height;

            const x = i * binWidth;
            const y = height - barHeight;
            ctx.fillRect(x, y, Math.ceil(binWidth), barHeight);
        }

        // Draw mapping line
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();

        const getCanvasY = (inputVal: number) => {
            let outputVal = (inputVal - currentMin) / (currentMax - currentMin) * 255;
            if (outputVal < 0) outputVal = 0;
            if (outputVal > 255) outputVal = 255;
            return height - (outputVal / 255 * height);
        };

        ctx.moveTo(0, getCanvasY(0));
        if (currentMin > 0 && currentMin < 255) ctx.lineTo((currentMin / 255) * width, height);
        if (currentMax > 0 && currentMax < 255) ctx.lineTo((currentMax / 255) * width, 0);
        ctx.lineTo(width, getCanvasY(255));
        ctx.stroke();

    }, [histogram, currentMin, currentMax, isOpen, selectedChannel]);

    // --- DRAGGING LOGIC ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isSetOpen) return;
        isDragging.current = true;
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            setPosition({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };
        const handleMouseUp = () => { isDragging.current = false; };

        if (isOpen) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isOpen]);

    // --- BOUNDS LOGIC ---
    useEffect(() => {
        if (!isOpen) return;
        setSliderBounds(prev => ({
            min: Math.min(prev.min, Math.floor(currentMin)),
            max: Math.max(prev.max, Math.ceil(currentMax))
        }));
    }, [currentMin, currentMax, isOpen]);

    const handleReset = () => {
        setSliderBounds({ min: 0, max: 255 });
        onReset();
    };

    // Reset bounds when dialog opens
    useEffect(() => {
        if (isOpen) {
            setSliderBounds({ min: 0, max: 255 });
        }
    }, [isOpen]);

    // --- BRIGHTNESS FORMULA (Like ImageJ B&C) ---
    // Sync Min/Max -> Brightness
    useEffect(() => {
        if (!isOpen) return;
        const center = (currentMax + currentMin) / 2;
        let newBrightness = 128 + (128 - center);
        newBrightness = Math.max(0, Math.min(255, newBrightness));
        setBrightness(Math.round(newBrightness));
    }, [currentMin, currentMax, isOpen]);

    // Sync Brightness -> Min/Max (keeping width constant)
    const updateFromBrightness = (newB: number) => {
        setBrightness(newB);
        const width = currentMax - currentMin;
        const center = 128 + (128 - newB);
        const newMin = center - (width / 2);
        const newMax = center + (width / 2);

        setSliderBounds(prev => ({
            min: Math.min(prev.min, Math.floor(newMin)),
            max: Math.max(prev.max, Math.ceil(newMax))
        }));
        onChange(newMin, newMax, selectedChannel);
    };

    // --- SET FUNCTION LOGIC ---
    const handleOpenSet = () => {
        setSetTempMin(Math.round(currentMin));
        setSetTempMax(Math.round(currentMax));
        setIsSetOpen(true);
    };

    const handleConfirmSet = () => {
        setSliderBounds({
            min: setTempMin,
            max: setTempMax
        });
        onChange(setTempMin, setTempMax, selectedChannel);
        setIsSetOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div
            className="cb-dialog"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <div className="cb-header" onMouseDown={handleMouseDown}>
                <span>Color Balance</span>
                <button className="cb-close" onClick={onClose}>x</button>
            </div>

            <div className="cb-histogram">
                <canvas
                    ref={canvasRef}
                    width={256}
                    height={50}
                    style={{ width: '100%', height: '100%', display: 'block' }}
                />
            </div>

            <div className="cb-range-labels">
                <span>{Math.round(currentMin)}</span>
                <span>{Math.round(currentMax)}</span>
            </div>

            {/* --- SET MODAL OVERLAY --- */}
            {isSetOpen && (
                <div className="cb-set-overlay">
                    <div className="cb-set-box">
                        <div className="cb-set-title">Set Display Range</div>
                        <div className="cb-set-row">
                            <label>Minimum:</label>
                            <input
                                type="number"
                                value={setTempMin}
                                onChange={(e) => setSetTempMin(Number(e.target.value))}
                            />
                        </div>
                        <div className="cb-set-row">
                            <label>Maximum:</label>
                            <input
                                type="number"
                                value={setTempMax}
                                onChange={(e) => setSetTempMax(Number(e.target.value))}
                            />
                        </div>
                        <div className="cb-set-actions">
                            <button onClick={handleConfirmSet}>OK</button>
                            <button onClick={() => setIsSetOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="cb-sliders">
                <div className="cb-slider-row">
                    <label>Minimum</label>
                    <input
                        type="range"
                        min={sliderBounds.min}
                        max={Math.max(255, sliderBounds.max)}
                        step="1"
                        value={currentMin}
                        onChange={(e) => onChange(Number(e.target.value), currentMax, selectedChannel)}
                    />
                    <input
                        type="number"
                        className="cb-number-input"
                        value={Math.round(currentMin)}
                        onChange={(e) => onChange(Number(e.target.value), currentMax, selectedChannel)}
                    />
                </div>

                <div className="cb-slider-row">
                    <label>Maximum</label>
                    <input
                        type="range"
                        min={Math.min(0, sliderBounds.min)}
                        max={sliderBounds.max}
                        step="1"
                        value={currentMax}
                        onChange={(e) => onChange(currentMin, Number(e.target.value), selectedChannel)}
                    />
                    <input
                        type="number"
                        className="cb-number-input"
                        value={Math.round(currentMax)}
                        onChange={(e) => onChange(currentMin, Number(e.target.value), selectedChannel)}
                    />
                </div>

                <div className="divider-h"></div>

                <div className="cb-slider-row">
                    <label>Brightness</label>
                    <input
                        type="range"
                        min="0"
                        max="255"
                        step="1"
                        value={brightness}
                        onChange={(e) => updateFromBrightness(Number(e.target.value))}
                    />
                    <input
                        type="number"
                        className="cb-number-input"
                        value={brightness}
                        onChange={(e) => updateFromBrightness(Number(e.target.value))}
                    />
                </div>

                <div className="cb-slider-row">
                    <label>Color</label>
                    <select
                        className="cb-color-select"
                        value={selectedChannel}
                        onChange={(e) => onChannelChange(e.target.value as ColorChannel)}
                    >
                        {COLOR_CHANNELS.map(channel => (
                            <option key={channel} value={channel}>{channel}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="cb-buttons">
                <button onClick={onAuto}>Auto</button>
                <button onClick={handleReset}>Reset</button>
                <button onClick={handleOpenSet}>Set</button>
                <button onClick={onApply}>Apply</button>
            </div>
        </div>
    );
};

export default ColorBalanceDialog;

