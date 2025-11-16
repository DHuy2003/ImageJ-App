export const handleCut = () => {
    const event = new CustomEvent('enableCropMode');
    window.dispatchEvent(event);
};

export const handleClear = () => {
    const event = new CustomEvent('editClear');
    window.dispatchEvent(event);
};

export const handleClearOutside = () => {
    const event = new CustomEvent('editClearOutside');
    window.dispatchEvent(event);
};

export const handleFill = () => {
    const event = new CustomEvent('editFill', {
        detail: { color: '#000000' } 
    });
    window.dispatchEvent(event);
};

export const handleSelectionAll = () => {
    const event = new CustomEvent('editSelectAll');
    window.dispatchEvent(event);
};

export const handleSelectionNone = () => {
    const event = new CustomEvent('editSelectNone');
    window.dispatchEvent(event);
};

export const handleUndo = () => {
    const event = new CustomEvent('editUndo');
    window.dispatchEvent(event);
};

export const handleInvert = () => {
    const event = new CustomEvent('editInvert');
    window.dispatchEvent(event);
};

export const handleDraw = () => {
    const event = new CustomEvent('editDraw');
    window.dispatchEvent(event);
};
