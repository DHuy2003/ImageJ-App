import Swal from "sweetalert2";

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

export const handleRestoreSelection = () => {
    const event = new CustomEvent('editRestoreSelection');
    window.dispatchEvent(event);
};

export const handleFitCircle = () => {
    const event = new CustomEvent('editFitCircle');
    window.dispatchEvent(event);
};

export const handleFitRectangle = () => {
    const event = new CustomEvent('editFitRectangle');
    window.dispatchEvent(event);
};

export const handleScale = () => {
    Swal.fire({
        title: 'Scale Selection',
        html: `
        <div style="display:flex;flex-direction:column;gap:8px;text-align:left;font-size:14px">
            <label>
            X scale factor:
            <input id="scale-x" type="number" step="0.01" value="1.00" style="width:80px;margin-left:8px" />
            </label>
            <label>
            Y scale factor:
            <input id="scale-y" type="number" step="0.01" value="1.00" style="width:80px;margin-left:8px" />
            </label>
        </div>
        `,
        showCancelButton: true,
        focusConfirm: false,
        preConfirm: () => {
        const xInput = document.getElementById('scale-x') as HTMLInputElement;
        const yInput = document.getElementById('scale-y') as HTMLInputElement;

        const sx = parseFloat(xInput?.value ?? '1');
        const sy = parseFloat(yInput?.value ?? '1');

        if (!isFinite(sx) || sx <= 0 || !isFinite(sy) || sy <= 0) {
            Swal.showValidationMessage('Scale factors must be positive numbers.');
            return null as any;
        }

        return { sx, sy };
        }
    }).then(result => {
        if (!result.isConfirmed || !result.value) return;

        const { sx, sy } = result.value as { sx: number; sy: number };

        const event = new CustomEvent('editScale', {
        detail: { sx, sy },
        });
        window.dispatchEvent(event);
    });
};  

export const handleRotate = () => {
    Swal.fire({
        title: 'Rotate Selection',
        input: 'number',
        inputLabel: 'Angle (degrees)',
        inputValue: 0,
        showCancelButton: true,
        inputAttributes: {
            min: '-360',
            max: '360',
            step: '1'
        },
        preConfirm: (value) => {
            const v = parseFloat(value as any);
            if (isNaN(v)) {
                Swal.showValidationMessage('Please enter a valid angle.');
                return;
            }
            if (v < -360 || v > 360) {
                Swal.showValidationMessage('Angle must be between -360 and 360.');
                return;
            }
            return v;
        }
    }).then((result) => {
        if (!result.isConfirmed || result.value == null) return;

        const angleDeg = result.value as number;

        const event = new CustomEvent('editRotate', {
            detail: { angleDeg },
        });
        window.dispatchEvent(event);
    });
};

