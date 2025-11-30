import { MousePointer, Hand, Circle, Square, Brush} from 'lucide-react';
import './ToolBar.css';
import { handleCircleClick, handleHandClick, handleMousePointerClick, handleSquareClick, handleBrushClick } from '../../utils/tool-bar/toolBarUtils';

const ToolBar = () => {
    return (
        <div id="toolbar">
            <ul id="selection">
                <li><MousePointer className="selection-item" onClick={handleMousePointerClick} /></li>
                <li><Square className="selection-item" onClick={handleSquareClick} /></li>
                <li><Circle className="selection-item" onClick={handleCircleClick} /></li>
                <li><Hand className="selection-item" onClick={handleHandClick} /></li>
                <li><Brush className="selection-item" onClick={handleBrushClick} /></li>
            </ul>
        </div>
    );
}
export default ToolBar;