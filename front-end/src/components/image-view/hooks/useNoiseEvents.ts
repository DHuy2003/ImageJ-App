import { useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  processAddNoise,
  processAddSpecifiedNoise,
  processSaltAndPepperNoise,
  processDespeckle,
  processRemoveOutliers,
  processRemoveNaNs,
} from '../../../utils/nav-bar/processUtils';

type GetImageDataResult = {
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  canvas: HTMLCanvasElement;
} | null;

type GetImageDataFn = () => GetImageDataResult;
type UpdateFromCanvasFn = (canvas: HTMLCanvasElement, saveToHistory?: boolean) => void;
type GetBitDepthFn = () => number | undefined;

const NOISE_ACTIONS = new Set([
  'add-noise',
  'add-specified-noise',
  'salt-and-pepper',
  'despeckle',
  'remove-outliers',
  'remove-nans',
]);

const useNoiseEvents = (
  getImageData: GetImageDataFn,
  updateImageFromCanvas: UpdateFromCanvasFn,
  getCurrentBitDepth?: GetBitDepthFn
) => {
  useEffect(() => {
    const applyAndUpdate = (
      imageData: ImageData,
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      fn: (img: ImageData) => ImageData | null
    ) => {
      const result = fn(imageData);
      if (!result) return;
      ctx.putImageData(result, 0, 0);
      updateImageFromCanvas(canvas);
    };

    const handleAddSpecifiedNoise = async () => {
      const { value, isConfirmed, dismiss } = await Swal.fire({
        title: 'Gaussian Noise',
        html: `
          <div style="display:flex; flex-direction:column; gap:8px; text-align:left; font-size:13px;">
            <label style="display:flex; align-items:center; justify-content:space-between;">
              <span style="margin-right:8px;">Standard Deviation:</span>
              <input id="gaussian-stddev-input" type="number" value="25.00" step="0.1" style="width:90px; padding:2px 4px;" />
            </label>
          </div>
        `,
        width: 320,
        padding: '0.75rem 0.75rem 0.9rem',
        showCancelButton: true,
        focusConfirm: true,
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
          const input = document.getElementById('gaussian-stddev-input') as HTMLInputElement | null;
          if (!input) {
            Swal.showValidationMessage('Invalid input');
            return null;
          }
          const v = parseFloat(input.value);
          if (!isFinite(v) || v <= 0) {
            Swal.showValidationMessage('Standard deviation must be > 0');
            return null;
          }
          return v;
        },
      });

      if (!isConfirmed || dismiss || value == null) return;
      const stdDev = value as number;

      const data = getImageData();
      if (!data) return;
      const { ctx, imageData, canvas } = data;

      applyAndUpdate(imageData, ctx, canvas, (img) =>
        processAddSpecifiedNoise(img, { stdDev })
      );
    };

    const handleRemoveOutliers = async () => {
      const { value, isConfirmed, dismiss } = await Swal.fire<{
        radius: string;
        threshold: string;
        which: 'Bright' | 'Dark' | 'Both';
      }>({
        title: 'Remove Outliers...',
        html: `
          <div style="display:flex; flex-direction:column; gap:8px; text-align:left; font-size:13px;">
            <label style="display:flex; align-items:center; justify-content:space-between;">
              <span style="margin-right:8px;">Radius:</span>
              <input id="remove-outliers-radius" type="number" value="2.0" step="0.1" style="width:90px; padding:2px 4px;" />
            </label>
            <label style="display:flex; align-items:center; justify-content:space-between;">
              <span style="margin-right:8px;">Threshold:</span>
              <input id="remove-outliers-threshold" type="number" value="50" step="1" style="width:90px; padding:2px 4px;" />
            </label>
            <label style="display:flex; align-items:center; justify-content:space-between;">
              <span style="margin-right:8px;">Which outliers:</span>
              <select id="remove-outliers-which" style="width:100px; padding:2px 4px;">
                <option value="Bright">Bright</option>
                <option value="Dark">Dark</option>
                <option value="Both">Both</option>
              </select>
            </label>
          </div>
        `,
        width: 360,
        padding: '0.75rem 0.75rem 0.9rem',
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
          const radiusEl = document.getElementById('remove-outliers-radius') as HTMLInputElement | null;
          const thresholdEl = document.getElementById('remove-outliers-threshold') as HTMLInputElement | null;
          const whichEl = document.getElementById('remove-outliers-which') as HTMLSelectElement | null;

          if (!radiusEl || !thresholdEl || !whichEl) {
            Swal.showValidationMessage('Invalid form');
            return null;
          }

          const radius = parseFloat(radiusEl.value);
          const threshold = parseFloat(thresholdEl.value);
          const which = whichEl.value as 'Bright' | 'Dark' | 'Both';

          if (!isFinite(radius) || radius <= 0) {
            Swal.showValidationMessage('Radius must be > 0');
            return null;
          }
          if (!isFinite(threshold) || threshold < 0) {
            Swal.showValidationMessage('Threshold must be ≥ 0');
            return null;
          }

          return {
            radius: radius.toString(),
            threshold: threshold.toString(),
            which,
          };
        },
      });

      if (!isConfirmed || dismiss || !value) return;

      const radius = parseFloat(value.radius);
      const threshold = parseFloat(value.threshold);
      const mode: 'bright' | 'dark' | 'both' =
        value.which === 'Bright' ? 'bright' :
        value.which === 'Dark' ? 'dark' : 'both';

      const data = getImageData();
      if (!data) return;
      const { ctx, imageData, canvas } = data;

      applyAndUpdate(imageData, ctx, canvas, (img) =>
        processRemoveOutliers(img, radius, threshold, mode)
      );
    };

    const handleRemoveNaNs = async () => {
      const bitDepth = getCurrentBitDepth?.() ?? 8;

      if (bitDepth !== 32) {
        await Swal.fire({
          icon: 'info',
          title: 'Remove NaNs',
          text: 'Only applies to 32-bit images.',
          width: 340,
          confirmButtonText: 'OK',
        });
        return;
      }

      const data = getImageData();
      if (!data) return;
      const { ctx, imageData, canvas } = data;

      applyAndUpdate(imageData, ctx, canvas, (img) => processRemoveNaNs(img));
    };

    const handleNoiseProcess = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string }>;
      const { action } = customEvent.detail;
      if (!NOISE_ACTIONS.has(action)) return;

      if (action === 'add-specified-noise') {
        void handleAddSpecifiedNoise();
        return;
      }
      if (action === 'remove-outliers') {
        void handleRemoveOutliers();
        return;
      }
      if (action === 'remove-nans') {
        void handleRemoveNaNs();
        return;
      }

      const data = getImageData();
      if (!data) return;
      const { ctx, imageData, canvas } = data;

      let fn: ((img: ImageData) => ImageData | null) | null = null;

      switch (action) {
        case 'add-noise':
          fn = processAddNoise;
          break;
        case 'salt-and-pepper':
          fn = processSaltAndPepperNoise;
          break;
        case 'despeckle':
          fn = processDespeckle;
          break;
        default:
          return;
      }

      if (!fn) return;
      applyAndUpdate(imageData, ctx, canvas, fn);
    };

    window.addEventListener('process-image', handleNoiseProcess);
    return () => {
      window.removeEventListener('process-image', handleNoiseProcess);
    };
  }, [getImageData, updateImageFromCanvas, getCurrentBitDepth]);
};

export default useNoiseEvents;
