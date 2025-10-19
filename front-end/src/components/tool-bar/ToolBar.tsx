import { MousePointer, ZoomIn, Minus, Hand, Pentagon, Circle, Square, ArrowRight, Pipette, PaintBucket, Type, Crosshair, ZoomOut} from 'lucide-react';
import './ToolBar.css';

const ToolBar = () => {
    const handleMousePointerClick = ()=> {
        console.log("Mouse Pointer Clicked");
    }

    const handleSquareClick = () => {
        console.log("Square Clicked");
    }

    const handleCircleClick = () => {
        console.log("Circle Clicked");
    }

    const handlePentagonClick = () => {
        console.log("Pentagon Clicked");
    }

    const handleMinusClick = () => {
        console.log("Minus Clicked");
    }

    const handleArrowRightClick = () => {
        console.log("Arrow Right Clicked");
    }

    const handleTypeClick = () => {
        console.log("Type Clicked");
    }

    const handlePaintBucketClick = () => {
        console.log("Paint Bucket Clicked");
    }

    const handlePipetteClick = () => {
        console.log("Pipette Clicked");
    }

    const handleZoomInClick = () => {
        console.log("Zoom In Clicked");
    }

    const handleZoomOutClick = () => {
        console.log("Zoom Out Clicked");
    }
    
    const handleHandClick = () => {
        console.log("Hand Clicked");
    }

    const handleCrosshairClick = () => {
        console.log("Crosshair Clicked");
    }

    return (
        <div id="toolbar">
            <ul id="selection">
                <li><MousePointer className="selection-item" onClick={handleMousePointerClick} /></li>
                <li><Square className="selection-item" onClick={handleSquareClick} /></li>
                <li><Circle className="selection-item" onClick={handleCircleClick} /></li>
                <li><Pentagon className="selection-item" onClick={handlePentagonClick} /></li>
                <li><Minus className="selection-item" onClick={handleMinusClick} /></li>
                <li><ArrowRight className="selection-item" onClick={handleArrowRightClick} /></li>
                <li><Type className="selection-item" onClick={handleTypeClick} /></li>
                <li><PaintBucket className="selection-item" onClick={handlePaintBucketClick} /></li>
                <li><Pipette className="selection-item" onClick={handlePipetteClick} /></li>
                <li><ZoomIn className="selection-item" onClick={handleZoomInClick} /></li>
                <li><ZoomOut className="selection-item" onClick={handleZoomOutClick} /></li>
                <li><Hand className="selection-item" onClick={handleHandClick} /></li>
                <li><Crosshair className="selection-item" onClick={handleCrosshairClick} /></li>
            </ul>
        </div>
    );
}
export default ToolBar;