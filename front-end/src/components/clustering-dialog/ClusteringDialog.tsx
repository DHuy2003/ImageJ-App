import { useState } from 'react';
import { X, Play, Settings } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { TOOL_PROGRESS_EVENT, type ToolProgressPayload } from '../../utils/nav-bar/toolUtils';
import './ClusteringDialog.css';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

interface FeatureOption {
    key: string;
    label: string;
    description: string;
    category: 'morphology' | 'intensity' | 'motion' | 'position' | 'bounding_box';
}

const AVAILABLE_FEATURES: FeatureOption[] = [
    // Morphology features
    { key: 'area', label: 'Area', description: 'Cell area in pixels', category: 'morphology' },
    { key: 'convex_area', label: 'Convex Area', description: 'Area of convex hull', category: 'morphology' },
    { key: 'major_axis_length', label: 'Major Axis', description: 'Length of major axis', category: 'morphology' },
    { key: 'minor_axis_length', label: 'Minor Axis', description: 'Length of minor axis', category: 'morphology' },
    { key: 'aspect_ratio', label: 'Aspect Ratio', description: 'Major/Minor axis ratio', category: 'morphology' },
    { key: 'eccentricity', label: 'Eccentricity', description: 'Shape elongation (0=circle, 1=line)', category: 'morphology' },
    { key: 'solidity', label: 'Solidity', description: 'Area / Convex hull area', category: 'morphology' },
    { key: 'circularity', label: 'Circularity', description: 'How circular the cell is (4π×Area/Perimeter²)', category: 'morphology' },
    { key: 'extent', label: 'Extent', description: 'Ratio of cell area to bounding box area', category: 'morphology' },

    // Intensity features
    { key: 'mean_intensity', label: 'Mean Intensity', description: 'Average pixel intensity', category: 'intensity' },
    { key: 'max_intensity', label: 'Max Intensity', description: 'Maximum pixel intensity', category: 'intensity' },
    { key: 'min_intensity', label: 'Min Intensity', description: 'Minimum pixel intensity', category: 'intensity' },
    { key: 'intensity_ratio_max_mean', label: 'Max/Mean Ratio', description: 'Ratio of max to mean intensity', category: 'intensity' },
    { key: 'intensity_ratio_mean_min', label: 'Mean/Min Ratio', description: 'Ratio of mean to min intensity', category: 'intensity' },

    // Position features
    { key: 'centroid_row', label: 'Centroid Y', description: 'Y coordinate of cell center', category: 'position' },
    { key: 'centroid_col', label: 'Centroid X', description: 'X coordinate of cell center', category: 'position' },

    // Bounding box features
    { key: 'min_row_bb', label: 'BB Min Row', description: 'Bounding box top edge', category: 'bounding_box' },
    { key: 'min_col_bb', label: 'BB Min Col', description: 'Bounding box left edge', category: 'bounding_box' },
    { key: 'max_row_bb', label: 'BB Max Row', description: 'Bounding box bottom edge', category: 'bounding_box' },
    { key: 'max_col_bb', label: 'BB Max Col', description: 'Bounding box right edge', category: 'bounding_box' },
    { key: 'bb_height', label: 'BB Height', description: 'Bounding box height', category: 'bounding_box' },
    { key: 'bb_width', label: 'BB Width', description: 'Bounding box width', category: 'bounding_box' },
    { key: 'bb_area', label: 'BB Area', description: 'Bounding box area', category: 'bounding_box' },
    { key: 'bb_extent', label: 'BB Extent', description: 'Cell area / BB area ratio', category: 'bounding_box' },
    { key: 'bb_aspect_ratio', label: 'BB Aspect Ratio', description: 'BB width / BB height', category: 'bounding_box' },

    // Motion features
    { key: 'speed', label: 'Speed', description: 'Cell movement speed (px/frame)', category: 'motion' },
    { key: 'displacement', label: 'Displacement', description: 'Distance from previous position', category: 'motion' },
    { key: 'delta_x', label: 'Delta X', description: 'X displacement from previous frame', category: 'motion' },
    { key: 'delta_y', label: 'Delta Y', description: 'Y displacement from previous frame', category: 'motion' },
    { key: 'turning', label: 'Turning Angle', description: 'Direction change angle', category: 'motion' },
];

interface ClusteringDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (result: any) => void;
}

const ClusteringDialog = ({ isOpen, onClose, onSuccess }: ClusteringDialogProps) => {
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
        'area', 'eccentricity', 'mean_intensity', 'speed'
    ]);
    const [nComponents, setNComponents] = useState<number | 'auto'>('auto');
    const [useHMM, setUseHMM] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dispatchProgress = (payload: ToolProgressPayload) => {
        window.dispatchEvent(new CustomEvent(TOOL_PROGRESS_EVENT, { detail: payload }));
    };

    const handleFeatureToggle = (featureKey: string) => {
        setSelectedFeatures(prev => {
            if (prev.includes(featureKey)) {
                return prev.filter(f => f !== featureKey);
            } else {
                return [...prev, featureKey];
            }
        });
    };

    const handleSelectAll = (category: 'morphology' | 'intensity' | 'motion' | 'position' | 'bounding_box') => {
        const categoryFeatures = AVAILABLE_FEATURES
            .filter(f => f.category === category)
            .map(f => f.key);

        const allSelected = categoryFeatures.every(f => selectedFeatures.includes(f));

        if (allSelected) {
            setSelectedFeatures(prev => prev.filter(f => !categoryFeatures.includes(f)));
        } else {
            setSelectedFeatures(prev => [...new Set([...prev, ...categoryFeatures])]);
        }
    };

    const handleRunClustering = async () => {
        if (selectedFeatures.length === 0) {
            setError('Please select at least one feature');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            dispatchProgress({
                open: true,
                title: 'Đang chạy Clustering',
                message: useHMM
                    ? 'Đang chạy GMM và HMM smoothing...'
                    : 'Đang chạy GMM clustering...'
            });
            const response = await axios.post(`${API_BASE_URL}/clustering/run`, {
                features: selectedFeatures,
                n_components: nComponents === 'auto' ? null : nComponents,
                use_hmm: useHMM
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('Clustering result:', response.data);
            onSuccess(response.data);
            onClose();

            // Dispatch event to update UI
            window.dispatchEvent(new CustomEvent('clusteringComplete'));

            const gmmResult = response.data.result?.gmm || {};

            // Save clustering info to localStorage for BIC/AIC visualization
            if (gmmResult.scores) {
                const clusteringInfo = {
                    scores: gmmResult.scores,
                    optimal_components: gmmResult.optimal_components,
                    optimal_k_by_bic: gmmResult.optimal_k_by_bic,
                    optimal_k_by_aic: gmmResult.optimal_k_by_aic,
                    selection_method: gmmResult.selection_method
                };
                localStorage.setItem('clusteringInfo', JSON.stringify(clusteringInfo));
            }
            void response.data.result?.hmm; // HMM result available but not used yet

            const statsHtml = `
                <div style="text-align:left;margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                        <span style="color:#666;font-size:13px;">Clusters Identified</span>
                        <span style="font-weight:600;color:#333;font-size:14px;">${gmmResult.optimal_components || 0}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                        <span style="color:#666;font-size:13px;">Selection Method</span>
                        <span style="font-weight:600;color:#333;font-size:14px;">${gmmResult.selection_method || 'N/A'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                        <span style="color:#666;font-size:13px;">Optimal k (BIC)</span>
                        <span style="font-weight:600;color:#e74c3c;font-size:14px;">${gmmResult.optimal_k_by_bic || 'N/A'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                        <span style="color:#666;font-size:13px;">Optimal k (AIC)</span>
                        <span style="font-weight:600;color:#3498db;font-size:14px;">${gmmResult.optimal_k_by_aic || 'N/A'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                        <span style="color:#666;font-size:13px;">Features Used</span>
                        <span style="font-weight:600;color:#333;font-size:14px;">${selectedFeatures.length}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                        <span style="color:#666;font-size:13px;">HMM Smoothing</span>
                        <span style="font-weight:600;color:#333;font-size:14px;">${useHMM ? 'Applied' : 'Disabled'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;">
                        <span style="color:#666;font-size:13px;">Total Cells</span>
                        <span style="font-weight:600;color:#333;font-size:14px;">${gmmResult.total_cells || 'N/A'}</span>
                    </div>
                </div>
            `;

            Swal.fire({
                title: 'Clustering Complete',
                html: statsHtml,
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#27ae60',
            });
        } catch (err: any) {
            console.error('Clustering error:', err);
            setError(err.response?.data?.error || 'Clustering failed');
        } finally {
            setLoading(false);
            dispatchProgress({ open: false });
        }
    };

    if (!isOpen) return null;

    const morphologyFeatures = AVAILABLE_FEATURES.filter(f => f.category === 'morphology');
    const intensityFeatures = AVAILABLE_FEATURES.filter(f => f.category === 'intensity');
    const positionFeatures = AVAILABLE_FEATURES.filter(f => f.category === 'position');
    const boundingBoxFeatures = AVAILABLE_FEATURES.filter(f => f.category === 'bounding_box');
    const motionFeatures = AVAILABLE_FEATURES.filter(f => f.category === 'motion');

    return (
        <div className="clustering-dialog-overlay">
            <div className="clustering-dialog">
                <div className="dialog-header">
                    <div className="header-title">
                        <Settings size={20} />
                        <h2>Clustering Configuration</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="dialog-content">
                    <div className="section">
                        <h3>Select Features for Clustering</h3>
                        <p className="section-description">
                            Choose which features to use as input for the GMM/HMM clustering algorithm.
                        </p>

                        <div className="feature-categories">
                            {/* Morphology Features */}
                            <div className="feature-category">
                                <div className="category-header">
                                    <span className="category-title morphology">Morphology</span>
                                    <button
                                        className="select-all-btn"
                                        onClick={() => handleSelectAll('morphology')}
                                    >
                                        {morphologyFeatures.every(f => selectedFeatures.includes(f.key))
                                            ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="feature-list">
                                    {morphologyFeatures.map(feature => (
                                        <label key={feature.key} className="feature-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedFeatures.includes(feature.key)}
                                                onChange={() => handleFeatureToggle(feature.key)}
                                            />
                                            <span className="feature-info">
                                                <span className="feature-label">{feature.label}</span>
                                                <span className="feature-desc">{feature.description}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Intensity Features */}
                            <div className="feature-category">
                                <div className="category-header">
                                    <span className="category-title intensity">Intensity</span>
                                    <button
                                        className="select-all-btn"
                                        onClick={() => handleSelectAll('intensity')}
                                    >
                                        {intensityFeatures.every(f => selectedFeatures.includes(f.key))
                                            ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="feature-list">
                                    {intensityFeatures.map(feature => (
                                        <label key={feature.key} className="feature-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedFeatures.includes(feature.key)}
                                                onChange={() => handleFeatureToggle(feature.key)}
                                            />
                                            <span className="feature-info">
                                                <span className="feature-label">{feature.label}</span>
                                                <span className="feature-desc">{feature.description}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Position Features */}
                            <div className="feature-category">
                                <div className="category-header">
                                    <span className="category-title position">Position</span>
                                    <button
                                        className="select-all-btn"
                                        onClick={() => handleSelectAll('position')}
                                    >
                                        {positionFeatures.every(f => selectedFeatures.includes(f.key))
                                            ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="feature-list">
                                    {positionFeatures.map(feature => (
                                        <label key={feature.key} className="feature-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedFeatures.includes(feature.key)}
                                                onChange={() => handleFeatureToggle(feature.key)}
                                            />
                                            <span className="feature-info">
                                                <span className="feature-label">{feature.label}</span>
                                                <span className="feature-desc">{feature.description}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Bounding Box Features */}
                            <div className="feature-category">
                                <div className="category-header">
                                    <span className="category-title bounding-box">Bounding Box</span>
                                    <button
                                        className="select-all-btn"
                                        onClick={() => handleSelectAll('bounding_box')}
                                    >
                                        {boundingBoxFeatures.every(f => selectedFeatures.includes(f.key))
                                            ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="feature-list">
                                    {boundingBoxFeatures.map(feature => (
                                        <label key={feature.key} className="feature-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedFeatures.includes(feature.key)}
                                                onChange={() => handleFeatureToggle(feature.key)}
                                            />
                                            <span className="feature-info">
                                                <span className="feature-label">{feature.label}</span>
                                                <span className="feature-desc">{feature.description}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Motion Features */}
                            <div className="feature-category">
                                <div className="category-header">
                                    <span className="category-title motion">Motion</span>
                                    <button
                                        className="select-all-btn"
                                        onClick={() => handleSelectAll('motion')}
                                    >
                                        {motionFeatures.every(f => selectedFeatures.includes(f.key))
                                            ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="feature-list">
                                    {motionFeatures.map(feature => (
                                        <label key={feature.key} className="feature-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedFeatures.includes(feature.key)}
                                                onChange={() => handleFeatureToggle(feature.key)}
                                            />
                                            <span className="feature-info">
                                                <span className="feature-label">{feature.label}</span>
                                                <span className="feature-desc">{feature.description}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="section">
                        <h3>Algorithm Settings</h3>

                        <div className="settings-grid">
                            <div className="setting-item">
                                <label>Number of Clusters</label>
                                <select
                                    value={nComponents === 'auto' ? 'auto' : nComponents}
                                    onChange={(e) => setNComponents(
                                        e.target.value === 'auto' ? 'auto' : parseInt(e.target.value)
                                    )}
                                >
                                    <option value="auto">Auto (BIC + AIC)</option>
                                    <option value="2">2 clusters</option>
                                    <option value="3">3 clusters</option>
                                    <option value="4">4 clusters</option>
                                    <option value="5">5 clusters</option>
                                    <option value="6">6 clusters</option>
                                    <option value="7">7 clusters</option>
                                    <option value="8">8 clusters</option>
                                </select>
                            </div>

                            <div className="setting-item">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={useHMM}
                                        onChange={(e) => setUseHMM(e.target.checked)}
                                    />
                                    <span>Use HMM for temporal smoothing</span>
                                </label>
                                <span className="setting-desc">
                                    Hidden Markov Model smooths cluster assignments over time
                                </span>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="selected-summary">
                        <span>{selectedFeatures.length} features selected</span>
                    </div>
                </div>

                <div className="dialog-footer">
                    <button className="cancel-btn" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="run-btn"
                        onClick={handleRunClustering}
                        disabled={loading || selectedFeatures.length === 0}
                    >
                        {loading ? (
                            <>Running...</>
                        ) : (
                            <>
                                <Play size={16} />
                                Run Clustering
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClusteringDialog;
