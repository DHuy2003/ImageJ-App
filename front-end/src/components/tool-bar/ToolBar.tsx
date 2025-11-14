import { MousePointer, ZoomIn, Hand, Circle, Square, Pipette, PaintBucket, Type, ZoomOut} from 'lucide-react';
import './ToolBar.css';
import {  handleCircleClick, handleHandClick, handleMousePointerClick, handlePaintBucketClick, handlePipetteClick, handleSquareClick, handleTypeClick, handleZoomInClick, handleZoomOutClick } from '../../utils/tool-bar/toolBarUtils';

const ToolBar = () => {
    return (
        <div id="toolbar">
            <ul id="selection">
                <li><MousePointer className="selection-item" onClick={handleMousePointerClick} /></li>
                <li><Square className="selection-item" onClick={handleSquareClick} /></li>
                <li><Circle className="selection-item" onClick={handleCircleClick} /></li>
                <li><Type className="selection-item" onClick={handleTypeClick} /></li>
                <li><PaintBucket className="selection-item" onClick={handlePaintBucketClick} /></li>
                <li><Pipette className="selection-item" onClick={handlePipetteClick} /></li>
                <li><ZoomIn className="selection-item" onClick={handleZoomInClick} /></li>
                <li><ZoomOut className="selection-item" onClick={handleZoomOutClick} /></li>
                <li><Hand className="selection-item" onClick={handleHandClick} /></li>
            </ul>
        </div>
    );
}
export default ToolBar;