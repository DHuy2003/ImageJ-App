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
    area: number | null;
    centroid_row: number | null;
    centroid_col: number | null;
    major_axis_length: number | null;
    minor_axis_length: number | null;
    aspect_ratio: number | null;
    eccentricity: number | null;
    solidity: number | null;
    circularity: number | null;
    mean_intensity: number | null;
    max_intensity: number | null;
    min_intensity: number | null;
    gmm_state: number | null;
    hmm_state: number | null;
}

interface CellFeaturesTableProps {
    isOpen: boolean;
    onClose: () => void;
}

const CellFeaturesTable = ({ isOpen, onClose }: CellFeaturesTableProps) => {
    const [features, setFeatures] = useState<CellFeature[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const formatValue = (value: number | null | undefined): string => {
        if (value === null || value === undefined) return '-';
        if (Number.isInteger(value)) return value.toString();
        return value.toFixed(2);
    };

    if (!isOpen) return null;

    return (
        <div className="features-table-overlay">
            <div className="features-table-container">
                <div className="features-table-header">
                    <h2>Cell Features</h2>
                    <div className="features-table-actions">
                        <button onClick={fetchFeatures} disabled={loading}>
                            Refresh
                        </button>
                        <button onClick={handleExport} disabled={loading || features.length === 0}>
                            Export CSV
                        </button>
                        <button onClick={onClose}>Close</button>
                    </div>
                </div>

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
                                    <th>Frame</th>
                                    <th>Cell ID</th>
                                    <th>Track ID</th>
                                    <th>Area</th>
                                    <th>Centroid X</th>
                                    <th>Centroid Y</th>
                                    <th>Major Axis</th>
                                    <th>Minor Axis</th>
                                    <th>Aspect Ratio</th>
                                    <th>Eccentricity</th>
                                    <th>Solidity</th>
                                    <th>Circularity</th>
                                    <th>Mean Int.</th>
                                    <th>GMM State</th>
                                    <th>HMM State</th>
                                </tr>
                            </thead>
                            <tbody>
                                {features.map((f) => (
                                    <tr key={f.id}>
                                        <td>{f.frame_num}</td>
                                        <td>{f.cell_id}</td>
                                        <td>{f.track_id ?? '-'}</td>
                                        <td>{formatValue(f.area)}</td>
                                        <td>{formatValue(f.centroid_col)}</td>
                                        <td>{formatValue(f.centroid_row)}</td>
                                        <td>{formatValue(f.major_axis_length)}</td>
                                        <td>{formatValue(f.minor_axis_length)}</td>
                                        <td>{formatValue(f.aspect_ratio)}</td>
                                        <td>{formatValue(f.eccentricity)}</td>
                                        <td>{formatValue(f.solidity)}</td>
                                        <td>{formatValue(f.circularity)}</td>
                                        <td>{formatValue(f.mean_intensity)}</td>
                                        <td>{f.gmm_state ?? '-'}</td>
                                        <td>{f.hmm_state ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="features-table-footer">
                    <span>Total: {features.length} cells</span>
                </div>
            </div>
        </div>
    );
};

export default CellFeaturesTable;
