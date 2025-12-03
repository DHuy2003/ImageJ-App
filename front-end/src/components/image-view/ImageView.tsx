import axios from 'axios';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CropOverlayHandle, RelativeCropRect } from '../../types/crop';
import type { ImageInfo, ImageViewProps } from '../../types/image';
import { type RoiTool } from '../../types/roi';
import { formatFileSize } from '../../utils/common/formatFileSize';
import { IMAGES_APPENDED_EVENT } from '../../utils/nav-bar/fileUtils';
import {
  analyzeImageHistogram,
  handleScaleToFit,
  handleZoomIn,
  handleZoomOut,
  processBrightnessContrast,
  processImageResize,
  flipHorizontal,
  flipVertical,
  rotateLeft90,
  rotateRight90,
  getHistogram,
  getAutoThreshold,
  applyThresholdMask
} from '../../utils/nav-bar/imageUtils';
import {
  processClose,
  processConvertToMask,
  processDilate,
  processErode,
  processFindEdges,
  processMakeBinary,
  processOpen,
  processSharpen,
  processSmooth,
  processWatershed
} from '../../utils/nav-bar/processUtils';
import BrushOverlay from '../brush-overlay/BrushOverlay';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import './ImageView.css';
import BrightnessContrastDialog from './dialogs/bright-contrast/BrightContrast';
import ImageSizeDialog from './dialogs/image-size/ImageSizeDialog';
import ThresholdDialog from './dialogs/threshold/ThresholdDialog';
import NotificationBar, { type NotificationType } from './dialogs/notifications/NotificationBar';
import useBitDepthEvents from './hooks/useBitDepthEvents';
import useBrushCommit from './hooks/useBrushCommit';
import useEditEvents from './hooks/useEditEvents';
import useFileEvents from './hooks/useFileEvents';
import useMaskCreation from './hooks/useMaskCreation';
import usePanMode from './hooks/usePanMode';
import useRoiSelection from './hooks/useRoiSelection';
import useToolbarToolSelection from './hooks/useToolbarToolSelection';
import useUndoStack from './hooks/useUndoStack';
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

interface CellContour {
  cell_id: number;
  feature_id: number;
  gmm_state: number | null;
  hmm_state: number | null;
  contour: number[][];  // Array of [x, y] points
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
  const selectedRoi = useRoiSelection();
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM_LEVEL);
  const [scaleToFit, setScaleToFit] = useState<boolean>(true);
  const [frameFeatures, setFrameFeatures] = useState<CellFeature[]>([]);
  const [cellContours, setCellContours] = useState<CellContour[]>([]);
  const [showClustering, setShowClustering] = useState<boolean>(false);
  const [clusteringAvailable, setClusteringAvailable] = useState<boolean>(false);
  const [panMode, setPanMode] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showBC, setShowBC] = useState(false);
  const [displayRange, setDisplayRange] = useState({ min: 0, max: 255 });
  const [_appliedDisplayRange, setAppliedDisplayRange] = useState<{ min: number; max: number; bitDepth: number } | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [histogramData, setHistogramData] = useState<number[]>([]);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [thresholdMin, setThresholdMin] = useState(0);
  const [thresholdMax, setThresholdMax] = useState(255);
  const [thresholdHistogram, setThresholdHistogram] = useState<number[]>([]);
  const [thresholdOriginalImageData, setThresholdOriginalImageData] = useState<ImageData | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType, isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showNotification = (message: string, type: NotificationType = 'info') => {
    setNotification({ message, type, isVisible: true });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };
  useEffect(() => {
    const handleCustomNotification = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string, type: NotificationType }>;
      showNotification(customEvent.detail.message, customEvent.detail.type);
    };

    window.addEventListener('show-notification', handleCustomNotification);
    return () => {
      window.removeEventListener('show-notification', handleCustomNotification);
    };
  }, []);
  const { pushUndo } = useUndoStack({
    visibleImages,
    currentIndex,
    currentFile: currentFile ?? null,
    currentImageURL,
    setCurrentImageURL,
    setVisibleImages,
  });


  const {
    pan,
    isPanning,
    handleMouseDown: handlePanMouseDown,
    handleMouseMove: handlePanMouseMove,
    handleMouseUp: handlePanMouseUp,
    handleMouseLeave: handlePanMouseLeave,
  } = usePanMode({
    wrapperRef,
    imgRef,
    scaleToFit,
    zoomLevel,
    panMode,
  });


  useEffect(() => {
    const handleZoomInEvent = () => {
      setScaleToFit(false);
      setZoomLevel(prev => {
        const nextZoom = prev * ZOOM_FACTOR;
        return Math.min(nextZoom, 32.0);
      });
    };


    const handleZoomOutEvent = () => {
      setScaleToFit(false);
      setZoomLevel(prev => {
        const nextZoom = prev / ZOOM_FACTOR;
        return Math.max(nextZoom, 0.1);
      });
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
  }, []);


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

  useMaskCreation({
    imgRef,
    currentFile: currentFile ?? null,
    currentImageURL,
    currentIndex,
    setVisibleImages,
    setShowMask,
    setShowProperties,
  });

  const handleBrushCommit = useBrushCommit({
    imgRef,
    currentFile: currentFile ?? null,
    currentImageURL,
    currentIndex,
    setCurrentImageURL,
    setVisibleImages,
    pushUndo,
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

  useToolbarToolSelection(setActiveTool, setPanMode);

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
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  }, [currentIndex]);

  useEffect(() => {
    if (currentFile) {
      if (currentFile.cropped_url) {
        setCurrentImageURL(currentFile.cropped_url);
      } else if (currentFile.url) {
        setCurrentImageURL(currentFile.url);
      }
    }
  }, [currentFile, currentIndex]);

  // Fetch features and contours for the current frame
  useEffect(() => {
    const fetchFrameData = async () => {
      if (!currentFile?.id) {
        setFrameFeatures([]);
        setCellContours([]);
        setClusteringAvailable(false);
        return;
      }
      try {
        // Fetch features and contours in parallel
        const [featuresRes, contoursRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/features/${currentFile.id}`),
          axios.get(`${API_BASE_URL}/segmentation/contours/${currentFile.id}`)
        ]);

        const features = featuresRes.data.features || [];
        const contours = contoursRes.data.contours || [];

        setFrameFeatures(features);
        setCellContours(contours);

        // Check if clustering data is available
        const hasClustering = features.some((f: CellFeature) => f.gmm_state !== null || f.hmm_state !== null);
        setClusteringAvailable(hasClustering);
      } catch (err) {
        console.error('Error fetching frame data:', err);
        setFrameFeatures([]);
        setCellContours([]);
        setClusteringAvailable(false);
      }
    };
    fetchFrameData();
  }, [currentFile?.id]);

  // Listen for clustering complete event to enable show clustering button
  useEffect(() => {
    const handleClusteringComplete = () => {
      // Refetch features and contours to get updated clustering data
      if (currentFile?.id) {
        Promise.all([
          axios.get(`${API_BASE_URL}/features/${currentFile.id}`),
          axios.get(`${API_BASE_URL}/segmentation/contours/${currentFile.id}`)
        ])
          .then(([featuresRes, contoursRes]) => {
            const features = featuresRes.data.features || [];
            const contours = contoursRes.data.contours || [];
            setFrameFeatures(features);
            setCellContours(contours);
            const hasClustering = features.some((f: CellFeature) => f.gmm_state !== null || f.hmm_state !== null);
            setClusteringAvailable(hasClustering);
          })
          .catch(err => console.error('Error refetching data:', err));
      }
    };

    window.addEventListener('clusteringComplete', handleClusteringComplete);
    return () => window.removeEventListener('clusteringComplete', handleClusteringComplete);
  }, [currentFile?.id]);

  // Reset showClustering when changing frames
  useEffect(() => {
    setShowClustering(false);
  }, [currentIndex]);

  const handleCrop = (relRect: RelativeCropRect) => {
    cropImage(relRect);
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setShowConfirmCrop(false);
    setCropRectData(null);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < visibleImages.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const handleToggleMask = () => {
    setShowMask((prev) => !prev);
    setShowProperties((prev) => !prev);
  };

  //New
  const getImageData = (): { ctx: CanvasRenderingContext2D, imageData: ImageData, canvas: HTMLCanvasElement } | null => {
    if (!imgRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(imgRef.current, 0, 0);
    return { ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), canvas };
  };

  // --- Update Image Source from Canvas ---
  const updateImageFromCanvas = (canvas: HTMLCanvasElement, saveToHistory: boolean = true) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const newUrl = URL.createObjectURL(blob);

      if (saveToHistory) {
        pushUndo();
      }

      setCurrentImageURL(newUrl);
    });
  };

  // Bit depth conversion events - returns functions to work with raw data
  const { applyDisplayRangeToRawData, getCurrentBitDepthRange } = useBitDepthEvents({
    currentFile,
    currentIndex,
    setVisibleImages,
    setDisplayRange,
    setAppliedDisplayRange,
    getImageData,
    updateImageFromCanvas,
    setOriginalImageData,
    pushUndo,
  });

  const handleOpenBCEvent = () => {
    const dataObj = getImageData();
    if (dataObj) {
      setOriginalImageData(dataObj.imageData);
      const { bins } = analyzeImageHistogram(dataObj.imageData);
      setHistogramData(bins);
      
      // Get the current bit depth range and set it as initial display range
      const { min, max } = getCurrentBitDepthRange();
      setDisplayRange({ min, max });
      
      setShowBC(true);
    }
  };

  // 2. Preview thay đổi (Vẽ lên Canvas nhưng không lưu History)
  // Now uses the bit-depth aware function from useBitDepthEvents
  const applyVisualChanges = (min: number, max: number) => {
    const bitDepth = currentFile?.bitDepth || 8;
    
    if (bitDepth === 8) {
      // For 8-bit, use original logic with processBrightnessContrast
      if (!originalImageData) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImageData.width;
      tempCanvas.height = originalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // Clone dữ liệu gốc
      const freshData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
      );

      // Tính toán pixel mới
      const processed = processBrightnessContrast(freshData, min, max);
      ctx.putImageData(processed, 0, 0);

      // Update lên màn hình (tham số false = không push Undo)
      updateImageFromCanvas(tempCanvas, false);
    } else {
      // For 16-bit and 32-bit, use the bit-depth aware function
      applyDisplayRangeToRawData(min, max);
    }
  };

  // 3. Khi người dùng thay đổi Slider (Bất kỳ slider nào từ Dialog)
  const handleBCChange = (newMin: number, newMax: number) => {
    // Cập nhật State (để Dialog hiển thị đúng số)
    setDisplayRange({ min: newMin, max: newMax });
    // Cập nhật hình ảnh
    applyVisualChanges(newMin, newMax);
  };

  // 4. Auto - detect optimal min/max based on current bit depth
  const handleBCAuto = () => {
    if (!originalImageData) return;
    
    const bitDepth = currentFile?.bitDepth || 8;
    const { min: rangeMin, max: rangeMax } = getCurrentBitDepthRange();
    
    // For 8-bit, use histogram analysis
    if (bitDepth === 8) {
      const { min, max } = analyzeImageHistogram(originalImageData);
      handleBCChange(min, max);
    } else {
      // For 16/32-bit, use the actual data range
      handleBCChange(rangeMin, rangeMax);
    }
  };

  // 5. Reset - reset to full range based on current bit depth
  const handleBCReset = () => {
    const bitDepth = currentFile?.bitDepth || 8;
    let defaultMin = 0;
    let defaultMax = 255;
    
    if (bitDepth === 16) {
      const { min, max } = getCurrentBitDepthRange();
      defaultMin = min;
      defaultMax = max;
    } else if (bitDepth === 32) {
      const { min, max } = getCurrentBitDepthRange();
      defaultMin = min;
      defaultMax = max;
    }
    
    handleBCChange(defaultMin, defaultMax);
  };

  // 6. Apply (Chốt đơn)
  const handleBCApply = () => {
    // Vẽ lần cuối
    applyVisualChanges(displayRange.min, displayRange.max);

    // Lưu vào Undo History (Lúc này ảnh trên màn hình đã thành ảnh gốc mới)
    pushUndo();

    // Reset thông số hiển thị về mặc định based on bit depth
    const bitDepth = currentFile?.bitDepth || 8;
    if (bitDepth === 8) {
      setDisplayRange({ min: 0, max: 255 });
    } else {
      const { min, max } = getCurrentBitDepthRange();
      setDisplayRange({ min, max });
    }
    
    setOriginalImageData(null);
    setShowBC(false);
  };

  // 7. Đóng (Hủy, nhưng giữ hiển thị preview - Non-destructive viewing)
  const handleBCClose = () => {
    setShowBC(false);
    // Nếu muốn khi đóng mà hủy bỏ thay đổi (như nút Cancel), gọi handleBCReset() ở đây.
    // Nhưng ImageJ thường giữ nguyên view (non-destructive).
  };

  useEffect(() => {
    window.addEventListener('openBrightnessContrast', handleOpenBCEvent);
    return () => {
      window.removeEventListener('openBrightnessContrast', handleOpenBCEvent);
    };
  }, [currentImageURL]); // Re-bind khi URL đổi

  // ============================================
  // THRESHOLD DIALOG HANDLERS
  // ============================================

  const handleOpenThresholdEvent = () => {
    const dataObj = getImageData();
    if (dataObj) {
      setThresholdOriginalImageData(dataObj.imageData);
      const histogram = getHistogram(dataObj.imageData);
      setThresholdHistogram(histogram);
      
      // Get the current bit depth range and set initial thresholds
      const { min, max } = getCurrentBitDepthRange();
      setThresholdMin(min);
      setThresholdMax(max);
      
      setShowThresholdDialog(true);
    }
  };

  // Handle threshold slider changes - preview mode
  const handleThresholdChange = (newMin: number, newMax: number) => {
    setThresholdMin(newMin);
    setThresholdMax(newMax);
    
    // Preview threshold overlay on original image
    if (thresholdOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = thresholdOriginalImageData.width;
      tempCanvas.height = thresholdOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // Create preview with threshold overlay
      const previewData = new ImageData(
        new Uint8ClampedArray(thresholdOriginalImageData.data),
        thresholdOriginalImageData.width,
        thresholdOriginalImageData.height
      );
      
      // Apply threshold preview (red overlay for in-range pixels)
      const data = previewData.data;
      const minVal = Math.round(newMin);
      const maxVal = Math.round(newMax);
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        if (gray >= minVal && gray <= maxVal) {
          // Apply red tint for threshold preview
          data[i] = Math.min(255, data[i] + 100);     // R
          data[i + 1] = Math.max(0, data[i + 1] - 50); // G
          data[i + 2] = Math.max(0, data[i + 2] - 50); // B
        }
      }
      
      ctx.putImageData(previewData, 0, 0);
      updateImageFromCanvas(tempCanvas, false);
    }
  };

  // Handle auto threshold
  // Matches ImageJ's autoSetLevels logic
  const handleThresholdAuto = (method: string, darkBackground: boolean) => {
    if (!thresholdHistogram || thresholdHistogram.length === 0) return;
    
    const threshold = getAutoThreshold(thresholdHistogram, method);
    
    let newMin: number, newMax: number;
    if (darkBackground) {
      // Dark background: threshold high values (thresholdHigh = true)
      // From Java: minThreshold=threshold+1; maxThreshold=255;
      newMin = threshold + 1;
      newMax = 255;
    } else {
      // Light background: threshold low values (thresholdHigh = false)
      // From Java: minThreshold=0; maxThreshold=threshold;
      newMin = 0;
      newMax = threshold;
    }
    
    // From Java: if (minThreshold>255) minThreshold = 255;
    if (newMin > 255) newMin = 255;
    
    setThresholdMin(newMin);
    setThresholdMax(newMax);
    handleThresholdChange(newMin, newMax);
  };

  // Handle threshold reset
  const handleThresholdReset = () => {
    // Restore original image
    if (thresholdOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = thresholdOriginalImageData.width;
      tempCanvas.height = thresholdOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(thresholdOriginalImageData, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }
    
    const { min, max } = getCurrentBitDepthRange();
    setThresholdMin(min);
    setThresholdMax(max);
  };

  // Handle threshold apply - create binary mask
  const handleThresholdApply = () => {
    if (!thresholdOriginalImageData) return;
    
    pushUndo();
    
    const maskedData = applyThresholdMask(
      thresholdOriginalImageData,
      Math.round(thresholdMin),
      Math.round(thresholdMax)
    );
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskedData.width;
    tempCanvas.height = maskedData.height;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(maskedData, 0, 0);
      updateImageFromCanvas(tempCanvas, false);
    }
    
    setThresholdOriginalImageData(null);
    setShowThresholdDialog(false);
    showNotification('Threshold applied - image converted to binary mask', 'success');
  };

  // Handle threshold dialog close
  const handleThresholdClose = () => {
    // Restore original image when closing without applying
    if (thresholdOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = thresholdOriginalImageData.width;
      tempCanvas.height = thresholdOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(thresholdOriginalImageData, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }
    
    setThresholdOriginalImageData(null);
    setShowThresholdDialog(false);
  };

  useEffect(() => {
    window.addEventListener('openThreshold', handleOpenThresholdEvent);
    return () => {
      window.removeEventListener('openThreshold', handleOpenThresholdEvent);
    };
  }, [currentImageURL]);

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
    const handleProcessImage = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string }>;
      const { action } = customEvent.detail;

      const data = getImageData();
      if (!data) return;

      const { ctx, imageData, canvas } = data;
      let newImageData: ImageData | null = null;

      // Apply the specific process based on action
      switch (action) {
        case 'smooth':
          newImageData = processSmooth(imageData);
          break;
        case 'sharpen':
          newImageData = processSharpen(imageData);
          break;
        case 'find-edges':
          newImageData = processFindEdges(imageData);
          break;
        case 'make-binary':
          newImageData = processMakeBinary(imageData);
          break;
        case 'convert-to-mask':
          newImageData = processConvertToMask(imageData);
          break;
        case 'erode':
          newImageData = processErode(imageData);
          break;
        case 'dilate':
          newImageData = processDilate(imageData);
          break;
        case 'open':
          newImageData = processOpen(imageData);
          break;
        case 'close':
          newImageData = processClose(imageData);
          break;
        case 'watershed':
          newImageData = processWatershed(imageData);
          break;
        default:
          console.warn('Unknown process action:', action);
          return;
      }

      if (newImageData) {
        ctx.putImageData(newImageData, 0, 0);
        updateImageFromCanvas(canvas);
      }
    };

    window.addEventListener('process-image', handleProcessImage);
    return () => {
      window.removeEventListener('process-image', handleProcessImage);
    };
  }, [currentImageURL, pushUndo]);


  useEffect(() => {
    const handleOpenSizeEvent = () => setShowSizeDialog(true);

    // ... các event listeners khác ...
    window.addEventListener('openImageSize', handleOpenSizeEvent);

    return () => {
      // ... cleanup khác ...
      window.removeEventListener('openImageSize', handleOpenSizeEvent);
    };
  }, []); // dependencies

  // 4. Hàm xử lý khi bấm OK trong dialog
  const handleSizeApply = (w: number, h: number, _d: number, interp: string) => {
    const dataObj = getImageData();
    if (!dataObj) return;

    // Gọi hàm logic từ imageUtils (đã được định nghĩa ở bước trước)
    const newImageData = processImageResize(dataObj.imageData, {
      newWidth: w,
      newHeight: h,
      interpolation: interp as any
    });

    // Tạo canvas tạm để chuyển đổi ImageData -> URL
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(newImageData, 0, 0);
      // Cập nhật ảnh hiển thị và lưu vào Undo Stack
      updateImageFromCanvas(tempCanvas, true);
    }

    setShowSizeDialog(false);
  };

    useEffect(() => {
    const transformImage = (
      transformFn: (
        img: HTMLImageElement | null,
        onComplete: (dataUrl: string, width: number, height: number, size: number) => void
      ) => void
    ) => {
      if (!imgRef.current || !currentFile) return;
      
      pushUndo();
      
      transformFn(imgRef.current, (dataUrl, width, height, size) => {
        setCurrentImageURL(dataUrl);
        setVisibleImages(prev => {
          const copy = [...prev];
          if (copy[currentIndex]) {
            copy[currentIndex] = {
              ...copy[currentIndex],
              cropped_url: dataUrl as any,
              width,
              height,
              size,
              bitDepth: copy[currentIndex].bitDepth ?? 8,
            } as any;
          }
          return copy;
        });
      });
    };


    const handleFlipHorizontalEvent = () => transformImage(flipHorizontal);
    const handleFlipVerticalEvent = () => transformImage(flipVertical);
    const handleRotateLeft90Event = () => transformImage(rotateLeft90);
    const handleRotateRight90Event = () => transformImage(rotateRight90);


    window.addEventListener('imageFlipHorizontal', handleFlipHorizontalEvent);
    window.addEventListener('imageFlipVertical', handleFlipVerticalEvent);
    window.addEventListener('imageRotateLeft90', handleRotateLeft90Event);
    window.addEventListener('imageRotateRight90', handleRotateRight90Event);


    return () => {
      window.removeEventListener('imageFlipHorizontal', handleFlipHorizontalEvent);
      window.removeEventListener('imageFlipVertical', handleFlipVerticalEvent);
      window.removeEventListener('imageRotateLeft90', handleRotateLeft90Event);
      window.removeEventListener('imageRotateRight90', handleRotateRight90Event);
    };
  }, [currentIndex, currentFile, pushUndo, setCurrentImageURL, setVisibleImages]);

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
                  <tr><td>Name: </td><td>{currentFile.filename}</td></tr>
                  <tr><td>Size: </td><td>{formatFileSize(currentFile.size)}</td></tr>
                  <tr><td>Dimensions: </td><td>{currentFile.width} x {currentFile.height} px</td></tr>
                  <tr><td>Bit Depth: </td><td>{currentFile.bitDepth} bit</td></tr>
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
                  <table className="features-table combined-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Area (px²)</th>
                        <th>Aspect Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {frameFeatures.map((feature) => (
                        <tr key={feature.id}>
                          <td className="cell-id">{feature.cell_id}</td>
                          <td>{formatValue(feature.area, 0)}</td>
                          {/* <td>{formatValue(feature.aspect_ratio, 2)}</td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

      <BrightnessContrastDialog
        isOpen={showBC}
        onClose={handleBCClose}
        onApply={handleBCApply}
        onChange={handleBCChange}
        onReset={handleBCReset}
        onAuto={handleBCAuto}
        currentMin={displayRange.min}
        currentMax={displayRange.max}
        histogram={histogramData}
        bitDepth={(currentFile?.bitDepth || 8) as 8 | 16 | 32}
        dataRangeMin={getCurrentBitDepthRange().min}
        dataRangeMax={getCurrentBitDepthRange().max}
      />

      <ThresholdDialog
        isOpen={showThresholdDialog}
        onClose={handleThresholdClose}
        onApply={handleThresholdApply}
        onChange={handleThresholdChange}
        onReset={handleThresholdReset}
        onAuto={handleThresholdAuto}
        currentMin={thresholdMin}
        currentMax={thresholdMax}
        histogram={thresholdHistogram}
        bitDepth={(currentFile?.bitDepth || 8) as 8 | 16 | 32}
        dataRangeMin={getCurrentBitDepthRange().min}
        dataRangeMax={getCurrentBitDepthRange().max}
      />

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
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                <span className="zoom-icon">−</span>
              </button>
              <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
              <button
                className="zoom-btn"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                <span className="zoom-icon">+</span>
              </button>
              <button
                className={`zoom-btn fit-btn ${scaleToFit ? 'active' : ''}`}
                onClick={handleScaleToFit}
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
          id="image-display"
          className={showMask ? 'show-mask-layout' : ''}
        >
          {currentImageURL && (
            <div
              id="image-wrapper"
              ref={wrapperRef}
              onMouseDown={handlePanMouseDown}
              onMouseMove={handlePanMouseMove}
              onMouseUp={handlePanMouseUp}
              onMouseLeave={handlePanMouseLeave}
              className={`${panMode ? 'pan-mode' : ''} ${isPanning ? 'pan-active' : ''}`}
            >
              <img
                ref={imgRef}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                src={currentImageURL}
                alt={currentFile?.filename}
                className={showMask ? 'small-image' : ''}
                style={{
                  // scale dùng để zoom (in/out) ảnh bên trong khung,
                  // KHÔNG đụng vào kích thước layout ban đầu của ảnh
                  transform: scaleToFit ? 'none' : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transformOrigin: 'center center',
                }}
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

              {/* Clustering Overlay - SVG with polygon contours */}
              {showClustering && imgRef.current && cellContours.length > 0 && (
                <svg
                  className="clustering-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                  viewBox={`0 0 ${imgRef.current.naturalWidth} ${imgRef.current.naturalHeight}`}
                  preserveAspectRatio="none"
                >
                  {cellContours
                    .filter(c => c.hmm_state !== null || c.gmm_state !== null)
                    .map((contour) => {
                      const state = contour.hmm_state ?? contour.gmm_state ?? 0;
                      const colorInfo = CLUSTER_COLORS[state % CLUSTER_COLORS.length];

                      // Convert contour points to SVG polygon points string
                      const pointsStr = contour.contour
                        .map(([x, y]) => `${x},${y}`)
                        .join(' ');

                      return (
                        <polygon
                          key={contour.feature_id}
                          points={pointsStr}
                          fill={colorInfo.color}
                          stroke={colorInfo.border}
                          strokeWidth="2"
                        >
                          <title>{`Cell ${contour.cell_id} - Cluster ${state}`}</title>
                        </polygon>
                      );
                    })}
                </svg>
              )}
            </div>
          )}

          {showMask && currentFile?.mask_url && (
            <img
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              src={currentFile.mask_url}
              alt={`${currentFile?.filename} mask`}
              className="mask-image small-image"
            />
          )}

          <RoiOverlay
            tool={activeTool}
            disabled={isCropping || panMode}
            imgRef={imgRef}
            frameIndex={currentIndex}
          />

          <BrushOverlay
            tool={activeTool}
            disabled={isCropping || panMode}
            imgRef={imgRef}
            onCommit={handleBrushCommit}
          />
        </div>
        
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
      {currentFile && (
        <ImageSizeDialog
          isOpen={showSizeDialog}
          onClose={() => setShowSizeDialog(false)}
          onApply={handleSizeApply}
          currentWidth={imgRef.current?.naturalWidth || 0}
          currentHeight={imgRef.current?.naturalHeight || 0}
        />
      )}

      <NotificationBar
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={closeNotification}
      />
    </div>
  );
};

export default ImageView;
