import Swal from "sweetalert2";
import { type SelectedRoiInfo } from "../../types/roi";
import { renderScaleSelectionDialog } from "../../components/image-view/dialogs/selection/ScaleSelectionDialog";
import { renderRotateSelectionDialog } from "../../components/image-view/dialogs/selection/RotateSelectionDialog";
import { renderPropertiesSelectionDialog, type PropertiesSelectionDialogProps } from "../../components/image-view/dialogs/selection/PropertiesSelectionDialog";
import { dispatchNotification } from "./processUtils";

export const showSelectionRequired = () => {
  dispatchNotification("This command requires a selection.", "warning");
};

let currentSelection: SelectedRoiInfo = null;

if (
  typeof window !== "undefined" &&
  !(window as any).__editUtilsRoiListenerAttached
) {
  const handler = (
    e: Event,
  ) => {
    const ce = e as CustomEvent<{
      id: number;
      type: "rect" | "circle";
      imageRect: { x: number; y: number; width: number; height: number };
      angle?: number;
    } | null>;

    if (!ce.detail) {
      currentSelection = null;
      return;
    }

    const { type, imageRect, angle } = ce.detail;

    currentSelection = {
      type,
      x: imageRect.x,
      y: imageRect.y,
      width: imageRect.width,
      height: imageRect.height,
      angle: angle ?? 0,
    };
  };

  window.addEventListener("roiSelection", handler as EventListener);
  (window as any).__editUtilsRoiListenerAttached = true;
}

export const handleCut = () => {
  const event = new CustomEvent("enableCropMode");
  window.dispatchEvent(event);
};

export const handleClear = () => {
  const event = new CustomEvent("editClear");
  window.dispatchEvent(event);
};

export const handleClearOutside = () => {
  const event = new CustomEvent("editClearOutside");
  window.dispatchEvent(event);
};

export const handleFill = () => {
  const event = new CustomEvent("editFill", {
    detail: { color: "#000000" },
  });
  window.dispatchEvent(event);
};

export const handleSelectionAll = () => {
  const event = new CustomEvent("editSelectAll");
  window.dispatchEvent(event);
};

export const handleSelectionNone = () => {
  const event = new CustomEvent("editSelectNone");
  window.dispatchEvent(event);
};

export const handleUndo = () => {
  const event = new CustomEvent("editUndo");
  window.dispatchEvent(event);
};

export const handleInvert = () => {
  const event = new CustomEvent("editInvert");
  window.dispatchEvent(event);
};

export const handleDraw = () => {
  const event = new CustomEvent("editDraw");
  window.dispatchEvent(event);
};

export const handleRestoreSelection = () => {
  const event = new CustomEvent("editRestoreSelection");
  window.dispatchEvent(event);
};

export const handleFitCircle = () => {
  const event = new CustomEvent("editFitCircle");
  window.dispatchEvent(event);
};

export const handleFitRectangle = () => {
  const event = new CustomEvent("editFitRectangle");
  window.dispatchEvent(event);
};

export const handleScale = () => {
  if (!currentSelection) {
    showSelectionRequired();
    return;
  }

  const { width, height } = currentSelection;
  const html = renderScaleSelectionDialog({ width, height });

  Swal.fire({
    title: "Scale Selection",
    html,
    showCancelButton: true,
    confirmButtonText: "Apply",
    cancelButtonText: "Cancel",
    focusConfirm: false,
    customClass: {
      popup: "selection-dialog__popup",
      title: "selection-dialog__title",
      htmlContainer: "selection-dialog__body",
      confirmButton: "selection-dialog__btn selection-dialog__btn--primary",
      cancelButton: "selection-dialog__btn selection-dialog__btn--ghost",
    },
    preConfirm: () => {
      const xInput = document.getElementById(
        "scale-x"
      ) as HTMLInputElement | null;
      const yInput = document.getElementById(
        "scale-y"
      ) as HTMLInputElement | null;

      const sx = parseFloat(xInput?.value ?? "1");
      const sy = parseFloat(yInput?.value ?? "1");

      if (!isFinite(sx) || sx <= 0 || !isFinite(sy) || sy <= 0) {
        dispatchNotification('Scale factors must be positive numbers.', 'error');
        return null;
      }

      const newW = width * sx;
      const newH = height * sy;

      if (newW < 1 || newH < 1) {
        dispatchNotification('Resulting size is too small.', 'warning');
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

  const currentAngle =
    ((currentSelection.angle ?? 0) % 360 + 360) % 360; 

  const html = renderRotateSelectionDialog({
    currentAngle,
    rotateAroundImageCenter: false,
  });

  Swal.fire({
    title: "Rotate Selection",
    html,
    showCancelButton: true,
    confirmButtonText: "Rotate",
    cancelButtonText: "Cancel",
    focusConfirm: false,
    customClass: {
      popup: "selection-dialog__popup",
      title: "selection-dialog__title",
      htmlContainer: "selection-dialog__body",
      confirmButton: "selection-dialog__btn selection-dialog__btn--primary",
      cancelButton: "selection-dialog__btn selection-dialog__btn--ghost",
    },
    preConfirm: () => {
      const input = document.getElementById(
        "rotate-angle"
      ) as HTMLInputElement | null;
      const aroundCenterEl = document.getElementById(
        "rotate-around-center"
      ) as HTMLInputElement | null;
      if (!input) {
        dispatchNotification('Internal error: angle input not found.', 'error');
        return null;
      }

      const v = parseFloat(input.value);
      if (!isFinite(v)) {
        dispatchNotification('Please enter a valid angle.', 'error');
        return null;
      }
      if (v < -360 || v > 360) {
        dispatchNotification('Angle must be between -360 and 360 degrees.', 'error');
        return null;
      }

      return { angleDeg: v, rotateAroundImageCenter: !!aroundCenterEl?.checked };
    },
  }).then((result) => {
    if (!result.isConfirmed || result.value == null) return;

    const { angleDeg, rotateAroundImageCenter } = result.value as {
      angleDeg: number;
      rotateAroundImageCenter: boolean;
    };

    const event = new CustomEvent("roiRotate", {
      detail: { angleDeg, rotateAroundImageCenter },
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

  let props: PropertiesSelectionDialogProps;

  if (type === "circle") {
    const diameterX = width;
    const diameterY = height;
    const diameter = (diameterX + diameterY) / 2;
    const radius = diameter / 2;
    const areaCircle = Math.PI * radius * radius;

    props = {
      kind: "circle",
      centerX: fmt(centerX),
      centerY: fmt(centerY),
      xmin: fmt(xmin),
      ymin: fmt(ymin),
      xmax: fmt(xmax),
      ymax: fmt(ymax),
      radius: fmt(radius),
      diameter: fmt(diameter),
      area: fmt(areaCircle),
    };
  } else {
    const area = width * height;

    props = {
      kind: "rect",
      centerX: fmt(centerX),
      centerY: fmt(centerY),
      xmin: fmt(xmin),
      ymin: fmt(ymin),
      xmax: fmt(xmax),
      ymax: fmt(ymax),
      width: fmt(width),
      height: fmt(height),
      area: fmt(area),
    };
  }

  const html = renderPropertiesSelectionDialog(props);

  Swal.fire({
    title: "Selection Properties",
    html,
    confirmButtonText: "OK",
    showCancelButton: false,
    customClass: {
      popup: "selection-dialog__popup selection-dialog__popup--props",
      title: "selection-dialog__title",
      htmlContainer: "selection-dialog__body",
      confirmButton:
        "selection-dialog__btn selection-dialog__btn--primary selection-dialog__btn--full",
    },
  });
};

