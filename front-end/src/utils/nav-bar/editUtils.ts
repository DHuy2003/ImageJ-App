export const handleCut = () => {
    const event = new CustomEvent('enableCropMode');
    window.dispatchEvent(event);
};

// Xóa vùng bên trong ROI (thay bằng nền trắng)
export const handleClear = () => {
    const event = new CustomEvent('editClear');
    window.dispatchEvent(event);
};

// Xóa mọi thứ *ngoài* ROI (ngoài = trắng)
export const handleClearOutside = () => {
    const event = new CustomEvent('editClearOutside');
    window.dispatchEvent(event);
};

// Tô màu vùng ROI (tạm thời để màu đen, sau này có thể truyền màu)
export const handleFill = () => {
    const event = new CustomEvent('editFill', {
        detail: { color: '#000000' } // màu fill mặc định
    });
    window.dispatchEvent(event);
};

export const handleSelectionAll = () => {
    const event = new CustomEvent('editSelectAll');
    window.dispatchEvent(event);
};

// Hủy ROI hiện tại, không còn selection
export const handleSelectionNone = () => {
    const event = new CustomEvent('editSelectNone');
    window.dispatchEvent(event);
};
