import axios from 'axios';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CropOverlayHandle, RelativeCropRect } from '../../types/crop';
import type { ImageInfo, ImageViewProps } from '../../types/image';
import { type RoiTool } from '../../types/roi';
import { formatFileSize } from '../../utils/common/formatFileSize';
import { IMAGES_APPENDED_EVENT } from '../../utils/nav-bar/fileUtils';
import {
  analyzeColorChannelHistogram,
  analyzeImageHistogram,
  applyThresholdMask,
  type ColorChannel,
  flipHorizontal,
  flipVertical,
  getAutoThreshold,
  getColorChannelHistogram,
  getHistogram,
  handleScaleToFit,
  handleZoomIn,
  handleZoomOut,
  processBrightnessContrast,
  processColorBalance,
  processImageResize,
  rotateLeft90,
  rotateRight90
} from '../../utils/nav-bar/imageUtils';
import {
  generateCircularMasksStack,
  processClose,
  processConvertToMask,
  processConvolve,
  processDilate,
  processErode,
  processFindEdges,
  processGaussianBlur,
  processMakeBinary,
  processMaximumFilter,
  processMean,
  processMedian,
  processMinimumFilter,
  processOpen,
  processSharpen,
  processSmooth,
  processSubtractBackground,
  processUnsharpMask,
  processVariance,
  processWatershed,
  type CircularMasksStack
} from '../../utils/nav-bar/processUtils';
import BrushOverlay from '../brush-overlay/BrushOverlay';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import './ImageView.css';
import BrightnessContrastDialog from './dialogs/bright-contrast/BrightContrast';
import ColorBalanceDialog from './dialogs/color-balance/ColorBalanceDialog';
import FiltersDialog, { type FilterParams, type FilterType } from './dialogs/filters/FiltersDialog';
import ImageSizeDialog from './dialogs/image-size/ImageSizeDialog';
import NotificationBar, { type NotificationType } from './dialogs/notifications/NotificationBar';
import SubtractDialog, { type SubtractBackgroundParams } from './dialogs/subtract-background/SubtractDialog';
import ThresholdDialog, { MODE_BLACK_AND_WHITE, MODE_OVER_UNDER, MODE_RED } from './dialogs/threshold/ThresholdDialog';
import useBitDepthEvents from './hooks/useBitDepthEvents';
import useBrushCommit from './hooks/useBrushCommit';
import useEditEvents from './hooks/useEditEvents';
import useFileEvents from './hooks/useFileEvents';
import useFilterEvents from './hooks/useFilterEvents';
import useMaskCreation from './hooks/useMaskCreation';
import useNoiseEvents from './hooks/useNoiseEvents';
import usePanMode from './hooks/usePanMode';
import useRoiSelection from './hooks/useRoiSelection';
import useToolbarToolSelection from './hooks/useToolbarToolSelection';
import useUndoStack from './hooks/useUndoStack';
import NewStackViewer from './dialogs/depth-size/DepthSize';


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
  const [thresholdMode, setThresholdMode] = useState(MODE_RED);
  const [thresholdHistogram, setThresholdHistogram] = useState<number[]>([]);
  const [thresholdOriginalImageData, setThresholdOriginalImageData] = useState<ImageData | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType, isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<FilterType | null>(null);
  const [filterOriginalImageData, setFilterOriginalImageData] = useState<ImageData | null>(null);

  // Color Balance Dialog state
  const [showColorBalance, setShowColorBalance] = useState(false);
  const [colorBalanceMin, setColorBalanceMin] = useState(0);
  const [colorBalanceMax, setColorBalanceMax] = useState(255);
  const [colorBalanceChannel, setColorBalanceChannel] = useState<ColorChannel>('All');
  const [colorBalanceHistogram, setColorBalanceHistogram] = useState<number[]>([]);
  const [colorBalanceOriginalImageData, setColorBalanceOriginalImageData] = useState<ImageData | null>(null);
  const [showSubtractDialog, setShowSubtractDialog] = useState(false);
  const [subtractParams, setSubtractParams] = useState<SubtractBackgroundParams>({
    radius: 50,
    lightBackground: false,
    createBackground: false,
    slidingParaboloid: false,
    disableSmoothing: false,
    preview: false,
  });
  const [subtractOriginalImageData, setSubtractOriginalImageData] = useState<ImageData | null>(null);

  const [newStackFrames, setNewStackFrames] = useState<any[]>([]);
  const [showNewStack, setShowNewStack] = useState(false);

  const [showCircularMasksPlayer, setShowCircularMasksPlayer] = useState(false);
  const [circularMasksStack, setCircularMasksStack] = useState<CircularMasksStack | null>(null);
  const [circularMasksIndex, setCircularMasksIndex] = useState(0);
  const [circularMasksPlaying, setCircularMasksPlaying] = useState(false);
  const circularMasksTimerRef = useRef<number | null>(null);

    useEffect(() => {
    return () => {
      if (circularMasksTimerRef.current !== null) {
        window.clearInterval(circularMasksTimerRef.current);
      }
    };
  }, []);



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

  useFilterEvents({
    onOpenFilterDialog: (filterType: FilterType) => {
      const dataObj = getImageData();
      if (dataObj) {
        setFilterOriginalImageData(dataObj.imageData);
        setCurrentFilterType(filterType);
        setShowFilterDialog(true);
      }
    }
  });

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
  const updateImageFromCanvas = (
    canvas: HTMLCanvasElement,
    saveToHistory: boolean = true,
    onDone?: (newUrl: string, blob: Blob) => void
  ) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const newUrl = URL.createObjectURL(blob);

      if (saveToHistory) pushUndo();

      setCurrentImageURL(newUrl);
      onDone?.(newUrl, blob);
    });
};

  const noiseDialogs = useNoiseEvents(
    getImageData,
    updateImageFromCanvas,
    () => currentFile?.bitDepth || 8
  );

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
  // COLOR BALANCE DIALOG HANDLERS
  // ============================================

  const isRgbColor = currentFile?.bitDepth === 24;

  const getEffectiveColorChannel = (channel: ColorChannel): ColorChannel => {
    if (!isRgbColor && channel !== 'All') {
      return 'All';
    }
    return channel;
  };

  const handleOpenColorBalanceEvent = () => {
    const dataObj = getImageData();
    if (dataObj) {
      setColorBalanceOriginalImageData(dataObj.imageData);

      const effectiveChannel = getEffectiveColorChannel(colorBalanceChannel);
      const histogram = getColorChannelHistogram(dataObj.imageData, effectiveChannel);
      setColorBalanceHistogram(histogram);

      setColorBalanceMin(0);
      setColorBalanceMax(255);

      // Nếu ảnh không phải RGB mà user đang ở kênh khác All,
      // ta ép UI về 'All' cho rõ ràng.
      if (!isRgbColor && colorBalanceChannel !== 'All') {
        setColorBalanceChannel('All');
        showNotification(
          'Color Balance: color channels are only available for RGB images. Using All.',
          'warning'
        );
      }

      setShowColorBalance(true);
    }
  };


  // Handle color channel change - update histogram for new channel
  const handleColorChannelChange = (channel: ColorChannel) => {
    let effectiveChannel = getEffectiveColorChannel(channel);

    // Nếu ảnh không phải RGB mà user chọn kênh màu,
    // báo 1 lần và ép về 'All'
    if (!isRgbColor && channel !== 'All') {
      showNotification(
        'Color Balance: color channels (Red/Green/Blue/Cyan/Magenta/Yellow) chỉ hoạt động với RGB Color. Đang dùng All.',
        'warning'
      );
      effectiveChannel = 'All';
    }

    setColorBalanceChannel(effectiveChannel);

    if (colorBalanceOriginalImageData) {
      const histogram = getColorChannelHistogram(colorBalanceOriginalImageData, effectiveChannel);
      setColorBalanceHistogram(histogram);
      setColorBalanceMin(0);
      setColorBalanceMax(255);

      // Khôi phục ảnh gốc khi đổi kênh
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = colorBalanceOriginalImageData.width;
      tempCanvas.height = colorBalanceOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(colorBalanceOriginalImageData, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }
  };



  // Handle color balance slider changes - preview mode
  const handleColorBalanceChange = (newMin: number, newMax: number, channel: ColorChannel) => {
    setColorBalanceMin(newMin);
    setColorBalanceMax(newMax);

    // Preview color balance trên ảnh gốc
    if (colorBalanceOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = colorBalanceOriginalImageData.width;
      tempCanvas.height = colorBalanceOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      const previewData = new ImageData(
        new Uint8ClampedArray(colorBalanceOriginalImageData.data),
        colorBalanceOriginalImageData.width,
        colorBalanceOriginalImageData.height
      );

      processColorBalance(previewData, newMin, newMax, channel);
      ctx.putImageData(previewData, 0, 0);
      updateImageFromCanvas(tempCanvas, false);
    }
  };


  // Handle auto color balance
  const handleColorBalanceAuto = () => {
    if (!colorBalanceOriginalImageData) return;

    const effectiveChannel = getEffectiveColorChannel(colorBalanceChannel);
    const { min, max } = analyzeColorChannelHistogram(colorBalanceOriginalImageData, effectiveChannel);
    handleColorBalanceChange(min, max, effectiveChannel);
  };


  // Handle color balance reset
  const handleColorBalanceReset = () => {
    // Restore original image
    if (colorBalanceOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = colorBalanceOriginalImageData.width;
      tempCanvas.height = colorBalanceOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(colorBalanceOriginalImageData, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }

    setColorBalanceMin(0);
    setColorBalanceMax(255);
  };

  // Handle color balance apply
  const handleColorBalanceApply = () => {
    if (!colorBalanceOriginalImageData) return;

    pushUndo();

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = colorBalanceOriginalImageData.width;
    resultCanvas.height = colorBalanceOriginalImageData.height;
    const ctx = resultCanvas.getContext('2d');
    if (ctx) {
      const processedData = new ImageData(
        new Uint8ClampedArray(colorBalanceOriginalImageData.data),
        colorBalanceOriginalImageData.width,
        colorBalanceOriginalImageData.height
      );

      const effectiveChannel = getEffectiveColorChannel(colorBalanceChannel);
      processColorBalance(processedData, colorBalanceMin, colorBalanceMax, effectiveChannel);

      ctx.putImageData(processedData, 0, 0);
      updateImageFromCanvas(resultCanvas, false);
    }

    setColorBalanceOriginalImageData(null);
    setShowColorBalance(false);
    showNotification('Color balance applied successfully', 'success');
  };



  // Handle color balance dialog close
  const handleColorBalanceClose = () => {
    // Restore original image when closing without applying
    if (colorBalanceOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = colorBalanceOriginalImageData.width;
      tempCanvas.height = colorBalanceOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(colorBalanceOriginalImageData, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }

    setColorBalanceOriginalImageData(null);
    setShowColorBalance(false);
  };

  useEffect(() => {
    window.addEventListener('openColorBalance', handleOpenColorBalanceEvent);
    return () => {
      window.removeEventListener('openColorBalance', handleOpenColorBalanceEvent);
    };
  }, [currentImageURL, colorBalanceChannel]);

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
  // Implements ImageJ threshold display modes:
  // - Red: thresholded features in red, background in grayscale
  // - B&W: features in black, background in white
  // - Over/Under: below lower in blue, thresholded in grayscale, above upper in green
  const handleThresholdChange = (newMin: number, newMax: number, mode: number) => {
    setThresholdMin(newMin);
    setThresholdMax(newMax);
    setThresholdMode(mode);

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

      const data = previewData.data;
      const originalData = thresholdOriginalImageData.data;
      const minVal = Math.round(newMin);
      const maxVal = Math.round(newMax);

      for (let i = 0; i < data.length; i += 4) {
        // Calculate grayscale value from original image
        const gray = Math.round(0.299 * originalData[i] + 0.587 * originalData[i + 1] + 0.114 * originalData[i + 2]);
        const isWithinThreshold = gray >= minVal && gray <= maxVal;
        const isBelowThreshold = gray < minVal;
        const isAboveThreshold = gray > maxVal;

        if (mode === MODE_RED) {
          // Red mode: thresholded features in red, background in grayscale
          if (isWithinThreshold) {
            // Features shown in red
            data[i] = 255;     // R
            data[i + 1] = 0;   // G
            data[i + 2] = 0;   // B
          } else {
            // Background shown in grayscale
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
        } else if (mode === MODE_BLACK_AND_WHITE) {
          // B&W mode: features in black, background in white
          if (isWithinThreshold) {
            // Features shown in black
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else {
            // Background shown in white
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        } else if (mode === MODE_OVER_UNDER) {
          // Over/Under mode: below in blue, thresholded in grayscale, above in green
          if (isBelowThreshold) {
            // Below lower threshold: shown in blue
            data[i] = 0;       // R
            data[i + 1] = 0;   // G
            data[i + 2] = 255; // B
          } else if (isAboveThreshold) {
            // Above upper threshold: shown in green
            data[i] = 0;       // R
            data[i + 1] = 255; // G
            data[i + 2] = 0;   // B
          } else {
            // Within threshold: shown in grayscale (original)
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
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
    handleThresholdChange(newMin, newMax, thresholdMode);
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

  // ============================================
  // FILTER DIALOG HANDLERS
  // ============================================

  // Apply filter to image data and return the result
  const applyFilter = (filterType: FilterType, params: FilterParams, imageData: ImageData): ImageData | null => {
    switch (filterType) {
      case 'convolve':
        if (params.kernel && params.normalize !== undefined) {
          return processConvolve(imageData, params.kernel, params.normalize);
        }
        return null;
      case 'gaussian-blur':
        if (params.sigma !== undefined) {
          return processGaussianBlur(imageData, params.sigma);
        }
        return null;
      case 'median':
        if (params.radius !== undefined) {
          return processMedian(imageData, params.radius);
        }
        return null;
      case 'mean':
        if (params.radius !== undefined) {
          return processMean(imageData, params.radius);
        }
        return null;
      case 'minimum':
        if (params.radius !== undefined) {
          return processMinimumFilter(imageData, params.radius);
        }
        return null;
      case 'maximum':
        if (params.radius !== undefined) {
          return processMaximumFilter(imageData, params.radius);
        }
        return null;
      case 'unsharp-mask':
        if (params.sigma !== undefined && params.maskWeight !== undefined) {
          return processUnsharpMask(imageData, params.sigma, params.maskWeight);
        }
        return null;
      case 'variance':
        if (params.radius !== undefined) {
          return processVariance(imageData, params.radius);
        }
        return null;
      case 'circular-masks':
        // Special case: generate and show circular masks stack
        handleShowCircularMasks();
        return null;
      default:
        return null;
    }
  };

    // Show Circular Masks → mở pop-up stack giống ImageJ
  const handleShowCircularMasks = () => {
    const stack = generateCircularMasksStack();

    if (!stack.frames.length) {
      showNotification('Không tạo được Circular Masks.', 'error');
      return;
    }

    setCircularMasksStack(stack);
    setCircularMasksIndex(0);
    setShowCircularMasksPlayer(true);
    setShowFilterDialog(false);

    // auto play như ImageJ
    stopCircularMasksPlayback();
    setTimeout(() => {
      startCircularMasksPlayback();
    }, 0);

    showNotification('Generated circular masks stack (99 masks).', 'success');
  };


  // Handle filter preview
  const handleFilterPreview = (filterType: FilterType, params: FilterParams) => {
    if (!filterOriginalImageData) return;

    const result = applyFilter(filterType, params, filterOriginalImageData);
    if (result) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = result.width;
      tempCanvas.height = result.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(result, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }
  };

  // Handle filter apply
  const handleFilterApply = (filterType: FilterType, params: FilterParams) => {
    if (!filterOriginalImageData) return;

    pushUndo();

    const result = applyFilter(filterType, params, filterOriginalImageData);
    if (result) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = result.width;
      tempCanvas.height = result.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(result, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }

      // Get filter name for notification
      const filterNames: Record<FilterType, string> = {
        'convolve': 'Convolution',
        'gaussian-blur': 'Gaussian Blur',
        'median': 'Median Filter',
        'mean': 'Mean Filter',
        'minimum': 'Minimum Filter',
        'maximum': 'Maximum Filter',
        'unsharp-mask': 'Unsharp Mask',
        'variance': 'Variance Filter',
        'circular-masks': 'Circular Masks',
      };
      showNotification(`${filterNames[filterType]} applied successfully`, 'success');
    }

    setFilterOriginalImageData(null);
    setShowFilterDialog(false);
  };

  // Handle filter reset (restore original image)
  const handleFilterReset = () => {
    if (filterOriginalImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = filterOriginalImageData.width;
      tempCanvas.height = filterOriginalImageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(filterOriginalImageData, 0, 0);
        updateImageFromCanvas(tempCanvas, false);
      }
    }
  };

  // Handle filter dialog close
  const handleFilterClose = () => {
    // Just close the dialog - reset is handled by handleCancel in FiltersDialog
    // which calls onReset() when needed (when preview was enabled)
    setFilterOriginalImageData(null);
    setShowFilterDialog(false);
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
  const handleSizeApply = (
    w: number,
    h: number,
    depth: number,
    interp: string,
    average: boolean
  ) => {
    const dataObj = getImageData();
    if (!dataObj) return;

    // 1. Resize ảnh hiện tại (logic cũ giữ nguyên)
    const newImageData = processImageResize(dataObj.imageData, {
      newWidth: w,
      newHeight: h,
      interpolation: interp,
      averageWhenDownsizing: average,
    });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(newImageData, 0, 0);

    // ====================================================
    // 🔥 CHỖ XỬ LÝ DEPTH – PHẦN BẠN HỎI
    // ====================================================
    if (depth > 1) {
      // Không thay đổi ảnh hiện tại
      // Tạo stack và popup viewer mới giống ImageJ

      tempCanvas.toBlob(blob => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        const frames = Array.from({ length: depth }, () => ({
          url,
          width: w,
          height: h,
        }));

        setNewStackFrames(frames);
        setShowNewStack(true);
      });

      setShowSizeDialog(false);
      return; // ⬅️ QUAN TRỌNG: dừng ở đây
    }

    // ====================================================
    // depth <= 1 → xử lý như Resize bình thường
    // ====================================================
    updateImageFromCanvas(tempCanvas, true, (newUrl, blob) => {
      setVisibleImages(prev => {
        const copy = [...prev];
        const old = copy[currentIndex];
        if (!old) return prev;

        copy[currentIndex] = {
          ...old,
          cropped_url: newUrl as any,   // để UI dùng ảnh đã resize
          width: w,
          height: h,
          size: blob.size,              // optional nhưng nên có để “Size” đúng
        } as any;

        return copy;
      });
    });

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

  const applySubtractPreview = (params: SubtractBackgroundParams) => {
    if (!subtractOriginalImageData) return;

    const result = processSubtractBackground(subtractOriginalImageData, {
      radius: params.radius,
      lightBackground: params.lightBackground,
      createBackground: params.createBackground,
      slidingParaboloid: params.slidingParaboloid,
      disableSmoothing: params.disableSmoothing,
    });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = result.width;
    tempCanvas.height = result.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(result, 0, 0);

    // Preview: không lưu history
    updateImageFromCanvas(tempCanvas, false);
  };

  const restoreSubtractBaseImage = () => {
    if (!subtractOriginalImageData) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = subtractOriginalImageData.width;
    tempCanvas.height = subtractOriginalImageData.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(subtractOriginalImageData, 0, 0);

    updateImageFromCanvas(tempCanvas, false);
  };

  const handleSubtractParamsChange = (params: SubtractBackgroundParams) => {
    setSubtractParams(params);
    if (params.preview) {
      applySubtractPreview(params);
    } else {
      // Tắt preview -> trả ảnh về trạng thái gốc khi mở dialog
      restoreSubtractBaseImage();
    }
  };

  const handleSubtractApply = () => {
    if (!subtractOriginalImageData) return;

    // Lưu vào undo stack
    pushUndo();

    const result = processSubtractBackground(subtractOriginalImageData, {
      radius: subtractParams.radius,
      lightBackground: subtractParams.lightBackground,
      createBackground: subtractParams.createBackground,
      slidingParaboloid: subtractParams.slidingParaboloid,
      disableSmoothing: subtractParams.disableSmoothing,
    });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = result.width;
    tempCanvas.height = result.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(result, 0, 0);

    updateImageFromCanvas(tempCanvas, false);
    setShowSubtractDialog(false);
  };

  const handleSubtractCancel = () => {
    setShowSubtractDialog(false);
    // Nếu đang preview thì khôi phục lại ảnh gốc
    if (subtractOriginalImageData) {
      restoreSubtractBaseImage();
    }
  };

  const handleOpenSubtractBackgroundEvent = () => {
    const dataObj = getImageData();
    if (!dataObj) return;

    setSubtractOriginalImageData(dataObj.imageData);
    // Reset preview về false mỗi lần mở
    setSubtractParams(prev => ({
      ...prev,
      preview: false,
    }));
    setShowSubtractDialog(true);
  };

  useEffect(() => {
    window.addEventListener('openSubtractBackground', handleOpenSubtractBackgroundEvent);
    return () => {
      window.removeEventListener('openSubtractBackground', handleOpenSubtractBackgroundEvent);
    };
  }, [currentImageURL, getImageData]);

    const stopCircularMasksPlayback = () => {
    if (circularMasksTimerRef.current !== null) {
      window.clearInterval(circularMasksTimerRef.current);
      circularMasksTimerRef.current = null;
    }
    setCircularMasksPlaying(false);
  };

  const startCircularMasksPlayback = () => {
    if (!circularMasksStack || !circularMasksStack.frames.length) return;

    stopCircularMasksPlayback();
    setCircularMasksPlaying(true);

    circularMasksTimerRef.current = window.setInterval(() => {
      setCircularMasksIndex(prev => {
        if (!circularMasksStack) return prev;
        return (prev + 1) % circularMasksStack.frames.length;
      });
    }, 150); // tốc độ chạy ~ giống ImageJ, muốn chậm hơn thì tăng ms
  };

  const handleCircularMasksPrev = () => {
    if (!circularMasksStack || !circularMasksStack.frames.length) return;
    setCircularMasksIndex(prev =>
      (prev - 1 + circularMasksStack.frames.length) % circularMasksStack.frames.length
    );
  };

  const handleCircularMasksNext = () => {
    if (!circularMasksStack || !circularMasksStack.frames.length) return;
    setCircularMasksIndex(prev =>
      (prev + 1) % circularMasksStack.frames.length
    );
  };

  const handleCircularMasksTogglePlay = () => {
    if (circularMasksPlaying) {
      stopCircularMasksPlayback();
    } else {
      startCircularMasksPlayback();
    }
  };

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

            <div className="properties-section cell-features-section">
              <h3>Cell Features (Frame {currentIndex + 1})</h3>
              {frameFeatures.length === 0 ? (
                <p className="no-features">No features extracted. Run segmentation first.</p>
              ) : (
                <div className="cell-features-panel">
                  <div className="cell-features-summary">
                    <div className="summary-stat">
                      <span className="stat-number">{frameFeatures.length}</span>
                      <span className="stat-label">Cells</span>
                    </div>
                    <div className="summary-stat">
                      <span className="stat-number">
                        {formatValue(frameFeatures.reduce((sum, f) => sum + (f.area || 0), 0) / frameFeatures.length, 0)}
                      </span>
                      <span className="stat-label">Avg Area</span>
                    </div>
                    <div className="summary-stat">
                      <span className="stat-number">
                        {formatValue(frameFeatures.reduce((sum, f) => sum + (f.mean_intensity || 0), 0) / frameFeatures.length, 1)}
                      </span>
                      <span className="stat-label">Avg Intensity</span>
                    </div>
                  </div>
                  <div className="cell-features-table-wrapper">
                    <table className="cell-features-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Area</th>
                          <th>Intensity</th>
                          <th>Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {frameFeatures.map((feature) => (
                          <tr key={feature.id}>
                            <td className="cell-id-col">{feature.cell_id}</td>
                            <td className="area-col">{formatValue(feature.area, 0)}</td>
                            <td className="intensity-col">{formatValue(feature.mean_intensity, 1)}</td>
                            <td className="position-col">
                              ({formatValue(feature.centroid_col, 0)}, {formatValue(feature.centroid_row, 0)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

      <ColorBalanceDialog
        isOpen={showColorBalance}
        onClose={handleColorBalanceClose}
        onApply={handleColorBalanceApply}
        onChange={handleColorBalanceChange}
        onReset={handleColorBalanceReset}
        onAuto={handleColorBalanceAuto}
        currentMin={colorBalanceMin}
        currentMax={colorBalanceMax}
        histogram={colorBalanceHistogram}
        selectedChannel={colorBalanceChannel}
        onChannelChange={handleColorChannelChange}
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

      <FiltersDialog
        isOpen={showFilterDialog}
        filterType={currentFilterType}
        onClose={handleFilterClose}
        onApply={handleFilterApply}
        onPreview={handleFilterPreview}
        onReset={handleFilterReset}
      />

      {noiseDialogs}

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

      <SubtractDialog
        isOpen={showSubtractDialog}
        params={subtractParams}
        onChange={handleSubtractParamsChange}
        onApply={handleSubtractApply}
        onCancel={handleSubtractCancel}
      />

            {showCircularMasksPlayer && circularMasksStack && (
        <div className="cm-overlay">
          <div className="cm-window">
            {/* Title-bar giống ImageJ */}
            <div className="cm-titlebar">
              <span>Masks</span>
              <button
                className="cm-close"
                onClick={() => {
                  stopCircularMasksPlayback();
                  setShowCircularMasksPlayer(false);
                }}
              >
                ✕
              </button>
            </div>

            {/* Status line: 12/99 (radius=6.0, size=13); 150x150 pixels; 32-bit; 8.5MB */}
            {(() => {
              const frame = circularMasksStack.frames[circularMasksIndex];
              const slice = circularMasksIndex + 1;
              const total = circularMasksStack.frames.length;
              const radiusStr = frame.radius.toFixed(1).replace(/\.0$/, '');
              const memMB = (circularMasksStack.stackBytes / (1024 * 1024)).toFixed(1);

              return (
                <div className="cm-status">
                  {slice}/{total} (radius={radiusStr}, size={frame.maskSize});{' '}
                  {circularMasksStack.width}x{circularMasksStack.height} pixels;{' '}
                  {circularMasksStack.bitDepth}-bit; {memMB}MB
                </div>
              );
            })()}

            {/* Ảnh mask */}
            <div className="cm-image-area">
              <img
                src={circularMasksStack.frames[circularMasksIndex].dataUrl}
                alt="Circular mask"
              />
            </div>

            {/* Thanh điều khiển giống thanh stack Player */}
            <div className="cm-controls">
              <button onClick={() => setCircularMasksIndex(0)}>{'⏮'}</button>
              <button onClick={handleCircularMasksPrev}>{'◀'}</button>
              <button onClick={handleCircularMasksTogglePlay}>
                {circularMasksPlaying ? 'Pause' : 'Play'}
              </button>
              <button onClick={handleCircularMasksNext}>{'▶'}</button>
              <button
                onClick={() => {
                  if (!circularMasksStack) return;
                  setCircularMasksIndex(circularMasksStack.frames.length - 1);
                }}
              >
                {'⏭'}
              </button>

              <input
                className="cm-slider"
                type="range"
                min={0}
                max={circularMasksStack.frames.length - 1}
                value={circularMasksIndex}
                onChange={e => setCircularMasksIndex(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      )}

      {showNewStack && (
        <NewStackViewer
          frames={newStackFrames}
          title="Generated Stack"
          onClose={() => setShowNewStack(false)}
        />
      )}

    </div>
  );
};

export default ImageView;
