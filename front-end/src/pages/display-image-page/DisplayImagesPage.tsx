import { useLocation } from 'react-router-dom';
import NavBar from '../../components/nav-bar/NavBar';
import ToolBar from '../../components/tool-bar/ToolBar';
import ImageView from '../../components/image-view/ImageView';
import CellFeaturesTable from '../../components/cell-features-table/CellFeaturesTable';
import AnalysisResults from '../../components/analysis-results/AnalysisResults';
import ClusteringDialog from '../../components/clustering-dialog/ClusteringDialog';
import { FaFileCircleXmark } from "react-icons/fa6"
import './DisplayImagesPage.css';
import { useEffect, useState } from 'react';
import type { ImageInfo } from '../../types/image';
import axios from 'axios';
import { TOOL_EVENT_NAME, type ToolActionPayload } from '../../utils/nav-bar/toolUtils';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

const DisplayImagesPage = () => {
  const [imageArray, setImageArray] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeaturesTable, setShowFeaturesTable] = useState(false);
  const [showAnalysisResults, setShowAnalysisResults] = useState(false);
  const [showClusteringDialog, setShowClusteringDialog] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axios.get(`${API_BASE_URL}/`);
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
    };

    window.addEventListener(TOOL_EVENT_NAME, handleToolAction as EventListener);
    console.log('Tool event listener registered for:', TOOL_EVENT_NAME);
    return () => {
      window.removeEventListener(TOOL_EVENT_NAME, handleToolAction as EventListener);
    };
  }, []);

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
    </div>
  );
};

export default DisplayImagesPage;
