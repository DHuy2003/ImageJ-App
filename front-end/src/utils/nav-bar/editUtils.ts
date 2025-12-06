import Swal from "sweetalert2";
import { showSelectionRequired, type SelectedRoiInfo } from "../../types/roi";

let currentSelection: SelectedRoiInfo = null;
if (typeof window !== "undefined" && !(window as any).__editUtilsRoiListenerAttached) {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<{
      id: number;
      type: "rect" | "circle";
      imageRect: { x: number; y: number; width: number; height: number };
    } | null>;

    if (!ce.detail) {
      currentSelection = null;
      return;
    }

    const { type, imageRect } = ce.detail;
    currentSelection = {
      type,
      x: imageRect.x,
      y: imageRect.y,
      width: imageRect.width,
      height: imageRect.height,
    };
  };

  window.addEventListener("roiSelection", handler as EventListener);
  (window as any).__editUtilsRoiListenerAttached = true;
}

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
    if (!currentSelection) {
        showSelectionRequired();
        return;
    }
  
    const { width, height } = currentSelection;
    const fmt = (v: number) => v.toFixed(2);
  
    Swal.fire({
        title: "Scale Selection",
        html: `
            <div style="display:flex;flex-direction:column;gap:16px;text-align:left;font-size:16px;">

                <div style="
                    padding:12px 14px;
                    border-radius:10px;
                    background:#f1f1f1;
                    font-size:16px;
                ">
                <div style="font-weight:600;margin-bottom:6px;font-size:17px;">Current size</div>
                <div style="font-size:16px;">
                    ${fmt(width)} × ${fmt(height)} px
                </div>
                </div>

                <label style="display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:16px;">
                <span>X scale factor</span>
                <input
                    id="scale-x"
                    type="number"
                    step="0.01"
                    value="1.00"
                    style="
                    width:110px;
                    padding:6px 10px;
                    border-radius:8px;
                    border:1px solid #ccc;
                    font-size:16px;
                    "
                />
                </label>

                <label style="display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:16px;">
                <span>Y scale factor</span>
                <input
                    id="scale-y"
                    type="number"
                    step="0.01"
                    value="1.00"
                    style="
                    width:110px;
                    padding:6px 10px;
                    border-radius:8px;
                    border:1px solid #ccc;
                    font-size:16px;
                    "
                />
                </label>

                <p style="font-size:15px;color:#444;margin-top:4px;line-height:1.5;">
                <b>Tip:</b><br/>
                1.0 = giữ nguyên<br/>
                > 1.0 = phóng to<br/>
                < 1.0 = thu nhỏ
                </p>
            </div>
            `,
        showCancelButton: true,
        confirmButtonText: "Apply",
        cancelButtonText: "Cancel",
        focusConfirm: false,
        preConfirm: () => {
            const xInput = document.getElementById("scale-x") as HTMLInputElement | null;
            const yInput = document.getElementById("scale-y") as HTMLInputElement | null;
    
            const sx = parseFloat(xInput?.value ?? "1");
            const sy = parseFloat(yInput?.value ?? "1");
    
            if (!isFinite(sx) || sx <= 0 || !isFinite(sy) || sy <= 0) {
            Swal.showValidationMessage("Scale factors must be positive numbers.");
            return null;
            }
    
            const newW = width * sx;
            const newH = height * sy;
    
            if (newW < 1 || newH < 1) {
            Swal.showValidationMessage("Resulting size is too small.");
            return null;
            }
    
            return { sx, sy };
        },
        }).then((result) => {
        if (!result.isConfirmed || !result.value) return;
    
        const { sx, sy } = result.value as { sx: number; sy: number };
    
        const event = new CustomEvent("editScale", {
            detail: { sx, sy },
        });
        window.dispatchEvent(event);
    });
};  

export const handleRotate = () => {
    if (!currentSelection) {
      showSelectionRequired();
      return;
    }
  
    Swal.fire({
      title: "Rotate Selection",
      html: `
        <div style="
          display:flex;
          flex-direction:column;
          gap:14px;
          text-align:left;
          font-size:15px;
        ">
          <div style="
            padding:10px 12px;
            border-radius:10px;
            background:#f1f3f5;
          ">
            <div style="font-weight:600;margin-bottom:6px;font-size:16px;">
              Angle
            </div>
            <div style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:12px;
            ">
              <span>Degrees</span>
              <input
                id="rotate-angle"
                type="number"
                step="1"
                value="0"
                style="
                  width:100px;
                  padding:6px 10px;
                  border-radius:8px;
                  border:1px solid #ccc;
                  font-size:15px;
                "
              />
            </div>
          </div>

          <div style="font-size:13px;color:#555;line-height:1.5;">
            Examples: <b>90</b>, <b>-90</b>, <b>180</b>.<br/>
            Allowed range: <b>-360°</b> to <b>360°</b>.
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Rotate",
      cancelButtonText: "Cancel",
      focusConfirm: false,
      preConfirm: () => {
        const input = document.getElementById("rotate-angle") as HTMLInputElement | null;
        if (!input) {
          Swal.showValidationMessage("Internal error: angle input not found.");
          return null;
        }
  
        const v = parseFloat(input.value);
        if (!isFinite(v)) {
          Swal.showValidationMessage("Please enter a valid angle.");
          return null;
        }
        if (v < -360 || v > 360) {
          Swal.showValidationMessage("Angle must be between -360 and 360 degrees.");
          return null;
        }
  
        return v;
      },
    }).then((result) => {
      if (!result.isConfirmed || result.value == null) return;
  
      const angleDeg = result.value as number;
  
      const event = new CustomEvent("roiRotate", {
        detail: { angleDeg },
      });
      window.dispatchEvent(event);
    });
};      

export const handleProperties = () => {
    if (!currentSelection) {
        showSelectionRequired();
        return;
    }
  
    const { type, x, y, width, height } = currentSelection;
    const fmt = (v: number) => v.toFixed(2);
    const xmin = x;
    const ymin = y;
    const xmax = x + width;
    const ymax = y + height;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
  
    if (type === "circle") {
        const diameterX = width;
        const diameterY = height;
        const diameter = (diameterX + diameterY) / 2;
        const radius = diameter / 2;
        const areaCircle = Math.PI * radius * radius;
    
        Swal.fire({
            title: "Selection Properties",
            html: `
                <div style="text-align:left; font-family:monospace; line-height:1.55; font-size:17px;">

                    <p style="font-size:18px; font-weight:600;"><b>Type:</b> Circle</p>
                    <hr style="margin:10px 0;"/>

                    <p style="font-size:18px; font-weight:600;">Center (px)</p>
                    <p>Xc: <b>${fmt(centerX)}</b></p>
                    <p>Yc: <b>${fmt(centerY)}</b></p>

                    <hr style="margin:14px 0;"/>

                    <p style="font-size:18px; font-weight:600;">Bounding box (px)</p>
                    <p>xmin: <b>${fmt(xmin)}</b></p>
                    <p>ymin: <b>${fmt(ymin)}</b></p>
                    <p>xmax: <b>${fmt(xmax)}</b></p>
                    <p>ymax: <b>${fmt(ymax)}</b></p>

                    <hr style="margin:14px 0;"/>

                    <p style="font-size:18px; font-weight:600;">Geometry</p>
                    <p>Radius: <b>${fmt(radius)}</b> px</p>
                    <p>Diameter: <b>${fmt(diameter)}</b> px</p>
                    <p>Area: <b>${fmt(areaCircle)}</b> px²</p>

                </div>
            `,
            confirmButtonText: "OK",
            confirmButtonColor: "#3085d6",
        });
        return;
    }

    const area = width * height;
    
    Swal.fire({
        title: "Selection Properties",
        html: `
            <div style="text-align:left; font-family:monospace; line-height:1.55; font-size:17px;">

                <p style="font-size:18px; font-weight:600;"><b>Type:</b> Rectangle</p>
                <hr style="margin:10px 0;"/>

                <p style="font-size:18px; font-weight:600;">Center (px)</p>
                <p>Xc: <b>${fmt(centerX)}</b></p>
                <p>Yc: <b>${fmt(centerY)}</b></p>

                <hr style="margin:14px 0;"/>

                <p style="font-size:18px; font-weight:600;">Bounding box (px)</p>
                <p>xmin: <b>${fmt(xmin)}</b></p>
                <p>ymin: <b>${fmt(ymin)}</b></p>
                <p>xmax: <b>${fmt(xmax)}</b></p>
                <p>ymax: <b>${fmt(ymax)}</b></p>

                <hr style="margin:14px 0;"/>

                <p style="font-size:18px; font-weight:600;">Size (px)</p>
                <p>Width: <b>${fmt(width)}</b></p>
                <p>Height: <b>${fmt(height)}</b></p>
                <p>Area: <b>${fmt(area)}</b> px²</p>

            </div>
        `,
        confirmButtonText: "OK",
        confirmButtonColor: "#3085d6",
    });
};



