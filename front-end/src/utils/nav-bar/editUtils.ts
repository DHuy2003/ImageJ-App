
export const handleCut = () => {
    const event = new CustomEvent('enableCropMode');
    window.dispatchEvent(event);
}