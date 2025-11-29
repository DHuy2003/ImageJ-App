import { MousePointer, Hand, Circle, Square, Brush, CirclePlus, CircleMinus} from 'lucide-react';
import './ToolBar.css';
import { handleCircleClick, handleHandClick, handleMousePointerClick, handleSquareClick, handleBrushClick, handleCirclePlusClick, handleCircleMinusClick } from '../../utils/tool-bar/toolBarUtils';

const ToolBar = () => {
    return (
        <div id="toolbar">
            <ul id="selection">
                <li><MousePointer className="selection-item" onClick={handleMousePointerClick} /></li>
                <li><Square className="selection-item" onClick={handleSquareClick} /></li>
                <li><Circle className="selection-item" onClick={handleCircleClick} /></li>
                <li><Hand className="selection-item" onClick={handleHandClick} /></li>
                <li><Brush className="selection-item" onClick={handleBrushClick} /></li>
                <li><CirclePlus className="selection-item" onClick={handleCirclePlusClick} /></li>
                <li><CircleMinus className="selection-item" onClick={handleCircleMinusClick} /></li>
            </ul>
        </div>
    );
}
export default ToolBar;