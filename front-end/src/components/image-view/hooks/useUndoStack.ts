import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ImageInfo, UndoEntry } from '../../../types/image';

type UseUndoStackParams = {
  visibleImages: ImageInfo[];
  currentIndex: number;
  currentFile: ImageInfo | null;
  currentImageURL: string | null;
  setCurrentImageURL: (url: string | null) => void;
  setVisibleImages: Dispatch<SetStateAction<ImageInfo[]>>;
};

const useUndoStack = ({
  visibleImages,
  currentIndex,
  currentFile,
  currentImageURL,
  setCurrentImageURL,
  setVisibleImages,
}: UseUndoStackParams) => {
  const [undostack , setUndoStack] = useState<UndoEntry[][]>(() =>
    visibleImages.map(() => [] as UndoEntry[]),
  );

  useEffect(() => {
    setUndoStack(prev => {
      if (prev.length === visibleImages.length) return prev;
      const next = [...prev];
      while (next.length < visibleImages.length) next.push([]);
      while (next.length > visibleImages.length) next.pop();
      return next;
    });
  }, [visibleImages.length]);

  const pushUndo = () => {
    if (!currentImageURL || !currentFile) return;

    const snapshot: UndoEntry = {
      url: currentImageURL,
      width: currentFile.width,
      height: currentFile.height,
      size: currentFile.size,
      bitDepth: currentFile.bitDepth ?? 8,
    };

    setUndoStack(prev => {
      const copy = [...prev];
      if (!copy[currentIndex]) copy[currentIndex] = [];
      copy[currentIndex] = [...copy[currentIndex], snapshot];
      return copy;
    });
  };

  useEffect(() => {
    const onUndo = () => {
      setUndoStack(prev => {
        const copy = [...prev];
        const stack = copy[currentIndex] ?? [];
        if (!stack.length) return prev;

        const newStack = stack.slice(0, -1);
        const restored = stack[stack.length - 1];

        copy[currentIndex] = newStack;

        setCurrentImageURL(restored.url);

        setVisibleImages(prevImgs => {
          const imgsCopy = [...prevImgs];
          const file = imgsCopy[currentIndex];
          if (file) {
            imgsCopy[currentIndex] = {
              ...file,
              cropped_url: restored.url as any,
              width: restored.width,
              height: restored.height,
              size: restored.size,
              bitDepth: restored.bitDepth,
            } as any;
          }
          return imgsCopy;
        });

        return copy;
      });
    };

    window.addEventListener('editUndo', onUndo);
    return () => window.removeEventListener('editUndo', onUndo);
  }, [currentIndex, setCurrentImageURL, setVisibleImages]);

  return { pushUndo };
};

export default useUndoStack;
