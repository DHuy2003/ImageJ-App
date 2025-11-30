import axios from 'axios';
import Swal from 'sweetalert2';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

// Professional notification helper
const showResultNotification = (
    title: string,
    stats: { label: string; value: string | number }[],
    type: 'success' | 'error' = 'success'
) => {
    const statsHtml = stats
        .map(s => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
            <span style="color:#666;font-size:13px;">${s.label}</span>
            <span style="font-weight:600;color:#333;font-size:14px;">${s.value}</span>
        </div>`)
        .join('');

    Swal.fire({
        title: title,
        html: `<div style="text-align:left;margin-top:12px;">${statsHtml}</div>`,
        icon: type,
        confirmButtonText: 'OK',
        confirmButtonColor: type === 'success' ? '#27ae60' : '#e74c3c',
        customClass: {
            popup: 'result-notification-popup',
            title: 'result-notification-title',
        }
    });
};

const showErrorNotification = (title: string, message: string) => {
    Swal.fire({
        title: title,
        text: message,
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#e74c3c',
    });
};

export const TOOL_EVENT_NAME = 'toolAction';
export const TOOL_PROGRESS_EVENT = 'toolProgress';

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

export type ToolProgressPayload = {
    open: boolean;
    title?: string;
    message?: string;
};

const dispatchProgress = (payload: ToolProgressPayload) => {
    window.dispatchEvent(new CustomEvent(TOOL_PROGRESS_EVENT, { detail: payload }));
};

export const handleSegmentation = async () => {
    try {
        dispatchProgress({
            open: true,
            title: 'Đang chạy Segmentation',
            message: 'Cellpose đang tách cell, vui lòng đợi...'
        });
        const response = await axios.post(`${API_BASE_URL}/segmentation/batch`, {}, jsonConfig);
        console.log('Segmentation result:', response.data);

        const result = response.data.result || {};
        showResultNotification('Segmentation Complete', [
            { label: 'Images Processed', value: result.processed || 0 },
            { label: 'Total Cells Detected', value: result.total_cells || 'N/A' },
            { label: 'Status', value: 'Success' }
        ]);

        dispatchToolEvent({ type: 'SEGMENTATION', data: response.data });
    } catch (error: any) {
        console.error('Segmentation error:', error);
        showErrorNotification('Segmentation Failed', error.response?.data?.error || error.message);
    } finally {
        dispatchProgress({ open: false });
    }
};

export const handleTracking = async () => {
    try {
        dispatchProgress({
            open: true,
            title: 'Đang chạy Tracking',
            message: 'GNN đang liên kết track giữa các frame...'
        });
        const response = await axios.post(`${API_BASE_URL}/tracking/run-gnn`, {}, jsonConfig);
        console.log('Tracking result:', response.data);

        const result = response.data.result || {};
        showResultNotification('Cell Tracking Complete', [
            { label: 'Total Tracks', value: result.total_tracks || 0 },
            { label: 'Total Cells Linked', value: result.total_cells || 'N/A' },
            { label: 'Frames Processed', value: result.frames_processed || 'N/A' },
            { label: 'Status', value: 'Success' }
        ]);

        dispatchToolEvent({ type: 'TRACKING', data: response.data });
    } catch (error: any) {
        console.error('Tracking error:', error);
        showErrorNotification('Tracking Failed', error.response?.data?.error || error.message);
    } finally {
        dispatchProgress({ open: false });
    }
};

export const handleClustering = () => {
    // Open clustering dialog instead of running directly
    console.log('handleClustering called - dispatching OPEN_CLUSTERING_DIALOG');
    dispatchToolEvent({ type: 'OPEN_CLUSTERING_DIALOG' });
};

export const handleExtractFeatures = async () => {
    try {
        dispatchProgress({
            open: true,
            title: 'Đang trích xuất đặc trưng',
            message: 'Đang đo lường cell từ mask, vui lòng đợi...'
        });
        const response = await axios.post(`${API_BASE_URL}/features/extract/batch`, {}, jsonConfig);
        console.log('Feature extraction result:', response.data);

        const result = response.data.result || {};
        showResultNotification('Feature Extraction Complete', [
            { label: 'Images Processed', value: result.processed || 0 },
            { label: 'Total Features', value: result.total_features || 'N/A' },
            { label: 'Features per Cell', value: result.features_per_cell || '15+' },
            { label: 'Status', value: 'Success' }
        ]);

        dispatchToolEvent({ type: 'EXTRACT_FEATURES', data: response.data });
    } catch (error: any) {
        console.error('Feature extraction error:', error);
        showErrorNotification('Feature Extraction Failed', error.response?.data?.error || error.message);
    } finally {
        dispatchProgress({ open: false });
    }
};

export const handleShowFeatures = () => {
    dispatchToolEvent({ type: 'SHOW_FEATURES' });
};

export const handleShowAnalysis = () => {
    console.log('handleShowAnalysis called - dispatching SHOW_ANALYSIS');
    dispatchToolEvent({ type: 'SHOW_ANALYSIS' });
};
