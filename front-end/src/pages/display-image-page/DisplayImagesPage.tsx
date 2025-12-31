import { useLocation } from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';
import CellFeaturesTable from '../../components/cell-features-table/CellFeaturesTable';
import AnalysisResults from '../../components/analysis-results/AnalysisResults';
import ArticleSearch from '../../components/article-search/ArticleSearch';
import ClusteringDialog from '../../components/clustering-dialog/ClusteringDialog';
import ProgressDialog from '../../components/progress-dialog/ProgressDialog';
import { FaFileCircleXmark } from "react-icons/fa6"
import './DisplayImagesPage.css';
import { useEffect, useState, useCallback } from 'react';
import type { ImageInfo } from '../../types/image';
import axios from 'axios';
import { TOOL_EVENT_NAME, TOOL_PROGRESS_EVENT, type ToolActionPayload, type ToolProgressPayload } from '../../utils/nav-bar/toolUtils';
import VirtualSequencePlayer, { type SequenceFrame } from "../../components/virtual-sequence/VirtualSequencePlayer";
import VirtualSequenceImportDialog from "../../components/virtual-sequence/VirtualSequenceImportDialog";
import {  VIRTUAL_SEQUENCE_IMPORT_EVENT } from "../../utils/nav-bar/fileUtils";
import { getSessionId } from '../../utils/common/getSessionId';
import { useResetCurrentSessionOnClose } from '../../utils/common/sessionLifecycle';
import Swal from "sweetalert2";

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

const DisplayImagesPage = () => {
  useResetCurrentSessionOnClose();
  const [imageArray, setImageArray] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeaturesTable, setShowFeaturesTable] = useState(false);
  const [featuresRefreshKey, setFeaturesRefreshKey] = useState(0);
  const [showAnalysisResults, setShowAnalysisResults] = useState(false);
  const [showClusteringDialog, setShowClusteringDialog] = useState(false);
  const [progressState, setProgressState] = useState<{ open: boolean; title?: string; message?: string }>({
    open: false,
    title: '',
    message: ''
  });
  const [showVirtualImport, setShowVirtualImport] = useState(false);
  const [showVirtualPlayer, setShowVirtualPlayer] = useState(false);
  const [sequenceFrames, setSequenceFrames] = useState<SequenceFrame[]>([]);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const location = useLocation();

  const refetchImages = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/`, {
        headers: {
          "X-Session-Id": getSessionId()
        },
      });
      const images: ImageInfo[] = res.data.images ?? [];
      setImageArray(images);
    } catch (err: any) {
      console.error("Failed to refetch images:", err);
    }
  }, []);

  const clearVirtualSequence = () => {
    sequenceFrames.forEach((f) => {
      try {
        URL.revokeObjectURL(f.url);
      } catch {}
    });
    setSequenceFrames([]);
    setShowVirtualPlayer(false);
  };

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axios.get(`${API_BASE_URL}/`, {
          headers: {
            "X-Session-Id": getSessionId()
          },
        });
        const images: ImageInfo[] = res.data.images ?? [];
        setImageArray(images);
      } catch (err: any) {
        setError("Failed to load images. Please try reloading or re-uploading the dataset.");
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [location.key]);

  useEffect(() => {
    const onDatasetCleared = () => {
      setImageArray([]);
    };

    window.addEventListener('datasetCleared', onDatasetCleared);
    return () => {
      window.removeEventListener('datasetCleared', onDatasetCleared);
    };
  }, []);

  useEffect(() => {
    const handleOpenVirtual = () => {
      clearVirtualSequence();
      setShowVirtualImport(true);
    };

    window.addEventListener(
      VIRTUAL_SEQUENCE_IMPORT_EVENT,
      handleOpenVirtual as EventListener
    );
    return () => {
      window.removeEventListener(
        VIRTUAL_SEQUENCE_IMPORT_EVENT,
        handleOpenVirtual as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const handleProgress = (e: CustomEvent<ToolProgressPayload>) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.open) {
        setProgressState({
          open: true,
          title: detail.title || 'Processing',
          message: detail.message || 'Please wait...'
        });
      } else {
        setProgressState(prev => ({ ...prev, open: false }));
      }
    };

    window.addEventListener(TOOL_PROGRESS_EVENT, handleProgress as EventListener);
    return () => window.removeEventListener(TOOL_PROGRESS_EVENT, handleProgress as EventListener);
  }, []);

  useEffect(() => {
    const handleToolAction = (e: CustomEvent<ToolActionPayload>) => {
      console.log('Tool action received:', e.detail.type);
      if (e.detail.type === 'SHOW_FEATURES') {
        setShowFeaturesTable(true);
      }
      if (e.detail.type === 'SHOW_ANALYSIS') {
        console.log('Setting showAnalysisResults to true');
        setShowAnalysisResults(true);
      }
      if (e.detail.type === 'OPEN_CLUSTERING_DIALOG') {
        console.log('Setting showClusteringDialog to true');
        setShowClusteringDialog(true);
      }
      // After segmentation completes, reload images to get updated mask data
      if (e.detail.type === 'SEGMENTATION') {
        console.log('Segmentation completed, refetching images to load masks...');
        refetchImages();
      }
      // After feature extraction completes, trigger refresh for CellFeaturesTable
      if (e.detail.type === 'EXTRACT_FEATURES') {
        console.log('Feature extraction completed, triggering features table refresh...');
        setFeaturesRefreshKey(prev => prev + 1);
      }
      // After tracking completes, also refresh features (tracking updates motion features)
      if (e.detail.type === 'TRACKING') {
        console.log('Tracking completed, triggering features table refresh...');
        setFeaturesRefreshKey(prev => prev + 1);
      }
      // After clustering completes, also refresh features (clustering updates gmm_state/hmm_state)
      if (e.detail.type === 'CLUSTERING') {
        console.log('Clustering completed, triggering features table refresh...');
        setFeaturesRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener(TOOL_EVENT_NAME, handleToolAction as EventListener);
    return () => {
      window.removeEventListener(TOOL_EVENT_NAME, handleToolAction as EventListener);
    };
  }, [refetchImages]);

  useEffect(() => {
    const handleToggleArticleSearch = () => {
      setShowArticleSearch(prev => !prev);
    };

    window.addEventListener('toggle-article-search', handleToggleArticleSearch);
    return () => {
      window.removeEventListener('toggle-article-search', handleToggleArticleSearch);
    };
  }, []);

  const handleVirtualImportConfirm = async (config: {
    files: File[];
    start: number;
    count: number;
    step: number;
  }) => {
    const { files, start, count, step } = config;
    if (!files || files.length === 0) return;

    const total = files.length;
    const startIndex = Math.max(0, start - 1);
    const stepValue = Math.max(1, step);
    const maxFrames = count > 0 ? count : total;

    const selectedFiles: File[] = [];
    let index = startIndex;
    let used = 0;

    while (index < total && used < maxFrames) {
      selectedFiles.push(files[index]);
      index += stepValue;
      used += 1;
    }

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));

      const res = await axios.post(
        `${API_BASE_URL}/virtual-sequence/preview`,
        formData,
        {
          headers: { 
            "Content-Type": "multipart/form-data", 
            "X-Session-Id": getSessionId() 
          },
        }
      );

      const framesResp = (res.data && res.data.frames) || [];
      const frames: SequenceFrame[] = framesResp
        .filter((f: any) => f.url)
        .map((f: any) => ({
          url: f.url as string,
          name: f.name as string,
        }));

      if (frames.length === 0) {
        setShowVirtualImport(false);
        return;
      }

      clearVirtualSequence();
      setSequenceFrames(frames);
      setShowVirtualImport(false);
      setShowVirtualPlayer(true);
    } catch (err) {
      console.error("Error loading virtual sequence preview:", err);
      await Swal.fire({
        title: "Unable to load Virtual Sequence",
         text: "Failed to generate the Virtual Sequence preview. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#3085d6",
      });
    }
  };

  const handleCloseVirtualPlayer = () => {
    clearVirtualSequence();
  };

  if (loading) {
    return (
      <div className="display-images-page">
        <NavBar />
        <ToolBar />
        <div id="no-image">
          <h2 id="no-image-mess">Loading images...</h2>
        </div>
        <AnalysisResults
          isOpen={showAnalysisResults}
          onClose={() => setShowAnalysisResults(false)}
        />
        <ClusteringDialog
          isOpen={showClusteringDialog}
          onClose={() => setShowClusteringDialog(false)}
          onSuccess={() => {}}
        />
        <ProgressDialog
          isOpen={progressState.open}
          title={progressState.title}
          message={progressState.message}
        />
        <VirtualSequenceImportDialog
          isOpen={showVirtualImport}
          onCancel={() => {
            clearVirtualSequence();
            setShowVirtualImport(false);
          }}
          onConfirm={handleVirtualImportConfirm}
        />
        <VirtualSequencePlayer
          isOpen={showVirtualPlayer}
          onClose={handleCloseVirtualPlayer}
          frames={sequenceFrames}
        />
        <ArticleSearch
          isOpen={showArticleSearch}
          onClose={() => setShowArticleSearch(false)}
        />
      </div>
    );
  }

  if (error || !imageArray || imageArray.length === 0) {
    return (
      <div className="display-images-page">
        <NavBar />
        <ToolBar />
        <div id="no-image">
          <h2 id="no-image-mess">
            {error || "No image uploaded"}
          </h2>
          <FaFileCircleXmark id='no-image-icon' />
        </div>
        <AnalysisResults
          isOpen={showAnalysisResults}
          onClose={() => setShowAnalysisResults(false)}
        />
        <ClusteringDialog
          isOpen={showClusteringDialog}
          onClose={() => setShowClusteringDialog(false)}
          onSuccess={() => {}}
        />
        <ProgressDialog
          isOpen={progressState.open}
          title={progressState.title}
          message={progressState.message}
        />
        <VirtualSequenceImportDialog
          isOpen={showVirtualImport}
          onCancel={() => {
            clearVirtualSequence();
            setShowVirtualImport(false);
          }}
          onConfirm={handleVirtualImportConfirm}
        />
        <VirtualSequencePlayer
          isOpen={showVirtualPlayer}
          onClose={handleCloseVirtualPlayer}
          frames={sequenceFrames}
        />
        <ArticleSearch
          isOpen={showArticleSearch}
          onClose={() => setShowArticleSearch(false)}
        />
      </div>
    );
  }

  return (
    <div className="display-images-page">
      <NavBar />
      <ToolBar />
      <ImageView imageArray={imageArray} />
      <CellFeaturesTable
        isOpen={showFeaturesTable}
        onClose={() => setShowFeaturesTable(false)}
        refreshTrigger={featuresRefreshKey}
      />
      <AnalysisResults
        isOpen={showAnalysisResults}
        onClose={() => setShowAnalysisResults(false)}
      />
      <ClusteringDialog
        isOpen={showClusteringDialog}
        onClose={() => setShowClusteringDialog(false)}
        onSuccess={() => {}}
      />
      <ProgressDialog
        isOpen={progressState.open}
        title={progressState.title}
        message={progressState.message}
      />
      <VirtualSequenceImportDialog
        isOpen={showVirtualImport}
        onCancel={() => {
          clearVirtualSequence();
          setShowVirtualImport(false);
        }}
        onConfirm={handleVirtualImportConfirm}
      />
      <VirtualSequencePlayer
        isOpen={showVirtualPlayer}
        onClose={handleCloseVirtualPlayer}
        frames={sequenceFrames}
      />
      <ArticleSearch
        isOpen={showArticleSearch}
        onClose={() => setShowArticleSearch(false)}
      />
    </div>
  );
};

export default DisplayImagesPage;
