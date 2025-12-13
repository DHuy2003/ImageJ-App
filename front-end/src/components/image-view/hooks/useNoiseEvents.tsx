import { useEffect, useRef, useState } from 'react';
import {
  processAddNoise,
  processAddSpecifiedNoise,
  processSaltAndPepperNoise,
  processDespeckle,
  processRemoveOutliers,
  processRemoveNaNs,
  dispatchNotification,
  type OutlierMode,
} from '../../../utils/nav-bar/processUtils';
import GaussianNoiseDialog from '../dialogs/noise/GaussianNoiseDialog';
import SaltPepperNoiseDialog from '../dialogs/noise/SaltPepperNoiseDialog';
import RemoveOutliersDialog from '../dialogs/noise/RemoveOutliersDialog';
import RemoveNaNsDialog from '../dialogs/noise/RemoveNaNsDialog';

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

const cloneImageData = (src: ImageData): ImageData =>
  new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);

const useNoiseEvents = (
  getImageData: GetImageDataFn,
  updateImageFromCanvas: UpdateFromCanvasFn,
  getCurrentBitDepth?: GetBitDepthFn
) => {
  const [gaussianOpen, setGaussianOpen] = useState(false);
  const [gaussianStdDev, setGaussianStdDev] = useState(25);
  const [gaussianPreview, setGaussianPreview] = useState(false);
  const [gaussianBase, setGaussianBase] = useState<ImageData | null>(null);

  const applyGaussianFromBase = (saveToHistory: boolean, stdDevValue?: number) => {
    if (!gaussianBase) return;
    const std = stdDevValue ?? gaussianStdDev;
    if (!isFinite(std) || std <= 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gaussianBase.width;
    tempCanvas.height = gaussianBase.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    const fresh = cloneImageData(gaussianBase);
    const processed = processAddSpecifiedNoise(fresh, { stdDev: std });
    if (!processed) return;

    ctx.putImageData(processed, 0, 0);
    updateImageFromCanvas(tempCanvas, saveToHistory);
  };

  const restoreGaussianBase = () => {
    if (!gaussianBase) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gaussianBase.width;
    tempCanvas.height = gaussianBase.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(gaussianBase, 0, 0);
    updateImageFromCanvas(tempCanvas, false);
  };

  const onGaussianStdDevChange = (v: number) => {
    setGaussianStdDev(v);
    if (gaussianPreview) applyGaussianFromBase(false, v);
  };
  const onGaussianTogglePreview = (enabled: boolean) => {
    setGaussianPreview(enabled);
    if (enabled) applyGaussianFromBase(false);
    else restoreGaussianBase();
  };
  const onGaussianApply = () => {
    applyGaussianFromBase(true);
    setGaussianOpen(false);
    setGaussianPreview(false);
    setGaussianBase(null);
  };
  const onGaussianCancel = () => {
    if (gaussianPreview) restoreGaussianBase();
    setGaussianOpen(false);
    setGaussianPreview(false);
    setGaussianBase(null);
  };

  const [spOpen, setSpOpen] = useState(false);
  const [spDensity, setSpDensity] = useState(5); // %
  const [spPreview, setSpPreview] = useState(false);
  const [spBase, setSpBase] = useState<ImageData | null>(null);

  const applySaltPepperFromBase = (save: boolean, densityPercent?: number) => {
    if (!spBase) return;
    const density = (densityPercent ?? spDensity) / 100;
    if (!isFinite(density) || density <= 0 || density > 1) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = spBase.width;
    tempCanvas.height = spBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;

    const fresh = cloneImageData(spBase);
    const processed = processSaltAndPepperNoise(fresh, density);
    if (!processed) return;

    ctx.putImageData(processed, 0, 0);
    updateImageFromCanvas(tempCanvas, save);
  };
  const restoreSaltPepperBase = () => {
    if (!spBase) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = spBase.width;
    tempCanvas.height = spBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;
    ctx.putImageData(spBase, 0, 0);
    updateImageFromCanvas(tempCanvas, false);
  };
  const onSpDensityChange = (v: number) => {
    setSpDensity(v);
    if (spPreview) applySaltPepperFromBase(false, v);
  };
  const onSpTogglePreview = (enabled: boolean) => {
    setSpPreview(enabled);
    if (enabled) applySaltPepperFromBase(false);
    else restoreSaltPepperBase();
  };
  const onSpApply = () => {
    applySaltPepperFromBase(true);
    setSpOpen(false);
    setSpPreview(false);
    setSpBase(null);
  };
  const onSpCancel = () => {
    if (spPreview) restoreSaltPepperBase();
    setSpOpen(false);
    setSpPreview(false);
    setSpBase(null);
  };

  const [roOpen, setRoOpen] = useState(false);
  const [roRadius, setRoRadius] = useState(2);
  const [roThreshold, setRoThreshold] = useState(50);
  const [roMode, setRoMode] = useState<OutlierMode>('bright');
  const [roPreview, setRoPreview] = useState(false);
  const [roBase, setRoBase] = useState<ImageData | null>(null);

  const roTimerRef = useRef<number | null>(null);
  const roPendingRef = useRef<{ r: number; t: number; m: OutlierMode } | null>(null);
  const DEBOUNCE_MS = 300;

  const scheduleIdle = (fn: () => void) => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: (deadline: { timeRemaining: () => number }) => void) => number)
      | undefined;
    if (ric) ric(() => fn());
    else setTimeout(fn, 0);
  };

  const flushRemoveOutliersPreview = () => {
    if (!roBase || !roPendingRef.current) return;

    const { r, t, m } = roPendingRef.current;
    roPendingRef.current = null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roBase.width;
    tempCanvas.height = roBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;

    const fresh = cloneImageData(roBase);
    const processed = processRemoveOutliers(fresh, r, t, m);
    if (!processed) return;

    ctx.putImageData(processed, 0, 0);
    updateImageFromCanvas(tempCanvas, false);
  };

  const scheduleRemoveOutliersPreview = (r: number, t: number, m: OutlierMode) => {
    roPendingRef.current = { r, t, m };
    if (roTimerRef.current !== null) {
      window.clearTimeout(roTimerRef.current);
    }
    roTimerRef.current = window.setTimeout(() => {
      roTimerRef.current = null;
      scheduleIdle(flushRemoveOutliersPreview);
    }, DEBOUNCE_MS);
  };

  const applyRemoveOutliersFromBase = (
    save: boolean,
    r?: number,
    t?: number,
    m?: OutlierMode
  ) => {
    if (!roBase) return;
    const radius = r ?? roRadius;
    const threshold = t ?? roThreshold;
    const mode = m ?? roMode;

    if (!isFinite(radius) || radius <= 0) return;
    if (!isFinite(threshold) || threshold < 0) return;

    if (!save && roPreview) {
      scheduleRemoveOutliersPreview(radius, threshold, mode);
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roBase.width;
    tempCanvas.height = roBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;

    const fresh = cloneImageData(roBase);
    const processed = processRemoveOutliers(fresh, radius, threshold, mode);
    if (!processed) return;

    ctx.putImageData(processed, 0, 0);
    updateImageFromCanvas(tempCanvas, save);
  };

  const restoreRemoveOutliersBase = () => {
    if (!roBase) return;
    if (roTimerRef.current !== null) {
      window.clearTimeout(roTimerRef.current);
      roTimerRef.current = null;
    }
    roPendingRef.current = null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roBase.width;
    tempCanvas.height = roBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;
    ctx.putImageData(roBase, 0, 0);
    updateImageFromCanvas(tempCanvas, false);
  };

  const onRoRadiusChange = (v: number) => {
    setRoRadius(v);
    if (roPreview) applyRemoveOutliersFromBase(false, v, undefined, undefined);
  };
  const onRoThresholdChange = (v: number) => {
    setRoThreshold(v);
    if (roPreview) applyRemoveOutliersFromBase(false, undefined, v, undefined);
  };
  const onRoModeChange = (v: OutlierMode) => {
    setRoMode(v);
    if (roPreview) applyRemoveOutliersFromBase(false, undefined, undefined, v);
  };
  const onRoTogglePreview = (enabled: boolean) => {
    setRoPreview(enabled);

    if (enabled) {
      const radius = roRadius;
      const threshold = roThreshold;
      const mode = roMode;

      if (!isFinite(radius) || radius <= 0) return;
      if (!isFinite(threshold) || threshold < 0) return;

      scheduleRemoveOutliersPreview(radius, threshold, mode);
    } else {
      restoreRemoveOutliersBase();
    }
  };
  const onRoApply = () => {
    if (roTimerRef.current !== null) {
      window.clearTimeout(roTimerRef.current);
      roTimerRef.current = null;
    }
    roPendingRef.current = null;

    applyRemoveOutliersFromBase(true);
    setRoOpen(false); setRoPreview(false); setRoBase(null);
  };
  const onRoCancel = () => {
    if (roPreview) restoreRemoveOutliersBase();
    setRoOpen(false); setRoPreview(false); setRoBase(null);
  };

  const [rnOpen, setRnOpen] = useState(false);
  const [rnRadius, setRnRadius] = useState(2);
  const [rnPreview, setRnPreview] = useState(false);
  const [rnBase, setRnBase] = useState<ImageData | null>(null);

  const applyRemoveNaNsFromBase = (save: boolean) => {
    if (!rnBase) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rnBase.width;
    tempCanvas.height = rnBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;

    const fresh = cloneImageData(rnBase);
    const processed = processRemoveNaNs(fresh);
    if (!processed) return;

    ctx.putImageData(processed, 0, 0);
    updateImageFromCanvas(tempCanvas, save);
  };
  const restoreRemoveNaNsBase = () => {
    if (!rnBase) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rnBase.width;
    tempCanvas.height = rnBase.height;
    const ctx = tempCanvas.getContext('2d'); if (!ctx) return;
    ctx.putImageData(rnBase, 0, 0);
    updateImageFromCanvas(tempCanvas, false);
  };
  const onRnRadiusChange = (v: number) => {
    setRnRadius(v);
    if (rnPreview) applyRemoveNaNsFromBase(false);
  };
  const onRnTogglePreview = (enabled: boolean) => {
    setRnPreview(enabled);
    if (enabled) applyRemoveNaNsFromBase(false);
    else restoreRemoveNaNsBase();
  };
  const onRnApply = () => {
    applyRemoveNaNsFromBase(true);
    setRnOpen(false); setRnPreview(false); setRnBase(null);
  };
  const onRnCancel = () => {
    if (rnPreview) restoreRemoveNaNsBase();
    setRnOpen(false); setRnPreview(false); setRnBase(null);
  };

  useEffect(() => {
    const handleNoiseProcess = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: string }>).detail;
      if (!NOISE_ACTIONS.has(action)) return;

      let baseForNext: ImageData | null = null;

      if (gaussianOpen && gaussianBase) {
        baseForNext = gaussianBase;
        if (gaussianPreview) {
          restoreGaussianBase();
        }
        setGaussianOpen(false);
        setGaussianPreview(false);
        setGaussianBase(null);
      } else if (spOpen && spBase) {
        baseForNext = spBase;
        if (spPreview) {
          restoreSaltPepperBase();
        }
        setSpOpen(false);
        setSpPreview(false);
        setSpBase(null);
      } else if (roOpen && roBase) {
        baseForNext = roBase;
        if (roPreview) {
          restoreRemoveOutliersBase();
        }
        setRoOpen(false);
        setRoPreview(false);
        setRoBase(null);
      } else if (rnOpen && rnBase) {
        baseForNext = rnBase;
        if (rnPreview) {
          restoreRemoveNaNsBase();
        }
        setRnOpen(false);
        setRnPreview(false);
        setRnBase(null);
      }

      const getBaseImage = (): ImageData | null => {
        if (baseForNext) return baseForNext;
        const data = getImageData();
        return data?.imageData ?? null;
      };

      if (action === 'add-specified-noise') {
        const base = getBaseImage();
        if (!base) return;
        setGaussianBase(base);
        setGaussianStdDev(25);
        setGaussianPreview(false);
        setGaussianOpen(true);
        return;
      }

      if (action === 'salt-and-pepper') {
        const base = getBaseImage();
        if (!base) return;
        setSpBase(base);
        setSpDensity(5);
        setSpPreview(false);
        setSpOpen(true);
        return;
      }

      if (action === 'remove-outliers') {
        const base = getBaseImage();
        if (!base) return;
        setRoBase(base);
        setRoRadius(2);
        setRoThreshold(50);
        setRoMode('bright');
        setRoPreview(false);
        setRoOpen(true);
        return;
      }

      if (action === 'remove-nans') {
        const bitDepth = getCurrentBitDepth?.() ?? 8;
        if (bitDepth !== 32) {
          dispatchNotification('This only applies to 32-bit images.', 'info');
          return;
        }

        const base = getBaseImage();
        if (!base) return;
        setRnBase(base);
        setRnRadius(2);
        setRnPreview(false);
        setRnOpen(true);
        return;
      }

      if (action === 'add-noise') {
        const bitDepth = getCurrentBitDepth?.() ?? 8;
        const stdDev = 25 * (bitDepth / 8);
        const base = getBaseImage();
        if (!base) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = base.width;
        tempCanvas.height = base.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        const fresh = cloneImageData(base);
        const processed = processAddNoise(fresh, stdDev);
        if (!processed) return;

        ctx.putImageData(processed, 0, 0);
        updateImageFromCanvas(tempCanvas);
        return;
      }

      if (action === 'despeckle') {
        const base = getBaseImage();
        if (!base) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = base.width;
        tempCanvas.height = base.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        const fresh = cloneImageData(base);
        const processed = processDespeckle(fresh);
        if (!processed) return;

        ctx.putImageData(processed, 0, 0);
        updateImageFromCanvas(tempCanvas);
        return;
      }
    };

    window.addEventListener('process-image', handleNoiseProcess);
    return () => window.removeEventListener('process-image', handleNoiseProcess);
  }, [
    getImageData,
    updateImageFromCanvas,
    getCurrentBitDepth,
    gaussianOpen,
    gaussianBase,
    gaussianPreview,
    spOpen,
    spBase,
    spPreview,
    roOpen,
    roBase,
    roPreview,
    rnOpen,
    rnBase,
    rnPreview,
  ]);

  return (
    <>
      <GaussianNoiseDialog
        isOpen={gaussianOpen}
        stdDev={gaussianStdDev}
        previewEnabled={gaussianPreview}
        onStdDevChange={onGaussianStdDevChange}
        onTogglePreview={onGaussianTogglePreview}
        onApply={onGaussianApply}
        onCancel={onGaussianCancel}
      />
      <SaltPepperNoiseDialog
        isOpen={spOpen}
        densityPercent={spDensity}
        previewEnabled={spPreview}
        onDensityChange={onSpDensityChange}
        onTogglePreview={onSpTogglePreview}
        onApply={onSpApply}
        onCancel={onSpCancel}
      />
      <RemoveOutliersDialog
        isOpen={roOpen}
        radius={roRadius}
        threshold={roThreshold}
        mode={roMode}
        previewEnabled={roPreview}
        onRadiusChange={onRoRadiusChange}
        onThresholdChange={onRoThresholdChange}
        onModeChange={onRoModeChange}
        onTogglePreview={onRoTogglePreview}
        onApply={onRoApply}
        onCancel={onRoCancel}
      />
      <RemoveNaNsDialog
        isOpen={rnOpen}
        radius={rnRadius}
        previewEnabled={rnPreview}
        onRadiusChange={onRnRadiusChange}
        onTogglePreview={onRnTogglePreview}
        onApply={onRnApply}
        onCancel={onRnCancel}
      />
    </>
  );
};

export default useNoiseEvents;
