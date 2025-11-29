import React, { useEffect, useRef, useState } from 'react';
import './BrightContrast.css';


interface BCDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: () => void;
    onChange: (min: number, max: number) => void;
    onReset: () => void;
    onAuto: () => void;
    currentMin: number;
    currentMax: number;
    histogram: number[];
}

const BrightnessContrastDialog: React.FC<BCDialogProps> = ({
    isOpen, onClose, onApply, onChange, onReset, onAuto, currentMin, currentMax, histogram
}) => {
    // --- STATE ---
    const [brightness, setBrightness] = useState(128);
    const [contrast, setContrast] = useState(128);
    const [sliderBounds, setSliderBounds] = useState({ min: 0, max: 255 });

    // State for Draggable logic
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // --- NEW: STATE FOR 'SET' DIALOG ---
    const [isSetOpen, setIsSetOpen] = useState(false);
    const [setTempMin, setSetTempMin] = useState(0);
    const [setTempMax, setSetTempMax] = useState(255);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isOpen || !canvasRef.current || !histogram || histogram.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // 1. Xóa và vẽ nền trắng
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);

        // 2. Tính toán Max Count thông minh (Smart Scaling)
        // ImageJ thường bỏ qua bin 0 và 255 khi tính chiều cao để tránh việc 
        // background (đen/trắng) làm bẹt dí các cột khác.
        let maxCount = 0;
        
        // Chỉ quét từ 1 đến 254 để tìm đỉnh
        for (let i = 1; i < 255; i++) {
            if (histogram[i] > maxCount) maxCount = histogram[i];
        }

        // Fallback: Nếu ảnh chỉ có đen trắng (Binary) thì maxCount ở giữa sẽ là 0,
        // lúc này mới bắt buộc phải lấy max của toàn bộ 0-255.
        if (maxCount === 0) {
            for (let i = 0; i < 256; i++) {
                if (histogram[i] > maxCount) maxCount = histogram[i];
            }
        }
        
        // Tránh chia cho 0
        if (maxCount === 0) maxCount = 1; 

        // 3. Vẽ Histogram
        ctx.fillStyle = "#888"; // Màu xám
        // Vẽ thêm stroke nhẹ để rõ hơn nếu muốn
        // ctx.strokeStyle = "#888"; 

        const binWidth = width / 256;

        for (let i = 0; i < 256; i++) {
            const count = histogram[i];
            // Tính chiều cao dựa trên maxCount đã lọc
            // Math.min(height, ...) để kẹp các cột 0/255 nếu nó vượt quá khung
            let barHeight = (count / maxCount) * height;
            
            // Nếu cột 0 hoặc 255 quá cao so với maxCount (do ta bỏ qua nó lúc tìm max), 
            // ta cắt bớt nó bằng chiều cao canvas để không vẽ tràn
            if (barHeight > height) barHeight = height;

            const x = i * binWidth;
            const y = height - barHeight;

            // Math.ceil(binWidth) để tránh khe hở trắng giữa các cột trên màn hình độ phân giải cao
            ctx.fillRect(x, y, Math.ceil(binWidth), barHeight);
        }

        // 4. Vẽ đường Mapping (Line màu đen)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();

        const getCanvasY = (inputVal: number) => {
            let outputVal = (inputVal - currentMin) / (currentMax - currentMin) * 255;
            if (outputVal < 0) outputVal = 0;
            if (outputVal > 255) outputVal = 255;
            return height - (outputVal / 255 * height);
        };

        // Vẽ đường line
        ctx.moveTo(0, getCanvasY(0));
        
        // Tối ưu điểm vẽ
        if (currentMin > 0 && currentMin < 255) ctx.lineTo((currentMin / 255) * width, height); 
        if (currentMax > 0 && currentMax < 255) ctx.lineTo((currentMax / 255) * width, 0);

        ctx.lineTo(width, getCanvasY(255));
        ctx.stroke();

    }, [histogram, currentMin, currentMax, isOpen]);
    
    // --- DRAGGING LOGIC ---
    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent dragging if clicking inside the Set Dialog
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

    // --- FIJI FORMULAS ---
    const calculateWidthFromContrast = (c: number) => {
        const factor = (128 - c) / 100;
        return 255 * Math.pow(10, factor);
    };

    const calculateContrastFromWidth = (w: number) => {
        if (w <= 0) return 255;
        const factor = Math.log10(w / 255);
        const c = 128 - (factor * 100);
        return Math.max(0, Math.min(255, c));
    };

    // Sync Min/Max -> B/C
    useEffect(() => {
        if (!isOpen) return;
        const width = currentMax - currentMin;
        const center = (currentMax + currentMin) / 2;
        const newContrast = calculateContrastFromWidth(width);
        let newBrightness = 128 + (128 - center);
        newBrightness = Math.max(0, Math.min(255, newBrightness));
        setBrightness(Math.round(newBrightness));
        setContrast(Math.round(newContrast));
    }, [currentMin, currentMax, isOpen]);

    // Sync B/C -> Min/Max
    const updateFromBC = (newB: number, newC: number) => {
        setBrightness(newB);
        setContrast(newC);
        const width = calculateWidthFromContrast(newC);
        const center = 128 + (128 - newB);
        const newMin = center - (width / 2);
        const newMax = center + (width / 2);

        setSliderBounds(prev => ({
            min: Math.min(prev.min, Math.floor(newMin)),
            max: Math.max(prev.max, Math.ceil(newMax))
        }));
        onChange(newMin, newMax);
    };

    // --- NEW: SET FUNCTION LOGIC ---
    const handleOpenSet = () => {
        setSetTempMin(Math.round(currentMin));
        setSetTempMax(Math.round(currentMax));
        setIsSetOpen(true);
    };

    const handleConfirmSet = () => {
        // Update slider bounds if user typed numbers outside current range
        setSliderBounds(prev => ({
            min: Math.min(prev.min, Math.floor(setTempMin)),
            max: Math.max(prev.max, Math.ceil(setTempMax))
        }));

        // Update the actual image
        onChange(setTempMin, setTempMax);
        setIsSetOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div
            className="bc-dialog"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <div className="bc-header" onMouseDown={handleMouseDown}>
                <span>B&C</span>
                <button className="bc-close" onClick={onClose}>x</button>
            </div>

            <div className="bc-histogram">
                <canvas
                    ref={canvasRef}
                    width={256}
                    height={50}
                    style={{ width: '100%', height: '100%', display: 'block' }}
                />
            </div>

            <div className="bc-range-labels">
                <span>{Math.round(currentMin)}</span>
                <span>{Math.round(currentMax)}</span>
            </div>

            {/* --- SET MODAL OVERLAY --- */}
            {isSetOpen && (
                <div className="bc-set-overlay">
                    <div className="bc-set-box">
                        <div className="bc-set-title">Set Display Range</div>
                        <div className="bc-set-row">
                            <label>Minimum:</label>
                            <input
                                type="number"
                                value={setTempMin}
                                onChange={(e) => setSetTempMin(Number(e.target.value))}
                            />
                        </div>
                        <div className="bc-set-row">
                            <label>Maximum:</label>
                            <input
                                type="number"
                                value={setTempMax}
                                onChange={(e) => setSetTempMax(Number(e.target.value))}
                            />
                        </div>
                        <div className="bc-set-actions">
                            <button onClick={handleConfirmSet}>OK</button>
                            <button onClick={() => setIsSetOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bc-sliders">
                <div className="bc-slider-row">
                    <label>Minimum</label>
                    <input
                        type="range"
                        min={sliderBounds.min}
                        max={Math.max(255, sliderBounds.max)}
                        step="1"
                        value={currentMin}
                        onChange={(e) => onChange(Number(e.target.value), currentMax)}
                    />
                    <input type="number" className="bc-number-input"
                        value={Math.round(currentMin)}
                        onChange={(e) => onChange(Number(e.target.value), currentMax)}
                    />
                </div>

                <div className="bc-slider-row">
                    <label>Maximum</label>
                    <input
                        type="range"
                        min={Math.min(0, sliderBounds.min)}
                        max={sliderBounds.max}
                        step="1"
                        value={currentMax}
                        onChange={(e) => onChange(currentMin, Number(e.target.value))}
                    />
                    <input type="number" className="bc-number-input"
                        value={Math.round(currentMax)}
                        onChange={(e) => onChange(currentMin, Number(e.target.value))}
                    />
                </div>

                <div className="divider-h"></div>

                <div className="bc-slider-row">
                    <label>Brightness</label>
                    <input
                        type="range" min="0" max="255" step="1"
                        value={brightness}
                        onChange={(e) => updateFromBC(Number(e.target.value), contrast)}
                    />
                    <input type="number" className="bc-number-input"
                        value={brightness}
                        onChange={(e) => updateFromBC(Number(e.target.value), contrast)}
                    />
                </div>

                <div className="bc-slider-row">
                    <label>Contrast</label>
                    <input
                        type="range" min="0" max="255" step="1"
                        value={contrast}
                        onChange={(e) => updateFromBC(brightness, Number(e.target.value))}
                    />
                    <input type="number" className="bc-number-input"
                        value={contrast}
                        onChange={(e) => updateFromBC(brightness, Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="bc-buttons">
                <button onClick={onAuto}>Auto</button>
                <button onClick={handleReset}>Reset</button>
                <button onClick={handleOpenSet}>Set</button>
                <button onClick={onApply}>Apply</button>
            </div>
        </div>
    );
};

export default BrightnessContrastDialog;