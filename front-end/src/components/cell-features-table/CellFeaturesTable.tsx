import { useEffect, useState } from 'react';
import axios from 'axios';
import './CellFeaturesTable.css';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

interface CellFeature {
    id: number;
    image_id: number;
    cell_id: number;
    frame_num: number;
    track_id: number | null;
    // Morphology
    area: number | null;
    convex_area: number | null;
    major_axis_length: number | null;
    minor_axis_length: number | null;
    aspect_ratio: number | null;
    eccentricity: number | null;
    solidity: number | null;
    circularity: number | null;
    extent: number | null;
    // Position
    centroid_row: number | null;
    centroid_col: number | null;
    // Bounding box
    min_row_bb: number | null;
    min_col_bb: number | null;
    max_row_bb: number | null;
    max_col_bb: number | null;
    bb_height: number | null;
    bb_width: number | null;
    bb_area: number | null;
    bb_extent: number | null;
    bb_aspect_ratio: number | null;
    // Intensity
    mean_intensity: number | null;
    max_intensity: number | null;
    min_intensity: number | null;
    intensity_ratio_max_mean: number | null;
    intensity_ratio_mean_min: number | null;
    // Motion
    delta_x: number | null;
    delta_y: number | null;
    displacement: number | null;
    speed: number | null;
    turning: number | null;
    // Clustering states
    gmm_state: number | null;
    hmm_state: number | null;
}

interface CellFeaturesTableProps {
    isOpen: boolean;
    onClose: () => void;
}

// Define all available columns with their display names
const ALL_COLUMNS = [
    // Basic info
    { key: 'frame_num', label: 'Frame', category: 'basic' },
    { key: 'cell_id', label: 'Cell ID', category: 'basic' },
    { key: 'track_id', label: 'Track ID', category: 'basic' },
    // Morphology
    { key: 'area', label: 'Area', category: 'morphology' },
    { key: 'convex_area', label: 'Convex Area', category: 'morphology' },
    { key: 'major_axis_length', label: 'Major Axis', category: 'morphology' },
    { key: 'minor_axis_length', label: 'Minor Axis', category: 'morphology' },
    { key: 'aspect_ratio', label: 'Aspect Ratio', category: 'morphology' },
    { key: 'eccentricity', label: 'Eccentricity', category: 'morphology' },
    { key: 'solidity', label: 'Solidity', category: 'morphology' },
    { key: 'circularity', label: 'Circularity', category: 'morphology' },
    { key: 'extent', label: 'Extent', category: 'morphology' },
    // Position
    { key: 'centroid_col', label: 'Centroid X', category: 'position' },
    { key: 'centroid_row', label: 'Centroid Y', category: 'position' },
    // Bounding box
    { key: 'min_row_bb', label: 'BB Min Row', category: 'bounding_box' },
    { key: 'min_col_bb', label: 'BB Min Col', category: 'bounding_box' },
    { key: 'max_row_bb', label: 'BB Max Row', category: 'bounding_box' },
    { key: 'max_col_bb', label: 'BB Max Col', category: 'bounding_box' },
    { key: 'bb_height', label: 'BB Height', category: 'bounding_box' },
    { key: 'bb_width', label: 'BB Width', category: 'bounding_box' },
    { key: 'bb_area', label: 'BB Area', category: 'bounding_box' },
    { key: 'bb_extent', label: 'BB Extent', category: 'bounding_box' },
    { key: 'bb_aspect_ratio', label: 'BB Aspect Ratio', category: 'bounding_box' },
    // Intensity
    { key: 'mean_intensity', label: 'Mean Int.', category: 'intensity' },
    { key: 'max_intensity', label: 'Max Int.', category: 'intensity' },
    { key: 'min_intensity', label: 'Min Int.', category: 'intensity' },
    { key: 'intensity_ratio_max_mean', label: 'Max/Mean Ratio', category: 'intensity' },
    { key: 'intensity_ratio_mean_min', label: 'Mean/Min Ratio', category: 'intensity' },
    // Motion
    { key: 'delta_x', label: 'Delta X', category: 'motion' },
    { key: 'delta_y', label: 'Delta Y', category: 'motion' },
    { key: 'displacement', label: 'Displacement', category: 'motion' },
    { key: 'speed', label: 'Speed', category: 'motion' },
    { key: 'turning', label: 'Turning', category: 'motion' },
    // Clustering
    { key: 'gmm_state', label: 'GMM State', category: 'clustering' },
    { key: 'hmm_state', label: 'HMM State', category: 'clustering' },
];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = [
    'frame_num', 'cell_id', 'track_id', 'area', 'aspect_ratio', 'eccentricity',
    'centroid_col', 'centroid_row', 'mean_intensity', 'speed', 'gmm_state', 'hmm_state'
];

const CellFeaturesTable = ({ isOpen, onClose }: CellFeaturesTableProps) => {
    const [features, setFeatures] = useState<CellFeature[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [frameFilter, setFrameFilter] = useState<number | 'all'>('all');
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchFeatures();
        }
    }, [isOpen]);

    const fetchFeatures = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`${API_BASE_URL}/features`);
            setFeatures(response.data.features || []);
            setFrameFilter('all');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load features');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/features/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'cell_features.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export features');
        }
    };

    const formatValue = (value: number | null | undefined, columnKey?: string): string => {
        // Motion features default to 0 instead of '-'
        const motionKeys = ['delta_x', 'delta_y', 'displacement', 'speed', 'turning'];
        if (value === null || value === undefined) {
            if (columnKey && motionKeys.includes(columnKey)) {
                return '0';
            }
            return '-';
        }
        if (Number.isInteger(value)) return value.toString();
        return value.toFixed(2);
    };

    const frames = Array.from(new Set(features.map(f => f.frame_num))).sort((a, b) => a - b);
    const filteredFeatures = frameFilter === 'all'
        ? features
        : features.filter(f => f.frame_num === frameFilter);

    const toggleColumn = (columnKey: string) => {
        setVisibleColumns(prev =>
            prev.includes(columnKey)
                ? prev.filter(k => k !== columnKey)
                : [...prev, columnKey]
        );
    };

    const toggleCategoryColumns = (category: string) => {
        const categoryColumns = ALL_COLUMNS.filter(c => c.category === category).map(c => c.key);
        const allSelected = categoryColumns.every(k => visibleColumns.includes(k));

        if (allSelected) {
            setVisibleColumns(prev => prev.filter(k => !categoryColumns.includes(k)));
        } else {
            setVisibleColumns(prev => [...new Set([...prev, ...categoryColumns])]);
        }
    };

    const activeColumns = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key));

    const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
            basic: 'Basic',
            morphology: 'Morphology',
            position: 'Position',
            bounding_box: 'Bounding Box',
            intensity: 'Intensity',
            motion: 'Motion',
            clustering: 'Clustering'
        };
        return labels[category] || category;
    };

    if (!isOpen) return null;

    return (
        <div className="features-table-overlay">
            <div className="features-table-container">
                <div className="features-table-header">
                    <h2>Cell Features</h2>
                    <div className="features-table-actions">
                        <div className="frame-filter">
                            <label>Frame</label>
                            <select
                                value={frameFilter === 'all' ? 'all' : frameFilter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFrameFilter(val === 'all' ? 'all' : parseInt(val, 10));
                                }}
                            >
                                <option value="all">All frames</option>
                                {frames.map(frame => (
                                    <option key={frame} value={frame}>Frame {frame}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            className={showColumnSelector ? 'active' : ''}
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                        >
                            Columns ({visibleColumns.length})
                        </button>
                        <button onClick={fetchFeatures} disabled={loading}>
                            Refresh
                        </button>
                        <button onClick={handleExport} disabled={loading || features.length === 0}>
                            Export CSV
                        </button>
                        <button onClick={onClose}>Close</button>
                    </div>
                </div>

                {/* Column Selector Panel */}
                {showColumnSelector && (
                    <div className="column-selector-panel">
                        <div className="column-selector-header">
                            <span>Select Columns to Display</span>
                            <button onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}>Reset</button>
                            <button onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.key))}>All</button>
                        </div>
                        <div className="column-categories">
                            {['basic', 'morphology', 'position', 'bounding_box', 'intensity', 'motion', 'clustering'].map(category => {
                                const categoryColumns = ALL_COLUMNS.filter(c => c.category === category);
                                const allSelected = categoryColumns.every(c => visibleColumns.includes(c.key));

                                return (
                                    <div key={category} className="column-category">
                                        <div className="category-header">
                                            <label className="category-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={() => toggleCategoryColumns(category)}
                                                />
                                                <span className={`category-label ${category}`}>
                                                    {getCategoryLabel(category)}
                                                </span>
                                            </label>
                                        </div>
                                        <div className="category-columns">
                                            {categoryColumns.map(col => (
                                                <label key={col.key} className="column-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleColumns.includes(col.key)}
                                                        onChange={() => toggleColumn(col.key)}
                                                    />
                                                    <span>{col.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="features-table-content">
                    {loading && <p className="loading-text">Loading features...</p>}
                    {error && <p className="error-text">{error}</p>}

                    {!loading && !error && features.length === 0 && (
                        <p className="no-data-text">No features found. Run feature extraction first.</p>
                    )}

                    {!loading && !error && features.length > 0 && (
                        <table className="features-table">
                            <thead>
                                <tr>
                                    {activeColumns.map(col => (
                                        <th key={col.key} className={`col-${col.category}`}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFeatures.map((f) => (
                                    <tr key={f.id}>
                                        {activeColumns.map(col => (
                                            <td key={col.key}>
                                                {formatValue((f as any)[col.key], col.key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="features-table-footer">
                    <span>Total: {filteredFeatures.length} cells (dataset: {features.length}) | {visibleColumns.length} columns</span>
                </div>
            </div>
        </div>
    );
};

export default CellFeaturesTable;
