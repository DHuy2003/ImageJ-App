import React, { useEffect, useRef, useState } from 'react';
import './ThresholdDialog.css';

interface ThresholdDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onPreview: (min: number, max: number, mode: string, isDarkBg: boolean) => void;
    onApply: (min: number, max: number) => void;
    onAuto: () => void;
    onReset: () => void; // Khôi phục ảnh gốc
    histogram: number[]; // Mảng 256 phần tử
    initialMin: number;
    initialMax: number;
}

const ThresholdDialog: React.FC<ThresholdDialogProps> = ({
    isOpen,
    onClose,
    onPreview,
    onApply,
    onAuto,
    onReset,
    histogram,
    initialMin,
    initialMax
}) => {
    const [min, setMin] = useState(initialMin);
    const [max, setMax] = useState(initialMax);
    const [mode, setMode] = useState('Red');
    const [method, setMethod] = useState('Default');
    const [darkBg, setDarkBg] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Update state khi props thay đổi (ví dụ khi nhấn nút Auto ở parent)
    useEffect(() => {
        setMin(initialMin);
        setMax(initialMax);
    }, [initialMin, initialMax, isOpen]);

    // Vẽ Histogram
    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        ctx.clearRect(0, 0, w, h);

        const maxCount = Math.max(...histogram);
        
        // Vẽ nền trắng
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);

        // Vẽ các cột histogram (Màu đen)
        ctx.fillStyle = '#000';
        for (let i = 0; i < 256; i++) {
            const barHeight = (histogram[i] / maxCount) * h;
            // Map i (0-255) sang canvas width
            const x = (i / 255) * w;
            const barW = w / 256;
            ctx.fillRect(x, h - barHeight, barW, barHeight);
        }
    }, [isOpen, histogram]);

    // Trigger Preview mỗi khi giá trị thay đổi
    useEffect(() => {
        if (isOpen) {
            onPreview(min, max, mode, darkBg);
        }
    }, [min, max, mode, darkBg, isOpen]);

    // Xử lý nút Reset (Preview lại ảnh gốc)
    const handleReset = () => {
        onReset();
        // Có thể reset slider về mặc định nếu cần
    };

    if (!isOpen) return null;

    return (
        <div className="threshold-dialog-overlay">
            <div className="threshold-window">
                <div className="threshold-header">Threshold</div>
                
                <div className="histogram-container">
                    <canvas ref={canvasRef} width={256} height={100} className="hist-canvas" />
                </div>

                <div className="sliders-container">
                    {/* Range Sliders giả lập (dùng 2 input range chồng lên nhau hoặc UI library) */}
                    {/* Ở đây dùng 2 thanh trượt riêng biệt cho đơn giản */}
                    <div className="slider-row">
                        <input 
                            type="range" min="0" max="255" 
                            value={min} 
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setMin(val > max ? max : val);
                            }} 
                        />
                    </div>
                    <div className="slider-row">
                        <input 
                            type="range" min="0" max="255" 
                            value={max} 
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setMax(val < min ? min : val);
                            }} 
                        />
                    </div>
                    <div className="scrollbar-image">
                        {/* Hình ảnh mô phỏng thanh gradient đen trắng */}
                        <div style={{height: '10px', background: 'linear-gradient(to right, black, white)', border: '1px solid #999'}}></div>
                    </div>
                    <div className="slider-values">
                        <span>{min}</span>
                        <span>{max}</span>
                    </div>
                </div>

                <div className="controls-row">
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="Default">Default</option>
                        <option value="Huang">Huang</option>
                        <option value="Intermodes">Intermodes</option>
                        <option value="IsoData">IsoData</option>
                        <option value="Otsu">Otsu</option>
                    </select>
                    
                    <select value={mode} onChange={(e) => setMode(e.target.value)}>
                        <option value="Red">Red</option>
                        <option value="B&W">B&W</option>
                        <option value="Over/Under">Over/Under</option>
                    </select>
                </div>

                <div className="checkbox-row">
                    <label>
                        <input 
                            type="checkbox" 
                            checked={darkBg} 
                            onChange={(e) => setDarkBg(e.target.checked)} 
                        />
                        Dark Background
                    </label>
                </div>

                <div className="buttons-row">
                    <button onClick={onAuto}>Auto</button>
                    <button onClick={() => onApply(min, max)}>Apply</button>
                    <button onClick={handleReset}>Reset</button>
                    <button onClick={() => { /* Logic cho Set */ }}>Set</button>
                </div>
                
                <button className="close-btn" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default ThresholdDialog;