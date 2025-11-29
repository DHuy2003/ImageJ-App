import { useEffect, useState } from 'react';
import type { SelectedRoiInfo } from '../../../types/roi';

const useRoiSelection = () => {
  const [selectedRoi, setSelectedRoi] = useState<SelectedRoiInfo>(null);

  useEffect(() => {
    const handler = (
      e: Event,
    ) => {
      const ce = e as CustomEvent<{
        id: number;
        type: 'rect' | 'circle';
        imageRect: { x: number; y: number; width: number; height: number };
      } | null>;

      if (!ce.detail) {
        setSelectedRoi(null);
        return;
      }

      const { type, imageRect } = ce.detail;
      setSelectedRoi({
        type,
        x: imageRect.x,
        y: imageRect.y,
        width: imageRect.width,
        height: imageRect.height,
      });
    };

    window.addEventListener('roiSelection', handler as EventListener);
    return () => window.removeEventListener('roiSelection', handler as EventListener);
  }, []);

  return selectedRoi;
};

export default useRoiSelection;
