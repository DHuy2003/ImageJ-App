import { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Download, TrendingUp, Activity, BarChart3, Target } from 'lucide-react';
import './AnalysisResults.css';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

interface CellFeature {
    id: number;
    image_id?: number;
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
    speed: number | null;
    displacement: number | null;
    turning: number | null;
}

interface OverviewStats {
    totalCells: number;
    totalFrames: number;
    totalTracks: number;
    avgCellSize: number;
    stdCellSize: number;
    viability: number;
    growthRate: number;
}

interface ZScoreData {
    cluster: number;
    features: { [key: string]: number };
}

interface TransitionMatrix {
    states: number[];
    matrix: number[][];
}

interface FeatureChange {
    feature: string;
    meanDelta: number;
    medianDelta: number;
    samples: number;
}

interface AnalysisResultsProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'overview' | 'charts' | 'statistics' | 'motility' | 'zscore';

const AnalysisResults = ({ isOpen, onClose }: AnalysisResultsProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [features, setFeatures] = useState<CellFeature[]>([]);
    const [loading, setLoading] = useState(false);
    const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
    const [zScoreData, setZScoreData] = useState<ZScoreData[]>([]);
    const [featureChanges, setFeatureChanges] = useState<FeatureChange[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trajectoryCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAllData();
        }
    }, [isOpen]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/features`);
            const allFeatures = response.data.features || [];
            setFeatures(allFeatures);
            calculateOverviewStats(allFeatures);
            calculateZScores(allFeatures);
            calculateFeatureChanges(allFeatures);
        } catch (err) {
            console.error('Error fetching features:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateOverviewStats = (data: CellFeature[]) => {
        if (data.length === 0) {
            setOverviewStats(null);
            return;
        }

        const frames = [...new Set(data.map(d => d.frame_num))];
        const tracks = [...new Set(
            data
                .filter(d => d.track_id !== null || d.cell_id !== null)
                .map(d => `${d.image_id ?? 'img'}-${d.track_id ?? `cell-${d.cell_id}`}`)
        )];
        const areas = data.filter(d => d.area !== null).map(d => d.area as number);

        const avgArea = areas.length > 0 ? areas.reduce((a, b) => a + b, 0) / areas.length : 0;
        const stdArea = areas.length > 0
            ? Math.sqrt(areas.map(x => Math.pow(x - avgArea, 2)).reduce((a, b) => a + b, 0) / areas.length)
            : 0;

        // Calculate cells per frame for growth rate
        const cellsPerFrame = frames.map(f => data.filter(d => d.frame_num === f).length);
        const growthRate = cellsPerFrame.length > 1
            ? ((cellsPerFrame[cellsPerFrame.length - 1] - cellsPerFrame[0]) / cellsPerFrame[0]) * 100
            : 0;

        // Viability based on tracked cells
        const trackedCells = data.filter(d => d.track_id !== null).length;
        const viability = data.length > 0 ? (trackedCells / data.length) * 100 : 0;

        setOverviewStats({
            totalCells: data.length,
            totalFrames: frames.length,
            totalTracks: tracks.length,
            avgCellSize: avgArea,
            stdCellSize: stdArea,
            viability,
            growthRate
        });
    };

    const calculateZScores = (data: CellFeature[]) => {
        const clusteredData = data.filter(d => d.hmm_state !== null || d.gmm_state !== null);
        if (clusteredData.length === 0) {
            setZScoreData([]);
            return;
        }

        const featureKeys = ['area', 'mean_intensity', 'eccentricity', 'solidity', 'circularity', 'speed'];

        // Calculate global mean and std for each feature
        const globalStats: { [key: string]: { mean: number; std: number } } = {};
        featureKeys.forEach(key => {
            const values = clusteredData
                .map(d => (d as any)[key])
                .filter((v): v is number => v !== null && v !== undefined);
            if (values.length > 0) {
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const std = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length);
                globalStats[key] = { mean, std: std || 1 };
            }
        });

        // Group by cluster and calculate z-scores
        const clusters = [...new Set(clusteredData.map(d => d.hmm_state ?? d.gmm_state ?? 0))];
        const zScores: ZScoreData[] = clusters.map(cluster => {
            const clusterData = clusteredData.filter(d => (d.hmm_state ?? d.gmm_state) === cluster);
            const features: { [key: string]: number } = {};

            featureKeys.forEach(key => {
                const values = clusterData
                    .map(d => (d as any)[key])
                    .filter((v): v is number => v !== null && v !== undefined);
                if (values.length > 0 && globalStats[key]) {
                    const clusterMean = values.reduce((a, b) => a + b, 0) / values.length;
                    features[key] = (clusterMean - globalStats[key].mean) / globalStats[key].std;
                } else {
                    features[key] = 0;
                }
            });

            return { cluster, features };
        });

        setZScoreData(zScores.sort((a, b) => a.cluster - b.cluster));
    };

    const calculateFeatureChanges = (data: CellFeature[]) => {
        const keys = ['area', 'mean_intensity', 'eccentricity', 'solidity', 'circularity', 'speed', 'displacement'];
        const deltas: { [key: string]: number[] } = {};
        keys.forEach(k => (deltas[k] = []));

        const groups = new Map<string, CellFeature[]>();
        data.forEach(item => {
            const key = `${item.image_id ?? 'img'}-${item.track_id ?? `cell-${item.cell_id}`}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        });

        groups.forEach(items => {
            const sorted = items
                .filter(f => f.frame_num !== undefined)
                .sort((a, b) => a.frame_num - b.frame_num);
            for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1];
                const curr = sorted[i];
                keys.forEach(k => {
                    const prevVal = (prev as any)[k];
                    const currVal = (curr as any)[k];
                    if (prevVal !== null && prevVal !== undefined && currVal !== null && currVal !== undefined) {
                        deltas[k].push(Math.abs(currVal - prevVal));
                    }
                });
            }
        });

        const changes: FeatureChange[] = keys.map(k => {
            const arr = deltas[k].sort((a, b) => a - b);
            if (arr.length === 0) return { feature: k, meanDelta: 0, medianDelta: 0, samples: 0 };
            const meanDelta = arr.reduce((a, b) => a + b, 0) / arr.length;
            const medianDelta = arr[Math.floor(arr.length / 2)];
            return { feature: k, meanDelta, medianDelta, samples: arr.length };
        }).filter(f => f.samples > 0);

        setFeatureChanges(changes);
    };

    const computeTransitionMatrix = (
        data: CellFeature[],
        stateKey: 'gmm_state' | 'hmm_state'
    ): TransitionMatrix | null => {
        const stateData = data.filter(d => (d as any)[stateKey] !== null && (d as any)[stateKey] !== undefined);
        if (stateData.length === 0) return null;

        const states = [...new Set(stateData.map(d => (d as any)[stateKey] as number))].sort((a, b) => a - b);
        const indexMap = new Map(states.map((state, idx) => [state, idx]));
        const matrix = Array.from({ length: states.length }, () => new Array(states.length).fill(0));

        const tracks = new Map<number | string, CellFeature[]>();
        stateData.forEach(item => {
            const key = item.track_id ?? item.cell_id ?? `cell-${item.id}`;
            if (!tracks.has(key)) {
                tracks.set(key, []);
            }
            tracks.get(key)!.push(item);
        });

        tracks.forEach(items => {
            const sorted = [...items].sort((a, b) => a.frame_num - b.frame_num);
            for (let i = 1; i < sorted.length; i++) {
                const prevState = (sorted[i - 1] as any)[stateKey];
                const currState = (sorted[i] as any)[stateKey];
                const fromIdx = indexMap.get(prevState);
                const toIdx = indexMap.get(currState);
                if (fromIdx === undefined || toIdx === undefined) continue;
                matrix[fromIdx][toIdx] += 1;
            }
        });

        return { states, matrix };
    };

    // Draw cell count chart
    useEffect(() => {
        if (activeTab === 'overview' && canvasRef.current && features.length > 0) {
            drawCellCountChart();
        }
    }, [activeTab, features]);

    // Draw 3D trajectory
    useEffect(() => {
        if (activeTab === 'motility' && trajectoryCanvasRef.current && features.length > 0) {
            draw3DTrajectory();
        }
    }, [activeTab, features]);

    const drawCellCountChart = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const frames = [...new Set(features.map(f => f.frame_num))].sort((a, b) => a - b);
        const cellCounts = frames.map(f => features.filter(d => d.frame_num === f).length);

        const padding = 50;
        const width = canvas.width - padding * 2;
        const height = canvas.height - padding * 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (cellCounts.length === 0) return;

        const maxCount = Math.max(...cellCounts);
        const minCount = Math.min(...cellCounts);
        const range = maxCount - minCount || 1;

        // Draw grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();

        // Draw line chart
        ctx.strokeStyle = '#c45c26';
        ctx.lineWidth = 3;
        ctx.beginPath();

        const points: { x: number; y: number }[] = [];
        cellCounts.forEach((count, i) => {
            const x = padding + (width * i) / (cellCounts.length - 1 || 1);
            const y = canvas.height - padding - ((count - minCount) / range) * height * 0.8 - height * 0.1;
            points.push({ x, y });
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points
        points.forEach(point => {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c45c26';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Labels
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        // X-axis labels - show only a subset to avoid overlapping
        const maxLabels = 10; // Maximum number of labels to show
        const step = Math.ceil(frames.length / maxLabels);
        frames.forEach((frame, i) => {
            // Only show label at regular intervals
            if (i % step === 0 || i === frames.length - 1) {
                const x = padding + (width * i) / (frames.length - 1 || 1);
                ctx.fillText(String(frame), x, canvas.height - padding + 20);
            }
        });

        // Y-axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const y = canvas.height - padding - (height * i) / 4;
            const value = Math.round(minCount + (range * i) / 4);
            ctx.fillText(String(value), padding - 10, y + 4);
        }

        // Title
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cell Count Over Time', canvas.width / 2, 25);
    };

    const draw3DTrajectory = () => {
        const canvas = trajectoryCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Check if tracking has been performed (track_id assigned)
        const trackedCells = features.filter(f =>
            f.track_id !== null &&
            f.centroid_col !== null &&
            f.centroid_row !== null &&
            f.frame_num !== undefined
        );

        if (trackedCells.length === 0) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No tracking data available.', canvas.width / 2, canvas.height / 2 - 15);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText('Run "Track Cells" first to generate trajectories.', canvas.width / 2, canvas.height / 2 + 15);
            return;
        }

        // Only use cells with valid track_id for trajectory visualization
        const pathCells = trackedCells;

        // Group by track_id only (each track spans multiple frames/images)
        const uniqueTrackIds = [...new Set(pathCells.map(f => f.track_id))].sort((a, b) => (a ?? 0) - (b ?? 0));

        // Use nipy_spectral-like color palette (similar to matplotlib)
        const generateSpectralColors = (count: number): string[] => {
            const colors: string[] = [];
            for (let i = 0; i < count; i++) {
                const t = count > 1 ? i / (count - 1) : 0;
                // nipy_spectral goes from purple -> blue -> cyan -> green -> yellow -> orange -> red
                const hue = (1 - t) * 270; // 270 (purple) to 0 (red)
                colors.push(`hsl(${hue}, 90%, 55%)`);
            }
            return colors;
        };

        const colors = generateSpectralColors(uniqueTrackIds.length);
        const trackMeta = uniqueTrackIds.map(trackId => ({
            trackId,
        }));

        // Get data bounds
        const allX = pathCells.map(f => f.centroid_col ?? 0);
        const allY = pathCells.map(f => f.centroid_row ?? 0);
        const allZ = pathCells.map(f => f.frame_num);

        const minX = Math.min(...allX), maxX = Math.max(...allX);
        const minY = Math.min(...allY), maxY = Math.max(...allY);
        const minZ = Math.min(...allZ), maxZ = Math.max(...allZ);

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const rangeZ = maxZ - minZ || 1;

        // 3D projection parameters - matching matplotlib view_init(elev=25, azim=35)
        const padding = 80;
        const plotWidth = canvas.width - padding * 2;
        const plotHeight = canvas.height - padding * 2;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 + 20;

        // Convert matplotlib angles to radians
        const elevation = 25 * Math.PI / 180;  // elev=25
        const azimuth = 35 * Math.PI / 180;    // azim=35

        const scale = Math.min(plotWidth, plotHeight) * 0.4;

        const project3D = (x: number, y: number, z: number) => {
            // Normalize to 0-1 range
            const nx = (x - minX) / rangeX;
            const ny = (y - minY) / rangeY;  // Will be inverted later
            const nz = (z - minZ) / rangeZ;

            // Center around 0
            const cx = (nx - 0.5) * 2;
            const cy = (ny - 0.5) * 2;  // Invert Y (like matplotlib invert_yaxis)
            const cz = (nz - 0.5) * 2;

            // Apply rotation (azimuth around Z axis)
            const cosA = Math.cos(azimuth), sinA = Math.sin(azimuth);
            const x1 = cx * cosA - cy * sinA;
            const y1 = cx * sinA + cy * cosA;

            // Apply elevation (rotation around X axis)
            const cosE = Math.cos(elevation), sinE = Math.sin(elevation);
            const y2 = y1 * cosE - cz * sinE;
            const z2 = y1 * sinE + cz * cosE;

            return {
                x: centerX + x1 * scale,
                y: centerY - z2 * scale,  // Z becomes vertical (like Frame axis in matplotlib)
                depth: y2
            };
        };

        // Draw grid/axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        // Draw axis lines
        const origin = project3D(minX, maxY, minZ);  // Inverted Y
        const xAxisEnd = project3D(maxX, maxY, minZ);
        const yAxisEnd = project3D(minX, minY, minZ);  // Inverted Y
        const zAxisEnd = project3D(minX, maxY, maxZ);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;

        // X axis (centroid_col)
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(xAxisEnd.x, xAxisEnd.y);
        ctx.stroke();

        // Y axis (centroid_row) - inverted
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(yAxisEnd.x, yAxisEnd.y);
        ctx.stroke();

        // Z axis (frame)
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(zAxisEnd.x, zAxisEnd.y);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Col', xAxisEnd.x + 15, xAxisEnd.y + 5);
        ctx.fillText('Row', yAxisEnd.x - 15, yAxisEnd.y + 5);
        ctx.fillText('Frame', zAxisEnd.x - 5, zAxisEnd.y - 15);

        // Draw trajectories (lines only, like matplotlib code)
        trackMeta.forEach((track, idx) => {
            const trackData = pathCells
                .filter(f => f.track_id === track.trackId)
                .sort((a, b) => a.frame_num - b.frame_num);

            if (trackData.length < 2) return;  // Need at least 2 points for a line

            ctx.strokeStyle = colors[idx];
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;  // alpha=0.9 like matplotlib

            ctx.beginPath();
            trackData.forEach((point, i) => {
                const projected = project3D(
                    point.centroid_col ?? 0,
                    point.centroid_row ?? 0,
                    point.frame_num
                );
                if (i === 0) {
                    ctx.moveTo(projected.x, projected.y);
                } else {
                    ctx.lineTo(projected.x, projected.y);
                }
            });
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cell Movement Over Time (3D)', canvas.width / 2, 25);

        // Legend (show first 10 tracks)
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        const legendX = 15;
        let legendY = 45;
        const tracksToShow = Math.min(10, trackMeta.length);
        trackMeta.slice(0, tracksToShow).forEach((track, idx) => {
            ctx.fillStyle = colors[idx];
            ctx.fillRect(legendX, legendY - 6, 10, 10);
            ctx.fillStyle = '#fff';
            ctx.fillText(`Track ${track.trackId}`, legendX + 14, legendY + 2);
            legendY += 14;
        });
        if (trackMeta.length > 10) {
            ctx.fillStyle = '#888';
            ctx.font = '9px Arial';
            ctx.fillText(`+${trackMeta.length - 10} more tracks`, legendX, legendY + 2);
        }

        // Info text
        ctx.fillStyle = '#aaa';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${uniqueTrackIds.length} tracks, ${trackedCells.length} cells`, canvas.width - 15, canvas.height - 10);
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/features/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'analysis_results.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export data');
        }
    };

    const formatValue = (value: number | null | undefined, decimals: number = 2): string => {
        if (value === null || value === undefined) return '-';
        return value.toFixed(decimals);
    };

    const getZScoreColor = (value: number): string => {
        if (value > 1.5) return '#27ae60';
        if (value > 0.5) return '#2ecc71';
        if (value < -1.5) return '#e74c3c';
        if (value < -0.5) return '#e67e22';
        return '#333';
    };

    const getZScoreBg = (value: number): string => {
        if (value > 1.5) return 'rgba(39, 174, 96, 0.15)';
        if (value > 0.5) return 'rgba(46, 204, 113, 0.1)';
        if (value < -1.5) return 'rgba(231, 76, 60, 0.15)';
        if (value < -0.5) return 'rgba(230, 126, 34, 0.1)';
        return 'transparent';
    };

    const transitionCellStyle = (value: number, maxValue: number, rowTotal: number) => {
        const intensity = maxValue ? Math.min(1, value / maxValue) : 0;
        const bg = `rgba(52, 152, 219, ${0.15 + 0.55 * intensity})`;
        const pct = rowTotal > 0 ? (value / rowTotal) * 100 : 0;
        return {
            backgroundColor: bg,
            color: '#0f172a',
            fontWeight: value === maxValue && maxValue > 0 ? 700 : 500,
            border: '1px solid rgba(0,0,0,0.05)',
            title: `${value} (${pct.toFixed(1)}%)`
        };
    };

    const gmmTransition = useMemo(
        () => computeTransitionMatrix(features, 'gmm_state'),
        [features]
    );

    const hmmTransition = useMemo(
        () => computeTransitionMatrix(features, 'hmm_state'),
        [features]
    );

    if (!isOpen) return null;

    const tabs: { id: TabType; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'charts', label: 'Charts' },
        { id: 'statistics', label: 'Statistics' },
        { id: 'motility', label: 'Motility' },
        { id: 'zscore', label: 'Z-Score Analysis' }
    ];

    return (
        <div className="analysis-overlay">
            <div className="analysis-container">
                <div className="analysis-header">
                    <div className="header-title">
                        <TrendingUp size={24} />
                        <h2>Analysis Results</h2>
                        <span className="dataset-badge">Dataset: Cell_Tracking_001</span>
                    </div>
                    <div className="header-actions">
                        <button className="export-btn" onClick={handleExport}>
                            <Download size={18} />
                            Export
                        </button>
                        <button className="close-btn" onClick={onClose} title="Close">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="analysis-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="analysis-content">
                    {loading ? (
                        <div className="loading-state">Loading analysis data...</div>
                    ) : (
                        <>
                            {activeTab === 'overview' && overviewStats && (
                                <div className="overview-tab">
                                    <div className="stats-cards">
                                        <div className="stat-card">
                                            <div className="stat-icon"><Target size={20} /></div>
                                            <div className="stat-label">Total Cells</div>
                                            <div className="stat-value">{overviewStats.totalCells}</div>
                                            <div className="stat-sub">Across {overviewStats.totalFrames} frames</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon"><Activity size={20} /></div>
                                            <div className="stat-label">Viability</div>
                                            <div className="stat-value green">{formatValue(overviewStats.viability, 1)}%</div>
                                            <div className="stat-sub">Average across frames</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon"><TrendingUp size={20} /></div>
                                            <div className="stat-label">Growth Rate</div>
                                            <div className="stat-value blue">
                                                {overviewStats.growthRate >= 0 ? '+' : ''}{formatValue(overviewStats.growthRate, 1)}%
                                            </div>
                                            <div className="stat-sub">Per frame</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon"><BarChart3 size={20} /></div>
                                            <div className="stat-label">Avg Cell Size</div>
                                            <div className="stat-value">{formatValue(overviewStats.avgCellSize, 1)} px²</div>
                                            <div className="stat-sub">Standard deviation: {formatValue(overviewStats.stdCellSize, 1)}</div>
                                        </div>
                                    </div>

                                    <div className="chart-section">
                                        <canvas ref={canvasRef} width={800} height={300} />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'charts' && (
                                <div className="charts-tab">
                                    <div className="charts-grid">
                                        <div className="chart-card">
                                            <h3>Area Distribution</h3>
                                            <div className="chart-placeholder">
                                                {features.length > 0 ? (
                                                    <AreaHistogram data={features} />
                                                ) : (
                                                    <p>No data available</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="chart-card">
                                            <h3>Intensity Distribution</h3>
                                            <div className="chart-placeholder">
                                                {features.length > 0 ? (
                                                    <IntensityHistogram data={features} />
                                                ) : (
                                                    <p>No data available</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'statistics' && (
                                <div className="statistics-tab">
                                    <div className="stats-table-container">
                                        <h3>Feature Statistics Summary</h3>
                                        <table className="stats-table">
                                            <thead>
                                                <tr>
                                                    <th>Feature</th>
                                                    <th>Mean</th>
                                                    <th>Std Dev</th>
                                                    <th>Min</th>
                                                    <th>Max</th>
                                                    <th>Median</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {['area', 'mean_intensity', 'eccentricity', 'solidity', 'circularity', 'speed'].map(key => {
                                                    const values = features
                                                        .map(f => (f as any)[key])
                                                        .filter((v): v is number => v !== null && v !== undefined)
                                                        .sort((a, b) => a - b);

                                                    if (values.length === 0) return null;

                                                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                                                    const std = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length);
                                                    const median = values[Math.floor(values.length / 2)];

                                                    return (
                                                        <tr key={key}>
                                                            <td className="feature-name">{key.replace(/_/g, ' ')}</td>
                                                            <td>{formatValue(mean)}</td>
                                                            <td>{formatValue(std)}</td>
                                                            <td>{formatValue(Math.min(...values))}</td>
                                                            <td>{formatValue(Math.max(...values))}</td>
                                                            <td>{formatValue(median)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {featureChanges.length > 0 && (
                                        <div className="stats-table-container">
                                            <h3>Feature Change per Step</h3>
                                            <p className="table-subtitle">Độ biến đổi trung bình/median giữa các frame liên tiếp (theo track hoặc cell)</p>
                                            <table className="stats-table">
                                                <thead>
                                                    <tr>
                                                        <th>Feature</th>
                                                        <th>Mean Δ</th>
                                                        <th>Median Δ</th>
                                                        <th>Samples</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {featureChanges.map(row => (
                                                        <tr key={row.feature}>
                                                            <td className="feature-name">{row.feature.replace(/_/g, ' ')}</td>
                                                            <td>{formatValue(row.meanDelta)}</td>
                                                            <td>{formatValue(row.medianDelta)}</td>
                                                            <td>{row.samples}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="stats-table-container">
                                        <div className="stats-table-header">
                                            <h3>GMM Empirical Transition Matrix</h3>
                                            <p className="table-subtitle">Transitions between consecutive frames (counts and row %)</p>
                                        </div>
                                        {gmmTransition ? (
                                            <div className="transition-table-wrapper">
                                                <table className="stats-table transition-table">
                                                    <thead>
                                                        <tr>
                                                            <th>From \\ To</th>
                                                            {gmmTransition.states.map(state => (
                                                                <th key={`gmm-head-${state}`}>{state}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {gmmTransition.matrix.map((row, rowIdx) => {
                                                            const rowTotal = row.reduce((a, b) => a + b, 0);
                                                            const rowMax = Math.max(...row, 0);
                                                            return (
                                                                <tr key={`gmm-row-${gmmTransition.states[rowIdx]}`}>
                                                                    <td className="state-label">State {gmmTransition.states[rowIdx]}</td>
                                                                    {row.map((value, colIdx) => (
                                                                        <td
                                                                            key={`gmm-cell-${rowIdx}-${colIdx}`}
                                                                            className="value-cell heat-cell"
                                                                            style={transitionCellStyle(value, rowMax, rowTotal)}
                                                                        >
                                                                            {value}{rowTotal > 0 ? ` (${formatValue((value / rowTotal) * 100, 1)}%)` : ''}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="no-data">No GMM labels available. Run clustering to see transitions.</p>
                                        )}
                                    </div>
                                    <div className="stats-table-container">
                                        <div className="stats-table-header">
                                            <h3>HMM Empirical Transition Matrix</h3>
                                            <p className="table-subtitle">Transitions between consecutive frames (counts and row %)</p>
                                        </div>
                                        {hmmTransition ? (
                                            <div className="transition-table-wrapper">
                                                <table className="stats-table transition-table">
                                                    <thead>
                                                        <tr>
                                                            <th>From \\ To</th>
                                                            {hmmTransition.states.map(state => (
                                                                <th key={`hmm-head-${state}`}>{state}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {hmmTransition.matrix.map((row, rowIdx) => {
                                                            const rowTotal = row.reduce((a, b) => a + b, 0);
                                                            const rowMax = Math.max(...row, 0);
                                                            return (
                                                                <tr key={`hmm-row-${hmmTransition.states[rowIdx]}`}>
                                                                    <td className="state-label">State {hmmTransition.states[rowIdx]}</td>
                                                                    {row.map((value, colIdx) => (
                                                                        <td
                                                                            key={`hmm-cell-${rowIdx}-${colIdx}`}
                                                                            className="value-cell heat-cell"
                                                                            style={transitionCellStyle(value, rowMax, rowTotal)}
                                                                        >
                                                                            {value}{rowTotal > 0 ? ` (${formatValue((value / rowTotal) * 100, 1)}%)` : ''}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="no-data">No HMM labels available. Run HMM analysis to see transitions.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'motility' && (
                                <div className="motility-tab">
                                    <div className="trajectory-container">
                                        <canvas ref={trajectoryCanvasRef} width={800} height={500} />
                                    </div>
                                    <div className="motility-stats">
                                        <h3>Motility Statistics</h3>
                                        <div className="motility-grid">
                                            {(() => {
                                                const speeds = features.filter(f => f.speed !== null).map(f => f.speed as number);
                                                const displacements = features.filter(f => f.displacement !== null).map(f => f.displacement as number);
                                                const tracks = [...new Set(
                                                    features
                                                        .filter(f => (f.track_id !== null || f.cell_id !== null))
                                                        .map(f => `${f.image_id ?? 'img'}-${f.track_id ?? `cell-${f.cell_id}`}`)
                                                )];

                                                return (
                                                    <>
                                                        <div className="motility-stat">
                                                            <span className="label">Total Tracks</span>
                                                            <span className="value">{tracks.length}</span>
                                                        </div>
                                                        <div className="motility-stat">
                                                            <span className="label">Avg Speed</span>
                                                            <span className="value">
                                                                {speeds.length > 0
                                                                    ? formatValue(speeds.reduce((a, b) => a + b, 0) / speeds.length, 2)
                                                                    : '-'} px/frame
                                                            </span>
                                                        </div>
                                                        <div className="motility-stat">
                                                            <span className="label">Max Speed</span>
                                                            <span className="value">
                                                                {speeds.length > 0 ? formatValue(Math.max(...speeds), 2) : '-'} px/frame
                                                            </span>
                                                        </div>
                                                        <div className="motility-stat">
                                                            <span className="label">Avg Displacement</span>
                                                            <span className="value">
                                                                {displacements.length > 0
                                                                    ? formatValue(displacements.reduce((a, b) => a + b, 0) / displacements.length, 2)
                                                                    : '-'} px
                                                            </span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'zscore' && (
                                <div className="zscore-tab">
                                    <div className="zscore-header">
                                        <h3>Z-Score Normalized Features by Cluster</h3>
                                        <p className="zscore-description">
                                            Standardized mean values (z = (x̄<sub>cluster</sub> - μ) / σ) showing how each cluster deviates from the population mean.
                                            Values represent standard deviations from the mean.
                                        </p>
                                    </div>
                                    {zScoreData.length === 0 ? (
                                        <p className="no-data">No clustering data available. Run clustering first.</p>
                                    ) : (
                                        <div className="zscore-table-container scientific">
                                            <table className="zscore-table scientific-table">
                                                <thead>
                                                    <tr>
                                                        <th rowSpan={2} className="header-cluster">Cluster</th>
                                                        <th colSpan={4} className="header-group morphology">Morphological Features</th>
                                                        <th colSpan={1} className="header-group intensity">Intensity</th>
                                                        <th colSpan={1} className="header-group motility">Motility</th>
                                                    </tr>
                                                    <tr className="subheader">
                                                        <th>Area</th>
                                                        <th>Eccentricity</th>
                                                        <th>Solidity</th>
                                                        <th>Circularity</th>
                                                        <th>Mean Int.</th>
                                                        <th>Speed</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {zScoreData.map((row, idx) => {
                                                        // Count cells in this cluster
                                                        const clusterCells = features.filter(f =>
                                                            (f.hmm_state ?? f.gmm_state) === row.cluster
                                                        ).length;

                                                        return (
                                                            <tr key={row.cluster}>
                                                                <td className="cluster-cell">
                                                                    <div className="cluster-info">
                                                                        <span
                                                                            className="cluster-badge"
                                                                            style={{
                                                                                backgroundColor: `hsl(${row.cluster * 60}, 70%, 45%)`
                                                                            }}
                                                                        >
                                                                            {row.cluster}
                                                                        </span>
                                                                        <span className="cluster-n">(n={clusterCells})</span>
                                                                    </div>
                                                                </td>
                                                                {['area', 'eccentricity', 'solidity', 'circularity', 'mean_intensity', 'speed'].map(key => {
                                                                    const value = row.features[key] || 0;
                                                                    const absValue = Math.abs(value);
                                                                    const significance = absValue >= 1.96 ? '**' : absValue >= 1.64 ? '*' : '';

                                                                    return (
                                                                        <td
                                                                            key={key}
                                                                            className={`zscore-cell ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`}
                                                                            style={{
                                                                                backgroundColor: getZScoreBg(value)
                                                                            }}
                                                                        >
                                                                            <span className="zscore-value" style={{ color: getZScoreColor(value) }}>
                                                                                {value > 0 ? '+' : ''}{value.toFixed(2)}
                                                                            </span>
                                                                            {significance && <sup className="significance">{significance}</sup>}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>

                                            <div className="zscore-footer">
                                                <div className="zscore-legend scientific">
                                                    <div className="legend-section">
                                                        <span className="legend-title">Interpretation:</span>
                                                        <span className="legend-item">
                                                            <span className="color-box high"></span> z &gt; +1.5 (significantly above mean)
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box mid-high"></span> +0.5 to +1.5 (above mean)
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box normal"></span> -0.5 to +0.5 (near mean)
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box mid-low"></span> -1.5 to -0.5 (below mean)
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box low"></span> z &lt; -1.5 (significantly below mean)
                                                        </span>
                                                    </div>
                                                    <div className="legend-section significance-legend">
                                                        <span className="legend-title">Significance:</span>
                                                        <span className="legend-item">** p &lt; 0.05 (|z| ≥ 1.96)</span>
                                                        <span className="legend-item">* p &lt; 0.10 (|z| ≥ 1.64)</span>
                                                    </div>
                                                </div>
                                                <div className="zscore-note">
                                                    <em>Note: Z-scores calculated relative to overall population statistics. n = number of cells per cluster.</em>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Simple histogram components
const AreaHistogram = ({ data }: { data: CellFeature[] }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const areas = data.filter(d => d.area !== null).map(d => d.area as number);
        if (areas.length === 0) return;

        const min = Math.min(...areas);
        const max = Math.max(...areas);
        const binCount = 20;
        const binSize = (max - min) / binCount;
        const bins = new Array(binCount).fill(0);

        areas.forEach(area => {
            const binIndex = Math.min(Math.floor((area - min) / binSize), binCount - 1);
            bins[binIndex]++;
        });

        const maxBin = Math.max(...bins);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#4a90e2';

        const barWidth = (canvas.width - 60) / binCount;
        bins.forEach((count, i) => {
            const barHeight = (count / maxBin) * (canvas.height - 40);
            ctx.fillRect(30 + i * barWidth, canvas.height - 20 - barHeight, barWidth - 2, barHeight);
        });

        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(Math.round(min)), 30, canvas.height - 5);
        ctx.fillText(String(Math.round(max)), canvas.width - 30, canvas.height - 5);
    }, [data]);

    return <canvas ref={canvasRef} width={350} height={200} />;
};

const IntensityHistogram = ({ data }: { data: CellFeature[] }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const intensities = data.filter(d => d.mean_intensity !== null).map(d => d.mean_intensity as number);
        if (intensities.length === 0) return;

        const min = Math.min(...intensities);
        const max = Math.max(...intensities);
        const binCount = 20;
        const binSize = (max - min) / binCount || 1;
        const bins = new Array(binCount).fill(0);

        intensities.forEach(intensity => {
            const binIndex = Math.min(Math.floor((intensity - min) / binSize), binCount - 1);
            bins[binIndex]++;
        });

        const maxBin = Math.max(...bins);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#27ae60';

        const barWidth = (canvas.width - 60) / binCount;
        bins.forEach((count, i) => {
            const barHeight = (count / maxBin) * (canvas.height - 40);
            ctx.fillRect(30 + i * barWidth, canvas.height - 20 - barHeight, barWidth - 2, barHeight);
        });

        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(Math.round(min)), 30, canvas.height - 5);
        ctx.fillText(String(Math.round(max)), canvas.width - 30, canvas.height - 5);
    }, [data]);

    return <canvas ref={canvasRef} width={350} height={200} />;
};

export default AnalysisResults;
