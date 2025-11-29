import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

export const TOOL_EVENT_NAME = 'toolAction';

export type ToolActionPayload = {
    type: 'SEGMENTATION' | 'TRACKING' | 'CLUSTERING' | 'EXTRACT_FEATURES' | 'SHOW_FEATURES' | 'SHOW_ANALYSIS' | 'OPEN_CLUSTERING_DIALOG';
    data?: any;
};

export const dispatchToolEvent = (payload: ToolActionPayload) => {
    window.dispatchEvent(new CustomEvent(TOOL_EVENT_NAME, { detail: payload }));
};

const jsonConfig = {
    headers: { 'Content-Type': 'application/json' }
};

export const handleSegmentation = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}/segmentation/batch`, {}, jsonConfig);
        console.log('Segmentation result:', response.data);
        alert(`Segmentation completed: ${response.data.result?.processed || 0} images processed`);
        dispatchToolEvent({ type: 'SEGMENTATION', data: response.data });
    } catch (error: any) {
        console.error('Segmentation error:', error);
        alert(`Segmentation failed: ${error.response?.data?.error || error.message}`);
    }
};

export const handleTracking = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}/tracking/run-gnn`, {}, jsonConfig);
        console.log('Tracking result:', response.data);
        alert(`Tracking completed: ${response.data.result?.total_tracks || 0} tracks found`);
        dispatchToolEvent({ type: 'TRACKING', data: response.data });
    } catch (error: any) {
        console.error('Tracking error:', error);
        alert(`Tracking failed: ${error.response?.data?.error || error.message}`);
    }
};

export const handleClustering = () => {
    // Open clustering dialog instead of running directly
    console.log('handleClustering called - dispatching OPEN_CLUSTERING_DIALOG');
    dispatchToolEvent({ type: 'OPEN_CLUSTERING_DIALOG' });
};

export const handleExtractFeatures = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}/features/extract/batch`, {}, jsonConfig);
        console.log('Feature extraction result:', response.data);
        alert(`Feature extraction completed: ${response.data.result?.processed || 0} images processed`);
        dispatchToolEvent({ type: 'EXTRACT_FEATURES', data: response.data });
    } catch (error: any) {
        console.error('Feature extraction error:', error);
        alert(`Feature extraction failed: ${error.response?.data?.error || error.message}`);
    }
};

export const handleShowFeatures = () => {
    dispatchToolEvent({ type: 'SHOW_FEATURES' });
};

export const handleShowAnalysis = () => {
    console.log('handleShowAnalysis called - dispatching SHOW_ANALYSIS');
    dispatchToolEvent({ type: 'SHOW_ANALYSIS' });
};
