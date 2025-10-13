import { MousePointer, ZoomIn, Minus, Hand, Pentagon, Circle, Square, ArrowRight, Pipette, PaintBucket, Type, Crosshair} from 'lucide-react';
import './ToolBar.css';

const ToolBar = () => {
    return (
        <div id="toolbar">
            <ul id="selection">
                <li><MousePointer className="selection-item" ></MousePointer></li>
                <li><Square className="selection-item"></Square></li>
                <li><Circle className="selection-item"></Circle></li>
                <li><Pentagon className="selection-item"></Pentagon></li>
                <li><Minus className="selection-item"></Minus></li>
                <li><ArrowRight className="selection-item"></ArrowRight></li>
                <li><Type className="selection-item"></Type></li>
                <li><PaintBucket className="selection-item"></PaintBucket></li>
                <li><Pipette className="selection-item"></Pipette></li>
                <li><ZoomIn className="selection-item"></ZoomIn></li>
                <li><Hand className="selection-item"></Hand></li>
                <li><Crosshair className="selection-item"></Crosshair></li>
            </ul>
        </div>
    );
}
export default ToolBar;