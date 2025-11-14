import type { ToolbarAction, ToolbarTool} from '../../types/toolbar';

export const TOOLBAR_EVENT_NAME = 'toolbar-action';

let currentTool: ToolbarTool = 'pointer';
export const getCurrentToolbarTool = () => currentTool;

export const emitToolbarAction = (action: ToolbarAction) => {
    if (action.type === 'SET_TOOL') {
      currentTool = action.tool;
    }
  
    window.dispatchEvent(
      new CustomEvent<ToolbarAction>(TOOLBAR_EVENT_NAME, {
        detail: action,
      }),
    );
};

export const handleMousePointerClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'pointer' });
};
  
export const handleSquareClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'rect' });
};
  
export const handleCircleClick = () => {
    emitToolbarAction({ type: 'SET_TOOL', tool: 'circle' });
};  

export const handlePentagonClick = () => {
    console.log('Pentagon Clicked');
};

export const handleMinusClick = () => {
    console.log('Minus Clicked');
};

export const handleArrowRightClick = () => {
    console.log('Arrow Right Clicked');
};

export const handleTypeClick = () => {
    console.log('Type Clicked');
};

export const handlePaintBucketClick = () => {
    console.log('Paint Bucket Clicked');
};

export const handlePipetteClick = () => {
    console.log('Pipette Clicked');
};

export const handleZoomInClick = () => {
    emitToolbarAction({ type: 'ZOOM_IN' });
};  

export const handleZoomOutClick = () => {
    emitToolbarAction({ type: 'ZOOM_OUT' });
};

let isPanMode = false;
export const handleHandClick = () => {
    isPanMode = !isPanMode;
    emitToolbarAction({ type: 'PAN_MODE', enabled: isPanMode });
};

export const handleCrosshairClick = () => {
    console.log('Crosshair Clicked');
};
