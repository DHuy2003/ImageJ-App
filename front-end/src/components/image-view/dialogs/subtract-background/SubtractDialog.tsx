import React, { useEffect, useRef, useState } from 'react';
import './SubtractDialog.css';

export interface SubtractBackgroundParams {
    radius: number;
    lightBackground: boolean;
    createBackground: boolean;
    slidingParaboloid: boolean;
    disableSmoothing: boolean;
    preview: boolean;
}

interface SubtractDialogProps {
    isOpen: boolean;
    params: SubtractBackgroundParams;
    onChange: (params: SubtractBackgroundParams) => void;
    onApply: () => void;
    onCancel: () => void;
}

const SubtractDialog: React.FC<SubtractDialogProps> = ({
    isOpen,
    params,
    onChange,
    onApply,
    onCancel,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ top: 100, left: 80 });
    const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragOffsetRef.current) return;
            setPosition({
                top: e.clientY - dragOffsetRef.current.y,
                left: e.clientX - dragOffsetRef.current.x,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragOffsetRef.current = null;
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!isOpen) return null;

    const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
        dragOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
        setIsDragging(true);
    };

    const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        const r = isNaN(value) ? 1 : Math.max(1, value);
        onChange({ ...params, radius: r });
    };

    const handleCheckboxChange = (field: keyof SubtractBackgroundParams) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange({ ...params, [field]: e.target.checked });
        };

    const handleOk = (e: React.MouseEvent) => {
        e.preventDefault();
        onApply();
    };

    const handleCancelClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onCancel();
    };

    const handleHelp = () => {
        // Mở trang help của ImageJ (nếu cần), không bắt buộc
        window.open('https://imagej.net/ij/docs/menus/process.html#background', '_blank');
    };

    return (
        <div
            className="subtract-panel"
            style={{ top: position.top, left: position.left }}
        >
            <div className="subtract-panel-header" onMouseDown={handleHeaderMouseDown}>
                Subtract Background...
            </div>

            <div className="subtract-panel-body">
                <div className="subtract-row">
                    <span className="subtract-label">Rolling ball radius:</span>
                    <input
                        type="number"
                        className="subtract-input"
                        value={params.radius}
                        step={1}
                        min={1}
                        onChange={handleRadiusChange}
                    />
                    <span className="subtract-unit">pixels</span>
                </div>

                <div className="subtract-row subtract-checkbox-row">
                    <label className="subtract-checkbox-label">
                        <input
                            type="checkbox"
                            checked={params.lightBackground}
                            onChange={handleCheckboxChange('lightBackground')}
                        />
                        Light background
                    </label>
                </div>

                <div className="subtract-row subtract-checkbox-row">
                    <label className="subtract-checkbox-label">
                        <input
                            type="checkbox"
                            checked={params.createBackground}
                            onChange={handleCheckboxChange('createBackground')}
                        />
                        Create background (don&apos;t subtract)
                    </label>
                </div>

                <div className="subtract-row subtract-checkbox-row">
                    <label className="subtract-checkbox-label">
                        <input
                            type="checkbox"
                            checked={params.slidingParaboloid}
                            onChange={handleCheckboxChange('slidingParaboloid')}
                        />
                        Sliding paraboloid
                    </label>
                </div>

                <div className="subtract-row subtract-checkbox-row">
                    <label className="subtract-checkbox-label">
                        <input
                            type="checkbox"
                            checked={params.disableSmoothing}
                            onChange={handleCheckboxChange('disableSmoothing')}
                        />
                        Disable smoothing
                    </label>
                </div>

                <div className="subtract-row subtract-checkbox-row">
                    <label className="subtract-checkbox-label">
                        <input
                            type="checkbox"
                            checked={params.preview}
                            onChange={handleCheckboxChange('preview')}
                        />
                        Preview
                    </label>
                </div>
            </div>

            <div className="subtract-panel-footer">
                <button className="subtract-btn" onClick={handleOk}>
                    OK
                </button>
                <button className="subtract-btn" onClick={handleCancelClick}>
                    Cancel
                </button>
                <button className="subtract-btn" onClick={handleHelp}>
                    Help
                </button>
            </div>
        </div>
    );
};

export default SubtractDialog;
