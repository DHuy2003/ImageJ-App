import { ChevronLeft, ChevronRight, Eye, EyeOff, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { CropOverlayHandle, RelativeCropRect } from '../../types/crop';
import type { ImageInfo, ImageViewProps, UndoEntry } from '../../types/image';
import { base64ToBytes, formatFileSize } from '../../utils/common/formatFileSize';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import { type RoiTool, type SelectedRoiInfo } from '../../types/roi';
import './ImageView.css';
import useEditEvents from './hooks/useEditEvents';
import { useToolbarToolSelection } from './hooks/useToolbarToolSelection';
import useFileEvents from './hooks/useFileEvents';
import BrushOverlay from '../brush-overlay/BrushOverlay';
import { IMAGES_APPENDED_EVENT } from '../../utils/nav-bar/fileUtils';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

interface CellFeature {
  id: number;
  cell_id: number;
  frame_num: number;
  area: number;
  centroid_row: number;
  centroid_col: number;
  major_axis_length: number;
  minor_axis_length: number;
  max_intensity: number;
  mean_intensity: number;
  min_intensity: number;
  min_row_bb: number;
  min_col_bb: number;
  max_row_bb: number;
  max_col_bb: number;
  delta_x: number | null;
  delta_y: number | null;
  displacement: number | null;
  speed: number | null;
  turning: number | null;
  gmm_state: number | null;
  hmm_state: number | null;
}

// Cluster colors for visualization
const CLUSTER_COLORS = [
  { color: 'rgba(231, 76, 60, 0.5)', border: '#e74c3c', name: 'Red' },
  { color: 'rgba(46, 204, 113, 0.5)', border: '#2ecc71', name: 'Green' },
  { color: 'rgba(52, 152, 219, 0.5)', border: '#3498db', name: 'Blue' },
  { color: 'rgba(241, 196, 15, 0.5)', border: '#f1c40f', name: 'Yellow' },
  { color: 'rgba(155, 89, 182, 0.5)', border: '#9b59b6', name: 'Purple' },
  { color: 'rgba(230, 126, 34, 0.5)', border: '#e67e22', name: 'Orange' },
  { color: 'rgba(26, 188, 156, 0.5)', border: '#1abc9c', name: 'Teal' },
  { color: 'rgba(236, 72, 153, 0.5)', border: '#ec4899', name: 'Pink' },
  { color: 'rgba(99, 102, 241, 0.5)', border: '#6366f1', name: 'Indigo' },
  { color: 'rgba(20, 184, 166, 0.5)', border: '#14b8a6', name: 'Cyan' },
];

const ZOOM_FACTOR = 1.25; // Tỉ lệ phóng to/thu nhỏ
const DEFAULT_ZOOM_LEVEL = 1.0;

// Hàm zoom giữ tâm cố định
const zoomWithCenter = (
  displayEl: HTMLDivElement,
  imgEl: HTMLImageElement,
  oldZoom: number,
  newZoom: number,
  wasScaleToFit: boolean
) => {
  const containerWidth = displayEl.clientWidth;
  const containerHeight = displayEl.clientHeight;
  const padding = 20; // padding trong zoom-mode

  // Kích thước ảnh mới sau zoom
  const newImgWidth = imgEl.naturalWidth * newZoom;
  const newImgHeight = imgEl.naturalHeight * newZoom;

  // Nếu đang từ chế độ fit -> zoom: căn giữa ảnh
  if (wasScaleToFit) {
    requestAnimationFrame(() => {
      // Scroll để tâm ảnh ở tâm container
      const scrollLeft = (newImgWidth + padding * 2 - containerWidth) / 2;
      const scrollTop = (newImgHeight + padding * 2 - containerHeight) / 2;
      displayEl.scrollLeft = Math.max(0, scrollLeft);
      displayEl.scrollTop = Math.max(0, scrollTop);
    });
    return;
  }

  // Kích thước ảnh cũ
  const oldImgWidth = imgEl.naturalWidth * oldZoom;
  const oldImgHeight = imgEl.naturalHeight * oldZoom;

  // Tâm hiện tại của viewport (tính từ góc ảnh, trừ padding)
  const viewCenterX = displayEl.scrollLeft + containerWidth / 2 - padding;
  const viewCenterY = displayEl.scrollTop + containerHeight / 2 - padding;

  // Tính vị trí tương đối trên ảnh (0-1), clamp để không vượt quá
  const relX = Math.max(0, Math.min(1, viewCenterX / oldImgWidth));
  const relY = Math.max(0, Math.min(1, viewCenterY / oldImgHeight));

  // Tính scroll position mới để giữ cùng điểm ở tâm viewport
  const newScrollLeft = relX * newImgWidth + padding - containerWidth / 2;
  const newScrollTop = relY * newImgHeight + padding - containerHeight / 2;

  // Đợi render xong rồi scroll
  requestAnimationFrame(() => {
    displayEl.scrollLeft = Math.max(0, newScrollLeft);
    displayEl.scrollTop = Math.max(0, newScrollTop);
  });
};

const ImageView = ({ imageArray }: ImageViewProps) => {
  const [visibleImages, setVisibleImages] = useState<ImageInfo[]>(imageArray);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentImageURL, setCurrentImageURL] = useState<string | null>(null);
  const currentFile = visibleImages[currentIndex];
  const [isCropping, setIsCropping] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<CropOverlayHandle | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Resizable panel widths
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [showConfirmCrop, setShowConfirmCrop] = useState(false);
  const [cropRectData, setCropRectData] = useState<RelativeCropRect | null>(null);
  const [activeTool, setActiveTool] = useState<RoiTool>('pointer');
  const [selectedRoi, setSelectedRoi] = useState<SelectedRoiInfo>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[][]>(() =>
    imageArray.map(() => [] as UndoEntry[]),
  );
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM_LEVEL);
  const [scaleToFit, setScaleToFit] = useState<boolean>(true);
  const [frameFeatures, setFrameFeatures] = useState<CellFeature[]>([]);
  const [showClustering, setShowClustering] = useState<boolean>(false);
  const [clusteringAvailable, setClusteringAvailable] = useState<boolean>(false);

  useEffect(() => {
    const handleZoomInEvent = () => {
      setZoomLevel(prev => {
        const nextZoom = Math.min(prev * ZOOM_FACTOR, 32.0);
        if (displayRef.current && imgRef.current) {
          zoomWithCenter(displayRef.current, imgRef.current, prev, nextZoom, scaleToFit);
        }
        return nextZoom;
      });
      setScaleToFit(false);
    };

    const handleZoomOutEvent = () => {
      setZoomLevel(prev => {
        const nextZoom = Math.max(prev / ZOOM_FACTOR, 0.1);
        if (displayRef.current && imgRef.current) {
          zoomWithCenter(displayRef.current, imgRef.current, prev, nextZoom, scaleToFit);
        }
        return nextZoom;
      });
      setScaleToFit(false);
    };

    const handleScaleToFitEvent = () => {
      setScaleToFit(prev => {
        if (!prev) {
          setZoomLevel(DEFAULT_ZOOM_LEVEL);
        }
        return !prev;
      });
    };

    window.addEventListener('imageZoomIn', handleZoomInEvent);
    window.addEventListener('imageZoomOut', handleZoomOutEvent);
    window.addEventListener('imageScaleToFit', handleScaleToFitEvent);

    return () => {
      window.removeEventListener('imageZoomIn', handleZoomInEvent);
      window.removeEventListener('imageZoomOut', handleZoomOutEvent);
      window.removeEventListener('imageScaleToFit', handleScaleToFitEvent);
    };
  }, [scaleToFit]);

  
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

  const { cropImage } = useEditEvents({
    imgRef,
    selectedRoi,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
    currentIndex,
    pushUndo,
    setIsCropping,
    setVisibleImages
  });

  useFileEvents({
    imageArray: visibleImages,
    setImageArray: setVisibleImages,
    currentIndex,
    setCurrentIndex,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
  });

  useToolbarToolSelection(setActiveTool);

  useEffect(() => {
    const onImagesAppended = (e: Event) => {
      const ce = e as CustomEvent<ImageInfo[]>;
      const newImages = ce.detail;
      if (!newImages || newImages.length === 0) return;
      setVisibleImages(prev => [...prev, ...newImages]);
    };

    window.addEventListener(IMAGES_APPENDED_EVENT, onImagesAppended as EventListener);
    return () => {
      window.removeEventListener(IMAGES_APPENDED_EVENT, onImagesAppended as EventListener);
    };
  }, []);

  useEffect(() => {
    setVisibleImages(imageArray);
    setCurrentIndex(0);
    setCurrentImageURL(null);
  }, [imageArray]);

  useEffect(() => {
    setUndoStack(prev => {
      if (prev.length === visibleImages.length) return prev;
      const next = [...prev];
      while (next.length < visibleImages.length) next.push([]);
      while (next.length > visibleImages.length) next.pop();
      return next;
    });
  }, [visibleImages.length]);

  useEffect(() => {
    const handler = (e: Event) => {
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

  useEffect(() => {
    if (currentFile) {
      if (currentFile.cropped_url) {
        setCurrentImageURL(currentFile.cropped_url);
      } else if (currentFile.url) {
        setCurrentImageURL(currentFile.url);
      }
    }
  }, [currentFile, currentIndex]);

  // Fetch features for the current frame
  useEffect(() => {
    const fetchFrameFeatures = async () => {
      if (!currentFile?.id) {
        setFrameFeatures([]);
        setClusteringAvailable(false);
        return;
      }
      try {
        const response = await axios.get(`${API_BASE_URL}/features/${currentFile.id}`);
        const features = response.data.features || [];
        setFrameFeatures(features);
        // Check if clustering data is available
        const hasClustering = features.some((f: CellFeature) => f.gmm_state !== null || f.hmm_state !== null);
        setClusteringAvailable(hasClustering);
      } catch (err) {
        console.error('Error fetching features:', err);
        setFrameFeatures([]);
        setClusteringAvailable(false);
      }
    };
    fetchFrameFeatures();
  }, [currentFile?.id]);

  // Listen for clustering complete event to enable show clustering button
  useEffect(() => {
    const handleClusteringComplete = () => {
      // Refetch features to get updated clustering data
      if (currentFile?.id) {
        axios.get(`${API_BASE_URL}/features/${currentFile.id}`)
          .then(response => {
            const features = response.data.features || [];
            setFrameFeatures(features);
            const hasClustering = features.some((f: CellFeature) => f.gmm_state !== null || f.hmm_state !== null);
            setClusteringAvailable(hasClustering);
          })
          .catch(err => console.error('Error refetching features:', err));
      }
    };

    window.addEventListener('clusteringComplete', handleClusteringComplete);
    return () => window.removeEventListener('clusteringComplete', handleClusteringComplete);
  }, [currentFile?.id]);

  const handleCrop = (relRect: RelativeCropRect) => {
    cropImage(relRect);
    // UI: tắt crop mode + popup sau khi gửi lệnh cắt
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handleBrushCommit = (brushCanvas: HTMLCanvasElement) => {
    const img = imgRef.current;
    if (!img || !currentFile) return;

    pushUndo();

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    if (naturalW === 0 || naturalH === 0) {
      return;
    }

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = naturalW;
    baseCanvas.height = naturalH;
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';

    let src = currentImageURL || img.currentSrc || img.src;
    if (/^https?:\/\//i.test(src)) {
      src += (src.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
    }
    image.src = src;

    image.onload = () => {
      ctx.drawImage(image, 0, 0, naturalW, naturalH);

      ctx.drawImage(
        brushCanvas,
        0,
        0,
        brushCanvas.width,
        brushCanvas.height,
        0,
        0,
        naturalW,
        naturalH,
      );

      const newSrc = baseCanvas.toDataURL('image/png');
      const base64 = newSrc.split(',')[1];
      const newSize = base64ToBytes(base64);

      setCurrentImageURL(newSrc);

      setVisibleImages(prev => {
        const copy = [...prev];
        if (copy[currentIndex]) {
          copy[currentIndex] = {
            ...copy[currentIndex],
            cropped_url: newSrc as any,
            width: currentFile.width,
            height: currentFile.height,
            size: newSize,
            bitDepth: currentFile.bitDepth ?? 8,
          } as any;
        }
        return copy;
      });

      const overlayCtx = brushCanvas.getContext('2d');
      overlayCtx?.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    };

    image.onerror = (e) => {
      console.error('Brush commit failed (CORS?): ', e, src);
      alert('Cannot apply brush strokes due to CORS/image load error.');
    };
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < visibleImages.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const handleToggleMask = () => {
    setShowMask((prev) => !prev);
  };

  const formatValue = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(decimals);
  };

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(450, e.clientX - 15));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(180, Math.min(400, window.innerWidth - e.clientX - 15));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizingLeft || isResizingRight) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

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
  
  useEffect(() => {
    const handleCreateMaskEvent = () => {
      if (!imgRef.current || !currentFile || !currentImageURL) {
        alert('Không có ảnh hoặc nét vẽ để tạo mask.');
        return;
      }
  
      const imgEl = imgRef.current;
      const width = imgEl.naturalWidth;
      const height = imgEl.naturalHeight;
      if (!width || !height) {
        alert('Không lấy được kích thước ảnh.');
        return;
      }
  
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      const ctx = baseCanvas.getContext('2d');
      if (!ctx) return;
  
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
  
      let src = currentImageURL || imgEl.currentSrc || imgEl.src;
      if (/^https?:\/\//i.test(src)) {
        src += (src.includes('?') ? '&' : '?') + 'corsfix=' + Date.now();
      }
      image.src = src;
  
      image.onload = () => {
        ctx.drawImage(image, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
  
        // Mảng đánh dấu stroke & visited
        const stroke = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
  
        // 1) Detect pixel nét brush (màu đỏ)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
  
          // tuỳ brush của bạn, có thể nới threshold
          const isStroke =
            a > 0 &&
            r > 150 &&      // đỏ tương đối sáng
            r > g + 40 &&
            r > b + 40;
  
          if (isStroke) {
            const idx = i / 4;
            stroke[idx] = 1;
          }
        }
  
        // 2) Flood-fill từ mép ảnh để tìm background
        const q: number[] = [];
  
        const enqueue = (x: number, y: number) => {
          const idx = y * width + x;
          if (visited[idx] || stroke[idx]) return;
          visited[idx] = 1;
          q.push(idx);
        };
  
        // Mép trên & dưới
        for (let x = 0; x < width; x++) {
          enqueue(x, 0);
          enqueue(x, height - 1);
        }
        // Mép trái & phải
        for (let y = 0; y < height; y++) {
          enqueue(0, y);
          enqueue(width - 1, y);
        }
  
        while (q.length) {
          const idx = q.shift()!;
          const x = idx % width;
          const y = (idx / width) | 0;
  
          // 4-neighbors
          if (x > 0) enqueue(x - 1, y);
          if (x < width - 1) enqueue(x + 1, y);
          if (y > 0) enqueue(x, y - 1);
          if (y < height - 1) enqueue(x, y + 1);
        }
  
        // 3) Tạo mask: vùng tế bào = stroke || (không visited & không stroke)
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const mctx = maskCanvas.getContext('2d');
        if (!mctx) return;
  
        const maskImageData = mctx.createImageData(width, height);
        const md = maskImageData.data;
        const grayVal = 220; // màu xám cho tế bào
  
        let hasRegion = false;
  
        for (let idx = 0; idx < stroke.length; idx++) {
          const isStroke = stroke[idx] === 1;
          const isBackground = visited[idx] === 1;
          const isCell = isStroke || !isBackground; // bên trong vòng kín
  
          const j = idx * 4;
  
          if (isCell) {
            hasRegion = true;
            md[j] = grayVal;
            md[j + 1] = grayVal;
            md[j + 2] = grayVal;
            md[j + 3] = 255;
          } else {
            md[j] = 0;
            md[j + 1] = 0;
            md[j + 2] = 0;
            md[j + 3] = 255;
          }
        }
  
        if (!hasRegion) {
          alert('Không tìm thấy vùng nào được khoanh kín để tạo mask.');
          return;
        }
  
        mctx.putImageData(maskImageData, 0, 0);
        const maskDataUrl = maskCanvas.toDataURL('image/png');
  
        // Lưu mask tạm lên current file (FE)
        setVisibleImages(prev => {
          const copy = [...prev];
          if (copy[currentIndex]) {
            copy[currentIndex] = {
              ...copy[currentIndex],
              mask_url: maskDataUrl,
            } as any;
          }
          return copy;
        });
  
        setShowMask(true);
        // Properties should stay visible when showing mask
      };
  
      image.onerror = (e) => {
        console.error('Create mask failed', e);
        alert('Không thể đọc ảnh để tạo mask (CORS / lỗi tải ảnh).');
      };
    };
  
    window.addEventListener('createMask', handleCreateMaskEvent as EventListener);
    return () => {
      window.removeEventListener('createMask', handleCreateMaskEvent as EventListener);
    };
  }, [currentFile, currentImageURL, currentIndex, setVisibleImages]);
  
  return (
    <div id="image-view">
      {/* LEFT SIDE: Properties & Analysis Panel */}
      {currentFile && showProperties && (
        <div id="image-properties" style={{ width: leftPanelWidth, minWidth: leftPanelWidth }}>
          <h2>Properties & Analysis</h2>
          <div className="properties-content">
            <div className="properties-section">
              <h3>Image Info</h3>
              <table className="info-table">
                <tbody>
                  <tr><td>Name</td><td>{currentFile.filename}</td></tr>
                  <tr><td>Size</td><td>{formatFileSize(currentFile.size)}</td></tr>
                  <tr><td>Dimensions</td><td>{currentFile.width} x {currentFile.height} px</td></tr>
                  <tr><td>Bit Depth</td><td>{currentFile.bitDepth} bit</td></tr>
                </tbody>
              </table>
            </div>

            <div className="properties-section">
              <h3>Cell Features (Frame {currentIndex + 1})</h3>
              {frameFeatures.length === 0 ? (
                <p className="no-features">No features extracted. Run segmentation first.</p>
              ) : (
                <div className="features-table-container">
                  <p className="cell-count">{frameFeatures.length} cells detected</p>
                  <table className="features-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Area</th>
                        <th>Centroid</th>
                        <th>Int.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {frameFeatures.map((feature) => (
                        <tr key={feature.id}>
                          <td className="cell-id">{feature.cell_id}</td>
                          <td>{formatValue(feature.area, 0)}</td>
                          <td>({formatValue(feature.centroid_col, 0)}, {formatValue(feature.centroid_row, 0)})</td>
                          <td>{formatValue(feature.mean_intensity, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {frameFeatures.some(f => f.speed !== null) && (
                    <>
                      <h4 className="motion-header">Motion Features</h4>
                      <table className="features-table motion-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Speed</th>
                            <th>Disp.</th>
                            <th>Turn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frameFeatures.map((feature) => (
                            <tr key={feature.id}>
                              <td className="cell-id">{feature.cell_id}</td>
                              <td>{formatValue(feature.speed, 1)}</td>
                              <td>{formatValue(feature.displacement, 1)}</td>
                              <td>{formatValue(feature.turning, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cluster Legend Section */}
            {clusteringAvailable && (
              <div className="properties-section cluster-legend-section">
                <h3>Cluster Legend</h3>
                <div className="cluster-legend">
                  {(() => {
                    // Get unique clusters from current frame
                    const uniqueClusters = [...new Set(
                      frameFeatures
                        .filter(f => f.hmm_state !== null || f.gmm_state !== null)
                        .map(f => f.hmm_state ?? f.gmm_state ?? 0)
                    )].sort((a, b) => a - b);

                    return uniqueClusters.map(clusterIdx => {
                      const colorInfo = CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];
                      const cellCount = frameFeatures.filter(
                        f => (f.hmm_state ?? f.gmm_state) === clusterIdx
                      ).length;

                      return (
                        <div key={clusterIdx} className="cluster-legend-item">
                          <div
                            className="cluster-color-box"
                            style={{
                              backgroundColor: colorInfo.color,
                              border: `2px solid ${colorInfo.border}`,
                            }}
                          />
                          <span className="cluster-label">
                            Cluster {clusterIdx} ({colorInfo.name})
                          </span>
                          <span className="cluster-count">{cellCount} cells</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Left Resize Handle */}
      {showProperties && (
        <div
          className="resize-handle resize-handle-left"
          onMouseDown={() => setIsResizingLeft(true)}
        />
      )}

      {/* CENTER: Image Container */}
      <div id="image-container">
        <div id="image-header">
          <div className="header-left">
            <p className="frame-info">Frame {currentIndex + 1} of {visibleImages.length}</p>
            <div className="zoom-controls">
              <button
                className="zoom-btn"
                onClick={() => {
                  const newZoom = Math.max(zoomLevel / ZOOM_FACTOR, 0.1);
                  if (displayRef.current && imgRef.current) {
                    zoomWithCenter(displayRef.current, imgRef.current, zoomLevel, newZoom, scaleToFit);
                  }
                  setScaleToFit(false);
                  setZoomLevel(newZoom);
                }}
                title="Zoom Out"
              >
                <span className="zoom-icon">−</span>
              </button>
              <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
              <button
                className="zoom-btn"
                onClick={() => {
                  const newZoom = Math.min(zoomLevel * ZOOM_FACTOR, 32.0);
                  if (displayRef.current && imgRef.current) {
                    zoomWithCenter(displayRef.current, imgRef.current, zoomLevel, newZoom, scaleToFit);
                  }
                  setScaleToFit(false);
                  setZoomLevel(newZoom);
                }}
                title="Zoom In"
              >
                <span className="zoom-icon">+</span>
              </button>
              <button
                className={`zoom-btn fit-btn ${scaleToFit ? 'active' : ''}`}
                onClick={() => {
                  setScaleToFit(prev => {
                    if (!prev) setZoomLevel(DEFAULT_ZOOM_LEVEL);
                    return !prev;
                  });
                }}
                title="Fit to Window"
              >
                <Maximize size={14} />
              </button>
            </div>
          </div>
          <div id="image-controls">
            <button className="image-controls-btn" onClick={handlePrev} disabled={currentIndex === 0 || visibleImages.length <= 1}>
              <ChevronLeft className="image-controls-icon" />
            </button>

            <button
              className="image-controls-btn mask-btn"
              onClick={handleToggleMask}
              disabled={!currentFile?.mask_url}
            >
              {showMask ? <EyeOff size={18} /> : <Eye size={18} />}
              {showMask ? 'Hide Mask' : 'Show Mask'}
            </button>

            <button
              className={`image-controls-btn clustering-btn ${showClustering ? 'active' : ''}`}
              onClick={() => setShowClustering(prev => !prev)}
              disabled={!clusteringAvailable}
              title={clusteringAvailable ? 'Toggle clustering visualization' : 'Run clustering first'}
            >
              {showClustering ? <EyeOff size={18} /> : <Eye size={18} />}
              {showClustering ? 'Hide Clusters' : 'Show Clusters'}
            </button>

            <button className="image-controls-btn" onClick={handleNext} disabled={currentIndex === visibleImages.length - 1}>
              <ChevronRight className="image-controls-icon" />
            </button>
          </div>
        </div>

        <div
          ref={displayRef}
          id="image-display"
          className={`${showMask && scaleToFit ? 'show-mask-layout' : ''} ${!scaleToFit ? 'zoom-mode' : ''}`}
        >
          {currentImageURL && (
            <div
              id="image-wrapper"
              className={!scaleToFit ? 'zoom-wrapper' : ''}
              style={!scaleToFit && imgRef.current ? {
                width: imgRef.current.naturalWidth * zoomLevel,
                height: imgRef.current.naturalHeight * zoomLevel,
              } : undefined}
            >
              <img
                ref={imgRef}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                src={currentImageURL}
                alt={currentFile?.filename}
                className={showMask ? 'small-image' : ''}
                style={!scaleToFit ? {
                  width: imgRef.current?.naturalWidth ? imgRef.current.naturalWidth * zoomLevel : 'auto',
                  height: imgRef.current?.naturalHeight ? imgRef.current.naturalHeight * zoomLevel : 'auto',
                } : undefined}
              />

              {isCropping && (
                <CropOverlay
                  ref={cropRef}
                  imgRef={imgRef}
                  onCrop={() => {
                    const rel = cropRef.current?.getRelativeRect();
                    if (rel) {
                      setCropRectData(rel);
                      setShowConfirmCrop(true);
                    }
                  }}
                  onCancel={handleCancelCrop}
                />
              )}

              {/* Clustering Overlay */}
              {showClustering && imgRef.current && frameFeatures.length > 0 && (
                <div
                  className="clustering-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  {frameFeatures.filter(f => f.hmm_state !== null || f.gmm_state !== null).map((feature) => {
                    const img = imgRef.current;
                    if (!img) return null;

                    const state = feature.hmm_state ?? feature.gmm_state ?? 0;
                    const colorInfo = CLUSTER_COLORS[state % CLUSTER_COLORS.length];

                    // Calculate position based on bounding box
                    const displayedWidth = img.clientWidth;
                    const displayedHeight = img.clientHeight;
                    const naturalWidth = img.naturalWidth;
                    const naturalHeight = img.naturalHeight;

                    const scaleX = displayedWidth / naturalWidth;
                    const scaleY = displayedHeight / naturalHeight;

                    const left = feature.min_col_bb * scaleX;
                    const top = feature.min_row_bb * scaleY;
                    const width = (feature.max_col_bb - feature.min_col_bb) * scaleX;
                    const height = (feature.max_row_bb - feature.min_row_bb) * scaleY;

                    return (
                      <div
                        key={feature.id}
                        className="cluster-cell"
                        style={{
                          position: 'absolute',
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                          backgroundColor: colorInfo.color,
                          border: `2px solid ${colorInfo.border}`,
                          borderRadius: '3px',
                          boxSizing: 'border-box',
                        }}
                        title={`Cell ${feature.cell_id} - Cluster ${state}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showMask && currentFile?.mask_url && (
            <div
              className={`mask-wrapper ${!scaleToFit ? 'zoom-wrapper' : ''}`}
              style={!scaleToFit && imgRef.current ? {
                width: imgRef.current.naturalWidth * zoomLevel,
                height: imgRef.current.naturalHeight * zoomLevel,
              } : undefined}
            >
              <img
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                src={currentFile.mask_url}
                alt={`${currentFile?.filename} mask`}
                className={`mask-image ${scaleToFit ? 'small-image' : ''}`}
                style={!scaleToFit && imgRef.current ? {
                  width: imgRef.current.naturalWidth * zoomLevel,
                  height: imgRef.current.naturalHeight * zoomLevel,
                } : undefined}
              />
            </div>
          )}

          <RoiOverlay
            tool={activeTool}
            disabled={isCropping}
            imgRef={imgRef}
            frameIndex={currentIndex}
          />

          <BrushOverlay
            tool={activeTool}
            disabled={isCropping}
            imgRef={imgRef}
            onCommit={handleBrushCommit}
          />

          {isCropping && (
            <div className="crop-controls">
              <button
                onClick={() => {
                  const rel = cropRef.current?.getRelativeRect();
                  if (rel) {
                    setCropRectData(rel);
                    setShowConfirmCrop(true);
                  }
                }}
              >
                Crop
              </button>
              <button onClick={handleCancelCrop}>Cancel</button>
            </div>
          )}
        </div>

        {showConfirmCrop && cropRectData && (
          <div className="confirm-popup">
            <div className="confirm-box">
              <p>Do you want to replace the original image?</p>
              <div className="confirm-buttons">
                <button
                  className="yes"
                  onClick={() => handleCrop(cropRectData)}
                >
                  Yes
                </button>
                <button className="no" onClick={() => setShowConfirmCrop(false)}>No</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Resize Handle */}
      <div
        className="resize-handle resize-handle-right"
        onMouseDown={() => setIsResizingRight(true)}
      />

      {/* RIGHT SIDE: Frame Gallery */}
      <div id="image-gallery" style={{ width: rightPanelWidth, minWidth: rightPanelWidth }}>
        <h2>Frame Gallery</h2>
        <div className="gallery-content">
          {visibleImages.map((image, index) => {
            const isActive = index === currentIndex;
            return (
              <div key={index} className={`gallery-item ${isActive ? 'gallery-active' : ''}`}>
                <img
                  src={image.cropped_url || image.url}
                  alt={image.filename}
                  onClick={() => {
                    setCurrentIndex(index);
                  }}
                  className={isActive ? 'img-active' : ''}
                />
                <span className="gallery-filename">{image.filename}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImageView;
