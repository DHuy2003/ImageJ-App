import { useEffect, useRef, useState } from 'react';
import type { ImageInfo } from '../../../types/image';
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
type UpdateFromCanvasFn = (
  canvas: HTMLCanvasElement,
  saveToHistory?: boolean,
  onDone?: (newUrl: string, blob: Blob) => void
) => void;

type GetBitDepthFn = () => number | undefined;
type PushUndoFn = (urlOverride?: string | null) => void;

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

const imageDataToCanvas = (img: ImageData) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(img, 0, 0);
  return { canvas, ctx };
};

const useNoiseEvents = (
  getImageData: GetImageDataFn,
  updateImageFromCanvas: UpdateFromCanvasFn,
  getCurrentBitDepth?: GetBitDepthFn,
  pushUndo?: PushUndoFn,
  currentImageURL?: string | null,
  setVisibleImages?: React.Dispatch<React.SetStateAction<ImageInfo[]>>,
  currentIndex?: number
) => {
  const commitToGallery = (newUrl: string, blob: Blob, canvas: HTMLCanvasElement) => {
    if (!setVisibleImages || currentIndex === undefined) return;

    setVisibleImages(prev =>
      prev.map((img, i) => {
        if (i !== currentIndex) return img;

        const isTransientUrl = (u: string) => u.startsWith('blob:') || u.startsWith('data:');

        const patch: Partial<ImageInfo> = {
          size: blob.size,
          width: canvas.width,
          height: canvas.height,
          last_edited_on: new Date().toISOString(),
          ...(isTransientUrl(newUrl) ? {} : { edited_url: newUrl }),
        };

        return { 
          ...img, 
          ...patch, 
          url: newUrl,
          cropped_url: newUrl as any,
        };

      })
    );
  };

  // 1) Gaussian (specified)
  const [gaussianOpen, setGaussianOpen] = useState(false);
  const [gaussianStdDev, setGaussianStdDev] = useState(25);
  const [gaussianPreview, setGaussianPreview] = useState(false);
  const [gaussianBase, setGaussianBase] = useState<ImageData | null>(null);
  const gaussianBaseUrlRef = useRef<string | null>(null);
  const gaussianLastPreviewImageRef = useRef<ImageData | null>(null);
  const gaussianLastPreviewUrlRef = useRef<string | null>(null);
  const gaussianPreviewTokenRef = useRef<number>(0);
  const gaussianStdDevRef = useRef<number>(25);

  const runGaussianProcess = (base: ImageData, stdDev: number) => {
    const fresh = cloneImageData(base);
    return processAddSpecifiedNoise(fresh, { stdDev });
  };

  const gaussianPreviewRender = (stdDevValue?: number) => {
    if (!gaussianBase) return;

    const std = stdDevValue ?? gaussianStdDevRef.current;
    if (!isFinite(std) || std <= 0) return;

    const processed = runGaussianProcess(gaussianBase, std);
    if (!processed) return;

    gaussianLastPreviewImageRef.current = cloneImageData(processed);

    const temp = imageDataToCanvas(processed);
    if (!temp) return;

    const token = ++gaussianPreviewTokenRef.current;

    updateImageFromCanvas(temp.canvas, false, (newUrl) => {
      if (token !== gaussianPreviewTokenRef.current) return;
      gaussianLastPreviewUrlRef.current = newUrl;
    });
  };

  const restoreGaussianBase = () => {
    if (!gaussianBase) return;
    const temp = imageDataToCanvas(gaussianBase);
    if (!temp) return;
    updateImageFromCanvas(temp.canvas, false, () => {
      gaussianLastPreviewUrlRef.current = null;
    });
  };

  const onGaussianStdDevChange = (v: number) => {
    gaussianStdDevRef.current = v;
    setGaussianStdDev(v);
    if (gaussianPreview) gaussianPreviewRender(v);
  };

  const onGaussianTogglePreview = (enabled: boolean) => {
    setGaussianPreview(enabled);
    if (enabled) {
      gaussianPreviewRender();
    } else {
      gaussianLastPreviewImageRef.current = null;
      gaussianLastPreviewUrlRef.current = null;
      gaussianPreviewTokenRef.current = 0;
      restoreGaussianBase();
    }
  };

  const onGaussianApply = () => {
    if (!gaussianBase) return;

    let imageToCommit: ImageData | null = null;

    if (gaussianPreview) {
      if (currentImageURL && gaussianLastPreviewUrlRef.current === currentImageURL) {
        if (gaussianLastPreviewImageRef.current) {
          imageToCommit = cloneImageData(gaussianLastPreviewImageRef.current);
        }
      }

      if (!imageToCommit) {
        const live = getImageData();
        if (live?.imageData) imageToCommit = cloneImageData(live.imageData);
      }
    }

    if (!imageToCommit) {
      const std = gaussianStdDevRef.current;
      const processed = runGaussianProcess(gaussianBase, std);
      if (!processed) return;
      imageToCommit = processed;
    }

    const temp = imageDataToCanvas(imageToCommit);
    if (!temp) return;

    pushUndo?.(gaussianBaseUrlRef.current);
    updateImageFromCanvas(temp.canvas, false, (newUrl, blob) => {
      commitToGallery(newUrl, blob, temp.canvas);
    });

    setGaussianOpen(false);
    setGaussianPreview(false);
    setGaussianBase(null);

    gaussianLastPreviewImageRef.current = null;
    gaussianLastPreviewUrlRef.current = null;
    gaussianPreviewTokenRef.current = 0;
    gaussianBaseUrlRef.current = null;
  };

  const onGaussianCancel = () => {
    if (gaussianPreview) restoreGaussianBase();
    setGaussianOpen(false);
    setGaussianPreview(false);
    setGaussianBase(null);
    gaussianLastPreviewImageRef.current = null;
    gaussianLastPreviewUrlRef.current = null;
    gaussianPreviewTokenRef.current = 0;
    gaussianBaseUrlRef.current = null;
  };

  // 2) Salt & Pepper 
  const [spOpen, setSpOpen] = useState(false);
  const [spDensity, setSpDensity] = useState(5); // %
  const [spPreview, setSpPreview] = useState(false);
  const [spBase, setSpBase] = useState<ImageData | null>(null);

  const spBaseUrlRef = useRef<string | null>(null);

  const spLastPreviewImageRef = useRef<ImageData | null>(null);
  const spLastPreviewUrlRef = useRef<string | null>(null);
  const spPreviewTokenRef = useRef<number>(0);

  const spDensityRef = useRef<number>(5);

  const runSaltPepperProcess = (base: ImageData, densityPercent: number) => {
    const density = densityPercent / 100;
    const fresh = cloneImageData(base);
    return processSaltAndPepperNoise(fresh, density);
  };

  const saltPepperPreviewRender = (densityPercent?: number) => {
    if (!spBase) return;

    const densityPct = densityPercent ?? spDensityRef.current;
    const density = densityPct / 100;
    if (!isFinite(density) || density <= 0 || density > 1) return;

    const processed = runSaltPepperProcess(spBase, densityPct);
    if (!processed) return;

    spLastPreviewImageRef.current = cloneImageData(processed);

    const temp = imageDataToCanvas(processed);
    if (!temp) return;

    const token = ++spPreviewTokenRef.current;

    updateImageFromCanvas(temp.canvas, false, (newUrl) => {
      if (token !== spPreviewTokenRef.current) return;
      spLastPreviewUrlRef.current = newUrl;
    });
  };

  const restoreSaltPepperBase = () => {
    if (!spBase) return;
    const temp = imageDataToCanvas(spBase);
    if (!temp) return;
    updateImageFromCanvas(temp.canvas, false, () => {
      spLastPreviewUrlRef.current = null;
    });
  };

  const onSpDensityChange = (v: number) => {
    spDensityRef.current = v;
    setSpDensity(v);
    if (spPreview) saltPepperPreviewRender(v);
  };

  const onSpTogglePreview = (enabled: boolean) => {
    setSpPreview(enabled);
    if (enabled) {
      saltPepperPreviewRender();
    } else {
      spLastPreviewImageRef.current = null;
      spLastPreviewUrlRef.current = null;
      spPreviewTokenRef.current = 0;
      restoreSaltPepperBase();
    }
  };

  const onSpApply = () => {
    if (!spBase) return;

    let imageToCommit: ImageData | null = null;

    if (spPreview) {
      if (currentImageURL && spLastPreviewUrlRef.current === currentImageURL) {
        if (spLastPreviewImageRef.current) imageToCommit = cloneImageData(spLastPreviewImageRef.current);
      }

      if (!imageToCommit) {
        const live = getImageData();
        if (live?.imageData) imageToCommit = cloneImageData(live.imageData);
      }
    }

    if (!imageToCommit) {
      const densityPct = spDensityRef.current;
      const density = densityPct / 100;
      if (!isFinite(density) || density <= 0 || density > 1) return;

      const processed = runSaltPepperProcess(spBase, densityPct);
      if (!processed) return;
      imageToCommit = processed;
    }

    const temp = imageDataToCanvas(imageToCommit);
    if (!temp) return;

    pushUndo?.(spBaseUrlRef.current);
    updateImageFromCanvas(temp.canvas, false, (newUrl, blob) => {
      commitToGallery(newUrl, blob, temp.canvas);
    });

    setSpOpen(false);
    setSpPreview(false);
    setSpBase(null);

    spLastPreviewImageRef.current = null;
    spLastPreviewUrlRef.current = null;
    spPreviewTokenRef.current = 0;
    spBaseUrlRef.current = null;
  };

  const onSpCancel = () => {
    if (spPreview) restoreSaltPepperBase();
    setSpOpen(false);
    setSpPreview(false);
    setSpBase(null);

    spLastPreviewImageRef.current = null;
    spLastPreviewUrlRef.current = null;
    spPreviewTokenRef.current = 0;
    spBaseUrlRef.current = null;
  };

  // 3) Remove Outliers
  const [roOpen, setRoOpen] = useState(false);
  const [roRadius, setRoRadius] = useState(2);
  const [roThreshold, setRoThreshold] = useState(50);
  const [roMode, setRoMode] = useState<OutlierMode>('bright');
  const [roPreview, setRoPreview] = useState(false);
  const [roBase, setRoBase] = useState<ImageData | null>(null);

  const roBaseUrlRef = useRef<string | null>(null);

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

    const fresh = cloneImageData(roBase);
    const processed = processRemoveOutliers(fresh, r, t, m);
    if (!processed) return;

    const temp = imageDataToCanvas(processed);
    if (!temp) return;
    updateImageFromCanvas(temp.canvas, false);
  };

  const scheduleRemoveOutliersPreview = (r: number, t: number, m: OutlierMode) => {
    roPendingRef.current = { r, t, m };
    if (roTimerRef.current !== null) window.clearTimeout(roTimerRef.current);
    roTimerRef.current = window.setTimeout(() => {
      roTimerRef.current = null;
      scheduleIdle(flushRemoveOutliersPreview);
    }, DEBOUNCE_MS);
  };

  const applyRemoveOutliersFromBase = (save: boolean, r?: number, t?: number, m?: OutlierMode) => {
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

    const fresh = cloneImageData(roBase);
    const processed = processRemoveOutliers(fresh, radius, threshold, mode);
    if (!processed) return;

    const temp = imageDataToCanvas(processed);
    if (!temp) return;

    if (save) {
      pushUndo?.(roBaseUrlRef.current);
      updateImageFromCanvas(temp.canvas, false, (newUrl, blob) => {
        commitToGallery(newUrl, blob, temp.canvas);
      });
    } else {
      updateImageFromCanvas(temp.canvas, false);
    }
  };

  const restoreRemoveOutliersBase = () => {
    if (!roBase) return;
    if (roTimerRef.current !== null) {
      window.clearTimeout(roTimerRef.current);
      roTimerRef.current = null;
    }
    roPendingRef.current = null;

    const temp = imageDataToCanvas(roBase);
    if (!temp) return;
    updateImageFromCanvas(temp.canvas, false);
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
    if (enabled) scheduleRemoveOutliersPreview(roRadius, roThreshold, roMode);
    else restoreRemoveOutliersBase();
  };

  const onRoApply = () => {
    if (roTimerRef.current !== null) window.clearTimeout(roTimerRef.current);
    roTimerRef.current = null;
    roPendingRef.current = null;

    applyRemoveOutliersFromBase(true);
    setRoOpen(false);
    setRoPreview(false);
    setRoBase(null);
    roBaseUrlRef.current = null;
  };

  const onRoCancel = () => {
    if (roPreview) restoreRemoveOutliersBase();
    setRoOpen(false);
    setRoPreview(false);
    setRoBase(null);
    roBaseUrlRef.current = null;
  };

  // 4) Remove NaNs
  const [rnOpen, setRnOpen] = useState(false);
  const [rnRadius, setRnRadius] = useState(2);
  const [rnPreview, setRnPreview] = useState(false);
  const [rnBase, setRnBase] = useState<ImageData | null>(null);

  const rnBaseUrlRef = useRef<string | null>(null);

  const applyRemoveNaNsFromBase = (save: boolean) => {
    if (!rnBase) return;

    const fresh = cloneImageData(rnBase);
    const processed = processRemoveNaNs(fresh);
    if (!processed) return;

    const temp = imageDataToCanvas(processed);
    if (!temp) return;

    if (save) {
      pushUndo?.(rnBaseUrlRef.current);
      updateImageFromCanvas(temp.canvas, false, (newUrl, blob) => {
        commitToGallery(newUrl, blob, temp.canvas);
      });
    } else {
      updateImageFromCanvas(temp.canvas, false);
    }
  };

  const restoreRemoveNaNsBase = () => {
    if (!rnBase) return;
    const temp = imageDataToCanvas(rnBase);
    if (!temp) return;
    updateImageFromCanvas(temp.canvas, false);
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
    setRnOpen(false);
    setRnPreview(false);
    setRnBase(null);
    rnBaseUrlRef.current = null;
  };
  const onRnCancel = () => {
    if (rnPreview) restoreRemoveNaNsBase();
    setRnOpen(false);
    setRnPreview(false);
    setRnBase(null);
    rnBaseUrlRef.current = null;
  };

  useEffect(() => {
    const handleNoiseProcess = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: string }>).detail;
      if (!NOISE_ACTIONS.has(action)) return;

      let baseForNext: ImageData | null = null;

      // close any currently open noise dialogs and restore base if previewing
      if (gaussianOpen && gaussianBase) {
        baseForNext = gaussianBase;
        if (gaussianPreview) restoreGaussianBase();
        setGaussianOpen(false);
        setGaussianPreview(false);
        setGaussianBase(null);
        gaussianLastPreviewImageRef.current = null;
        gaussianLastPreviewUrlRef.current = null;
        gaussianPreviewTokenRef.current = 0;
        gaussianBaseUrlRef.current = null;
      } else if (spOpen && spBase) {
        baseForNext = spBase;
        if (spPreview) restoreSaltPepperBase();
        setSpOpen(false);
        setSpPreview(false);
        setSpBase(null);
        spLastPreviewImageRef.current = null;
        spLastPreviewUrlRef.current = null;
        spPreviewTokenRef.current = 0;
        spBaseUrlRef.current = null;
      } else if (roOpen && roBase) {
        baseForNext = roBase;
        if (roPreview) restoreRemoveOutliersBase();
        setRoOpen(false);
        setRoPreview(false);
        setRoBase(null);
        roBaseUrlRef.current = null;
      } else if (rnOpen && rnBase) {
        baseForNext = rnBase;
        if (rnPreview) restoreRemoveNaNsBase();
        setRnOpen(false);
        setRnPreview(false);
        setRnBase(null);
        rnBaseUrlRef.current = null;
      }

      const getBaseImage = (): ImageData | null => {
        if (baseForNext) return baseForNext;
        const data = getImageData();
        return data?.imageData ?? null;
      };

      if (action === 'add-specified-noise') {
        const base = getBaseImage();
        if (!base) return;

        gaussianBaseUrlRef.current = currentImageURL ?? null;
        gaussianStdDevRef.current = 25;

        setGaussianBase(base);
        setGaussianStdDev(25);
        setGaussianPreview(false);
        setGaussianOpen(true);

        gaussianLastPreviewImageRef.current = null;
        gaussianLastPreviewUrlRef.current = null;
        gaussianPreviewTokenRef.current = 0;
        return;
      }

      if (action === 'salt-and-pepper') {
        const base = getBaseImage();
        if (!base) return;

        spBaseUrlRef.current = currentImageURL ?? null;
        spDensityRef.current = 5;

        setSpBase(base);
        setSpDensity(5);
        setSpPreview(false);
        setSpOpen(true);

        spLastPreviewImageRef.current = null;
        spLastPreviewUrlRef.current = null;
        spPreviewTokenRef.current = 0;
        return;
      }

      if (action === 'remove-outliers') {
        const base = getBaseImage();
        if (!base) return;

        roBaseUrlRef.current = currentImageURL ?? null;

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

        rnBaseUrlRef.current = currentImageURL ?? null;

        setRnBase(base);
        setRnRadius(2);
        setRnPreview(false);
        setRnOpen(true);
        return;
      }

      // immediate actions (no dialog)
      if (action === 'add-noise') {
        const bitDepth = getCurrentBitDepth?.() ?? 8;
        const stdDev = 25 * (bitDepth / 8);
        const base = getBaseImage();
        if (!base) return;

        const fresh = cloneImageData(base);
        const processed = processAddNoise(fresh, stdDev);
        if (!processed) return;

        const temp = imageDataToCanvas(processed);
        if (!temp) return;

        updateImageFromCanvas(temp.canvas, true, (newUrl, blob) => {
          commitToGallery(newUrl, blob, temp.canvas);
        });
        return;
      }

      if (action === 'despeckle') {
        const base = getBaseImage();
        if (!base) return;

        const fresh = cloneImageData(base);
        const processed = processDespeckle(fresh);
        if (!processed) return;

        const temp = imageDataToCanvas(processed);
        if (!temp) return;

        updateImageFromCanvas(temp.canvas, true, (newUrl, blob) => {
          commitToGallery(newUrl, blob, temp.canvas);
        });
        return;
      }
    };

    window.addEventListener('process-image', handleNoiseProcess);
    return () => window.removeEventListener('process-image', handleNoiseProcess);
  }, [
    getImageData,
    updateImageFromCanvas,
    getCurrentBitDepth,
    pushUndo,
    currentImageURL,
    setVisibleImages,
    currentIndex,
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
