import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { CropOverlayHandle, RelativeCropRect } from '../../types/crop';
import type { ImageInfo, ImageViewProps } from '../../types/image';
import { formatFileSize } from '../../utils/common/formatFileSize';
import CropOverlay from '../crop-overlay/CropOverlay';
import RoiOverlay from '../roi-overlay/RoiOverlay';
import { type RoiTool } from '../../types/roi';
import './ImageView.css';
import useEditEvents from './hooks/useEditEvents';
import { useToolbarToolSelection } from './hooks/useToolbarToolSelection';
import useFileEvents from './hooks/useFileEvents';
import BrushOverlay from '../brush-overlay/BrushOverlay';
import { IMAGES_APPENDED_EVENT } from '../../utils/nav-bar/fileUtils';
import usePanMode from './hooks/usePanMode';
import useUndoStack from './hooks/useUndoStack';
import useMaskCreation from './hooks/useMaskCreation';
import useRoiSelection from './hooks/useRoiSelection';
import useBrushCommit from './hooks/useBrushCommit';

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
  const selectedRoi = useRoiSelection();
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM_LEVEL);
  const [scaleToFit, setScaleToFit] = useState<boolean>(true);
  const [frameFeatures, setFrameFeatures] = useState<CellFeature[]>([]);
  const [cellContours, setCellContours] = useState<CellContour[]>([]);
  const [showClustering, setShowClustering] = useState<boolean>(false);
  const [clusteringAvailable, setClusteringAvailable] = useState<boolean>(false);
  const [panMode, setPanMode] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  const navigatorRef = useRef<HTMLDivElement>(null);

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
    displayRef,
    scaleToFit,
    zoomLevel,
    panMode,
  });

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

  // Track scroll position for navigator
  useEffect(() => {
    const display = displayRef.current;
    if (!display) return;

    const handleScroll = () => {
      setScrollPos({
        left: display.scrollLeft,
        top: display.scrollTop,
      });
    };

    display.addEventListener('scroll', handleScroll);
    return () => display.removeEventListener('scroll', handleScroll);
  }, []);

  // Navigator click handler - scroll to clicked position
  const handleNavigatorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!displayRef.current || !imgRef.current || !navigatorRef.current || scaleToFit) return;

    const navRect = navigatorRef.current.getBoundingClientRect();
    const clickX = e.clientX - navRect.left;
    const clickY = e.clientY - navRect.top;

    // Calculate relative position (0-1)
    const relX = clickX / navRect.width;
    const relY = clickY / navRect.height;

    // Calculate actual image dimensions when zoomed
    const imgWidth = imgRef.current.naturalWidth * zoomLevel;
    const imgHeight = imgRef.current.naturalHeight * zoomLevel;

    // Calculate scroll position to center viewport on clicked point
    const containerWidth = displayRef.current.clientWidth;
    const containerHeight = displayRef.current.clientHeight;

    const newScrollLeft = relX * imgWidth - containerWidth / 2 + 20; // 20 = padding
    const newScrollTop = relY * imgHeight - containerHeight / 2 + 20;

    displayRef.current.scrollTo({
      left: Math.max(0, newScrollLeft),
      top: Math.max(0, newScrollTop),
      behavior: 'smooth',
    });
  };

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
    setShowMask((prev) => {
      // Khi bật show mask, reset về chế độ fit-to-window
      if (!prev) {
        setScaleToFit(true);
        setZoomLevel(DEFAULT_ZOOM_LEVEL);
      }
      return !prev;
    });
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
                  <table className="features-table combined-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Area</th>
                        <th>X</th>
                        <th>Y</th>
                        <th>Int.</th>
                        {frameFeatures.some(f => f.speed !== null) && (
                          <>
                            <th>Spd</th>
                            <th>Trn</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {frameFeatures.map((feature) => (
                        <tr key={feature.id}>
                          <td className="cell-id">{feature.cell_id}</td>
                          <td>{formatValue(feature.area, 0)}</td>
                          <td>{formatValue(feature.centroid_col, 0)}</td>
                          <td>{formatValue(feature.centroid_row, 0)}</td>
                          <td>{formatValue(feature.mean_intensity, 0)}</td>
                          {frameFeatures.some(f => f.speed !== null) && (
                            <>
                              <td className="motion-cell">{formatValue(feature.speed, 1)}</td>
                              <td className="motion-cell">{formatValue(feature.turning, 2)}</td>
                            </>
                          )}
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
          className={`${showMask && scaleToFit ? 'show-mask-layout' : ''} ${!scaleToFit ? 'zoom-mode' : ''} ${panMode ? 'pan-mode' : ''} ${isPanning ? 'pan-active' : ''}`}
          onMouseDown={handlePanMouseDown}
          onMouseMove={handlePanMouseMove}
          onMouseUp={handlePanMouseUp}
          onMouseLeave={handlePanMouseLeave}
        >
          {currentImageURL && (
            <div
              id="image-wrapper"
              ref={wrapperRef}
              className={`${!scaleToFit ? 'zoom-wrapper' : ''}`}
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

          {/* Navigator Box - shows minimap with viewport rectangle when zoomed */}
          {!scaleToFit && currentImageURL && imgRef.current && displayRef.current && (
            <div
              ref={navigatorRef}
              className="navigator-box"
              onClick={handleNavigatorClick}
              title="Click to navigate"
            >
              <img
                src={currentImageURL}
                alt="Navigator"
                className="navigator-image"
                draggable={false}
              />
              {/* Viewport rectangle */}
              <div
                className="navigator-viewport"
                style={{
                  left: `${(scrollPos.left / (imgRef.current.naturalWidth * zoomLevel)) * 100}%`,
                  top: `${(scrollPos.top / (imgRef.current.naturalHeight * zoomLevel)) * 100}%`,
                  width: `${(displayRef.current.clientWidth / (imgRef.current.naturalWidth * zoomLevel)) * 100}%`,
                  height: `${(displayRef.current.clientHeight / (imgRef.current.naturalHeight * zoomLevel)) * 100}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Crop Controls - outside image-display to avoid overflow issues */}
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
    </div>
  );
};

export default ImageView;
