import { useEffect, useState, useRef, useMemo, forwardRef } from 'react';
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

interface ClusteringScore {
    n_components: number;
    bic: number;
    aic: number;
}

interface ClusteringInfo {
    scores: ClusteringScore[];
    optimal_components: number;
    optimal_k_by_bic: number;
    optimal_k_by_aic: number;
    selection_method: string;
}

interface AnalysisResultsProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'overview' | 'charts' | 'statistics' | 'motility' | 'zscore';

// All available features for Z-Score analysis
const ALL_ZSCORE_FEATURES = [
    { key: 'area', label: 'Area', category: 'morphology' },
    { key: 'eccentricity', label: 'Eccentricity', category: 'morphology' },
    { key: 'solidity', label: 'Solidity', category: 'morphology' },
    { key: 'circularity', label: 'Circularity', category: 'morphology' },
    { key: 'aspect_ratio', label: 'Aspect Ratio', category: 'morphology' },
    { key: 'convexity_deficit', label: 'Convexity Deficit', category: 'morphology' },
    { key: 'perimeter', label: 'Perimeter', category: 'morphology' },
    { key: 'extent', label: 'Extent', category: 'morphology' },
    { key: 'major_axis_length', label: 'Major Axis', category: 'morphology' },
    { key: 'minor_axis_length', label: 'Minor Axis', category: 'morphology' },
    { key: 'mean_intensity', label: 'Mean Intensity', category: 'intensity' },
    { key: 'max_intensity', label: 'Max Intensity', category: 'intensity' },
    { key: 'min_intensity', label: 'Min Intensity', category: 'intensity' },
    { key: 'intensity_ratio_max_mean', label: 'Max/Mean Ratio', category: 'intensity' },
    { key: 'intensity_ratio_mean_min', label: 'Mean/Min Ratio', category: 'intensity' },
    { key: 'speed', label: 'Speed', category: 'motility' },
    { key: 'displacement', label: 'Displacement', category: 'motility' },
    { key: 'turning', label: 'Turning', category: 'motility' },
];

const DEFAULT_ZSCORE_FEATURES = ['area', 'eccentricity', 'solidity', 'circularity', 'mean_intensity', 'speed'];

const AnalysisResults = ({ isOpen, onClose }: AnalysisResultsProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [features, setFeatures] = useState<CellFeature[]>([]);
    const [loading, setLoading] = useState(false);
    const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
    const [zScoreData, setZScoreData] = useState<ZScoreData[]>([]);
    const [featureChanges, setFeatureChanges] = useState<FeatureChange[]>([]);
    const [selectedZScoreFeatures, setSelectedZScoreFeatures] = useState<string[]>(DEFAULT_ZSCORE_FEATURES);
    const [showFeatureSelector, setShowFeatureSelector] = useState(false);
    // Clustering scores for BIC/AIC visualization
    const [clusteringInfo, setClusteringInfo] = useState<ClusteringInfo | null>(null);
    // Motility tab states
    const [selectedTracks, setSelectedTracks] = useState<number[]>([]);
    const [showTrackSelector, setShowTrackSelector] = useState(false);
    const [frameRange, setFrameRange] = useState<[number, number]>([0, 100]);
    const [maxFrame, setMaxFrame] = useState(100);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trajectoryCanvasRef = useRef<HTMLCanvasElement>(null);

    // Export dialog states
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        csvData: true,
        areaHistogram: false,
        intensityHistogram: false,
        clusterPCA: false,
        clusterDistribution: false,
        zscoreHeatmap: false,
        motilityChart: false,
        trajectory3D: false
    });
    const [exporting, setExporting] = useState(false);

    // Refs for chart canvases
    const areaHistogramRef = useRef<HTMLCanvasElement>(null);
    const intensityHistogramRef = useRef<HTMLCanvasElement>(null);
    const clusterPCARef = useRef<HTMLCanvasElement>(null);
    const clusterDistributionRef = useRef<HTMLCanvasElement>(null);
    const zscoreHeatmapRef = useRef<HTMLCanvasElement>(null);
    const bicAicChartRef = useRef<HTMLCanvasElement>(null);

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

            // Initialize motility tab data
            const trackedCells = allFeatures.filter((f: CellFeature) => f.track_id !== null);
            const uniqueTracks = [...new Set(trackedCells.map((f: CellFeature) => f.track_id))] as number[];
            const frames = allFeatures.map((f: CellFeature) => f.frame_num);
            const minFrame = frames.length > 0 ? Math.min(...frames) : 0;
            const maxFrameVal = frames.length > 0 ? Math.max(...frames) : 100;

            setMaxFrame(maxFrameVal);
            setFrameRange([minFrame, maxFrameVal]);
            // Select first 10 tracks by default (or all if less than 10)
            setSelectedTracks(uniqueTracks.slice(0, 10));

            // Load clustering info from localStorage if available
            const savedClusteringInfo = localStorage.getItem('clusteringInfo');
            if (savedClusteringInfo) {
                try {
                    const parsed = JSON.parse(savedClusteringInfo);
                    setClusteringInfo(parsed);
                } catch {
                    console.warn('Failed to parse clustering info from localStorage');
                }
            }
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

    const calculateZScores = (data: CellFeature[], featureKeys: string[] = selectedZScoreFeatures) => {
        const clusteredData = data.filter(d => d.hmm_state !== null || d.gmm_state !== null);
        if (clusteredData.length === 0) {
            setZScoreData([]);
            return;
        }

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

    // Recalculate z-scores when selected features change
    useEffect(() => {
        if (features.length > 0) {
            calculateZScores(features, selectedZScoreFeatures);
        }
    }, [selectedZScoreFeatures]);

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
    }, [activeTab, features, selectedTracks, frameRange]);

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

        // Filter by selected tracks and frame range
        const pathCells = trackedCells.filter(f => {
            const inTrackSelection = selectedTracks.length === 0 || selectedTracks.includes(f.track_id as number);
            const inFrameRange = f.frame_num >= frameRange[0] && f.frame_num <= frameRange[1];
            return inTrackSelection && inFrameRange;
        });

        if (pathCells.length === 0) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data in selected range.', canvas.width / 2, canvas.height / 2 - 15);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText('Adjust track selection or frame range.', canvas.width / 2, canvas.height / 2 + 15);
            return;
        }

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

        // Add tick marks every 10 frames on Z axis (Frame)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';

        const tickInterval = 10;
        const startTick = Math.ceil(minZ / tickInterval) * tickInterval;
        for (let frame = startTick; frame <= maxZ; frame += tickInterval) {
            const tickPos = project3D(minX, maxY, frame);
            // Draw tick mark
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tickPos.x - 5, tickPos.y);
            ctx.lineTo(tickPos.x + 5, tickPos.y);
            ctx.stroke();
            // Draw tick label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(String(frame), tickPos.x - 8, tickPos.y + 3);
        }

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
        setShowExportDialog(true);
    };

    const downloadCanvas = (canvas: HTMLCanvasElement | null, filename: string) => {
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const performExport = async () => {
        setExporting(true);
        try {
            const timestamp = new Date().toISOString().split('T')[0];

            // Export CSV data
            if (exportOptions.csvData) {
                const response = await axios.get(`${API_BASE_URL}/features/export`, {
                    responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `analysis_results_${timestamp}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }

            // Export chart images
            if (exportOptions.areaHistogram && areaHistogramRef.current) {
                downloadCanvas(areaHistogramRef.current, `area_histogram_${timestamp}.png`);
            }

            if (exportOptions.intensityHistogram && intensityHistogramRef.current) {
                downloadCanvas(intensityHistogramRef.current, `intensity_histogram_${timestamp}.png`);
            }

            if (exportOptions.clusterPCA && clusterPCARef.current) {
                downloadCanvas(clusterPCARef.current, `cluster_pca_${timestamp}.png`);
            }

            if (exportOptions.clusterDistribution && clusterDistributionRef.current) {
                downloadCanvas(clusterDistributionRef.current, `cluster_distribution_${timestamp}.png`);
            }

            if (exportOptions.zscoreHeatmap && zscoreHeatmapRef.current) {
                downloadCanvas(zscoreHeatmapRef.current, `zscore_heatmap_${timestamp}.png`);
            }

            if (exportOptions.motilityChart && canvasRef.current) {
                downloadCanvas(canvasRef.current, `motility_chart_${timestamp}.png`);
            }

            if (exportOptions.trajectory3D && trajectoryCanvasRef.current) {
                downloadCanvas(trajectoryCanvasRef.current, `trajectory_3d_${timestamp}.png`);
            }

            setShowExportDialog(false);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export some items');
        } finally {
            setExporting(false);
        }
    };

    const toggleExportOption = (key: keyof typeof exportOptions) => {
        setExportOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectAllExports = () => {
        setExportOptions({
            csvData: true,
            areaHistogram: true,
            intensityHistogram: true,
            clusterPCA: true,
            clusterDistribution: true,
            zscoreHeatmap: true,
            motilityChart: true,
            trajectory3D: true
        });
    };

    const deselectAllExports = () => {
        setExportOptions({
            csvData: false,
            areaHistogram: false,
            intensityHistogram: false,
            clusterPCA: false,
            clusterDistribution: false,
            zscoreHeatmap: false,
            motilityChart: false,
            trajectory3D: false
        });
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
        <>
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
                                    <div className="charts-section">
                                        <h3 className="section-title">Distribution Charts</h3>
                                        <div className="charts-grid">
                                            <div className="chart-card">
                                                <div className="chart-content">
                                                    {features.length > 0 ? (
                                                        <AreaHistogram ref={areaHistogramRef} data={features} />
                                                    ) : (
                                                        <p className="no-data-msg">No data available</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="chart-card">
                                                <div className="chart-content">
                                                    {features.length > 0 ? (
                                                        <IntensityHistogram ref={intensityHistogramRef} data={features} />
                                                    ) : (
                                                        <p className="no-data-msg">No data available</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="charts-section">
                                        <h3 className="section-title">Cluster Space (PCA)</h3>
                                        <div className="chart-card full-width">
                                            <div className="chart-content pca-chart">
                                                {features.length > 0 ? (
                                                    <ClusterScatterPlot ref={clusterPCARef} data={features} />
                                                ) : (
                                                    <p className="no-data-msg">No data available</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="charts-section">
                                        <h3 className="section-title">Cluster Distribution</h3>
                                        <div className="charts-grid">
                                            <div className="chart-card">
                                                <div className="chart-content">
                                                    {features.length > 0 ? (
                                                        <ClusterDistributionChart ref={clusterDistributionRef} data={features} />
                                                    ) : (
                                                        <p className="no-data-msg">No data available</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="charts-section">
                                        <h3 className="section-title">Model Selection (BIC/AIC)</h3>
                                        <div className="chart-card full-width">
                                            <div className="chart-content">
                                                {clusteringInfo && clusteringInfo.scores && clusteringInfo.scores.length > 0 ? (
                                                    <BicAicChart ref={bicAicChartRef} clusteringInfo={clusteringInfo} />
                                                ) : (
                                                    <p className="no-data-msg">No clustering scores available. Run clustering first.</p>
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
                                    {/* Controls Panel */}
                                    <div className="motility-controls">
                                        <div className="control-group">
                                            <label>Frame Range:</label>
                                            <div className="dual-range-container">
                                                <span className="frame-value">{frameRange[0]}</span>
                                                <div className="dual-range-slider">
                                                    <div className="dual-range-track"></div>
                                                    <div
                                                        className="dual-range-highlight"
                                                        style={{
                                                            left: `${(frameRange[0] / maxFrame) * 100}%`,
                                                            width: `${((frameRange[1] - frameRange[0]) / maxFrame) * 100}%`
                                                        }}
                                                    ></div>
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={maxFrame}
                                                        value={frameRange[0]}
                                                        onChange={(e) => {
                                                            const newVal = parseInt(e.target.value);
                                                            if (newVal <= frameRange[1]) {
                                                                setFrameRange([newVal, frameRange[1]]);
                                                            }
                                                        }}
                                                        className="dual-range-input dual-range-min"
                                                    />
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={maxFrame}
                                                        value={frameRange[1]}
                                                        onChange={(e) => {
                                                            const newVal = parseInt(e.target.value);
                                                            if (newVal >= frameRange[0]) {
                                                                setFrameRange([frameRange[0], newVal]);
                                                            }
                                                        }}
                                                        className="dual-range-input dual-range-max"
                                                    />
                                                </div>
                                                <span className="frame-value">{frameRange[1]}</span>
                                            </div>
                                        </div>
                                        <div className="control-group">
                                            <button
                                                className="track-selector-btn"
                                                onClick={() => setShowTrackSelector(!showTrackSelector)}
                                            >
                                                {showTrackSelector ? '✕ Close' : '⚙ Select Tracks'} ({selectedTracks.length})
                                            </button>
                                        </div>
                                    </div>

                                    {/* Track Selector Panel */}
                                    {showTrackSelector && (
                                        <div className="track-selector-panel">
                                            <div className="track-selector-header">
                                                <span>Select tracks to display:</span>
                                                <div className="track-selector-actions">
                                                    <button onClick={() => {
                                                        const allTracks = [...new Set(features.filter(f => f.track_id !== null).map(f => f.track_id))] as number[];
                                                        setSelectedTracks(allTracks);
                                                    }}>Select All</button>
                                                    <button onClick={() => {
                                                        const allTracks = [...new Set(features.filter(f => f.track_id !== null).map(f => f.track_id))] as number[];
                                                        setSelectedTracks(allTracks.slice(0, 10));
                                                    }}>First 10</button>
                                                    <button onClick={() => setSelectedTracks([])}>Clear All</button>
                                                </div>
                                            </div>
                                            <div className="track-checkboxes">
                                                {(() => {
                                                    const allTracks = [...new Set(features.filter(f => f.track_id !== null).map(f => f.track_id))] as number[];
                                                    return allTracks.sort((a, b) => a - b).map(trackId => (
                                                        <label key={trackId} className="track-checkbox">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTracks.includes(trackId)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedTracks([...selectedTracks, trackId]);
                                                                    } else {
                                                                        setSelectedTracks(selectedTracks.filter(t => t !== trackId));
                                                                    }
                                                                }}
                                                            />
                                                            <span>Track {trackId}</span>
                                                        </label>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <div className="trajectory-container">
                                        <canvas ref={trajectoryCanvasRef} width={800} height={500} />
                                    </div>
                                    <div className="motility-stats">
                                        <h3>Motility Statistics</h3>
                                        <div className="motility-grid">
                                            {(() => {
                                                const filteredFeatures = features.filter(f => {
                                                    const inTrack = selectedTracks.length === 0 || (f.track_id !== null && selectedTracks.includes(f.track_id));
                                                    const inFrame = f.frame_num >= frameRange[0] && f.frame_num <= frameRange[1];
                                                    return inTrack && inFrame;
                                                });
                                                const speeds = filteredFeatures.filter(f => f.speed !== null).map(f => f.speed as number);
                                                const displacements = filteredFeatures.filter(f => f.displacement !== null).map(f => f.displacement as number);
                                                const trackCount = [...new Set(filteredFeatures.filter(f => f.track_id !== null).map(f => f.track_id))].length;

                                                return (
                                                    <>
                                                        <div className="motility-stat">
                                                            <span className="label">Displayed Tracks</span>
                                                            <span className="value">{trackCount}</span>
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
                                        <div className="zscore-title-row">
                                            <h3>Z-Score Normalized Features by Cluster</h3>
                                            <button
                                                className="feature-selector-btn"
                                                onClick={() => setShowFeatureSelector(!showFeatureSelector)}
                                            >
                                                {showFeatureSelector ? '✕ Close' : '⚙ Select Features'} ({selectedZScoreFeatures.length})
                                            </button>
                                        </div>
                                        <p className="zscore-description">
                                            Standardized mean values (z = (x̄<sub>cluster</sub> - μ) / σ) showing how each cluster deviates from the population mean.
                                        </p>
                                    </div>

                                    {showFeatureSelector && (
                                        <div className="zscore-feature-selector">
                                            <div className="feature-selector-header">
                                                <span>Select features to display:</span>
                                                <div className="selector-actions">
                                                    <button onClick={() => setSelectedZScoreFeatures(ALL_ZSCORE_FEATURES.map(f => f.key))}>
                                                        Select All
                                                    </button>
                                                    <button onClick={() => setSelectedZScoreFeatures(DEFAULT_ZSCORE_FEATURES)}>
                                                        Reset Default
                                                    </button>
                                                    <button onClick={() => setSelectedZScoreFeatures([])}>
                                                        Clear All
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="feature-categories">
                                                {['morphology', 'intensity', 'motility'].map(category => (
                                                    <div key={category} className="feature-category">
                                                        <div className={`category-label ${category}`}>
                                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                                        </div>
                                                        <div className="category-features">
                                                            {ALL_ZSCORE_FEATURES.filter(f => f.category === category).map(feature => (
                                                                <label key={feature.key} className="feature-checkbox">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedZScoreFeatures.includes(feature.key)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedZScoreFeatures([...selectedZScoreFeatures, feature.key]);
                                                                            } else {
                                                                                setSelectedZScoreFeatures(selectedZScoreFeatures.filter(k => k !== feature.key));
                                                                            }
                                                                        }}
                                                                    />
                                                                    <span>{feature.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {zScoreData.length === 0 ? (
                                        <p className="no-data">No clustering data available. Run clustering first.</p>
                                    ) : selectedZScoreFeatures.length === 0 ? (
                                        <p className="no-data">Please select at least one feature to display.</p>
                                    ) : (
                                        <div className="zscore-table-container scientific">
                                            <div className="zscore-table-scroll">
                                                <table className="zscore-table scientific-table">
                                                    <thead>
                                                        <tr>
                                                            <th rowSpan={2} className="header-cluster">Cluster</th>
                                                            {['morphology', 'intensity', 'motility'].map(category => {
                                                                const categoryFeatures = selectedZScoreFeatures.filter(key =>
                                                                    ALL_ZSCORE_FEATURES.find(f => f.key === key)?.category === category
                                                                );
                                                                if (categoryFeatures.length === 0) return null;
                                                                return (
                                                                    <th
                                                                        key={category}
                                                                        colSpan={categoryFeatures.length}
                                                                        className={`header-group ${category}`}
                                                                    >
                                                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                                                    </th>
                                                                );
                                                            })}
                                                        </tr>
                                                        <tr className="subheader">
                                                            {selectedZScoreFeatures.map(key => {
                                                                const feature = ALL_ZSCORE_FEATURES.find(f => f.key === key);
                                                                return <th key={key}>{feature?.label || key}</th>;
                                                            })}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {zScoreData.map((row) => {
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
                                                                    {selectedZScoreFeatures.map(key => {
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
                                            </div>

                                            <div className="zscore-footer">
                                                <div className="zscore-legend scientific">
                                                    <div className="legend-section">
                                                        <span className="legend-title">Interpretation:</span>
                                                        <span className="legend-item">
                                                            <span className="color-box high"></span> z &gt; +1.5 (above mean)
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box mid-high"></span> +0.5 to +1.5
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box normal"></span> -0.5 to +0.5 (near mean)
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box mid-low"></span> -1.5 to -0.5
                                                        </span>
                                                        <span className="legend-item">
                                                            <span className="color-box low"></span> z &lt; -1.5 (below mean)
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

        {/* Export Dialog */}
        {showExportDialog && (
            <div className="export-dialog-overlay">
                <div className="export-dialog">
                    <div className="export-dialog-header">
                        <h3>Export Analysis Results</h3>
                        <button className="export-dialog-close" onClick={() => setShowExportDialog(false)}>×</button>
                    </div>
                    <div className="export-dialog-body">
                        <div className="export-section">
                            <div className="export-section-header">
                                <span className="section-label">Data</span>
                                <div className="section-actions">
                                    <button onClick={selectAllExports}>Select All</button>
                                    <button onClick={deselectAllExports}>Deselect All</button>
                                </div>
                            </div>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.csvData}
                                    onChange={() => toggleExportOption('csvData')}
                                />
                                <span className="option-icon">📊</span>
                                <span className="option-text">
                                    <strong>CSV Data File</strong>
                                    <small>All cell features and analysis data</small>
                                </span>
                            </label>
                        </div>

                        <div className="export-section">
                            <span className="section-label">Distribution Charts</span>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.areaHistogram}
                                    onChange={() => toggleExportOption('areaHistogram')}
                                />
                                <span className="option-icon">📈</span>
                                <span className="option-text">
                                    <strong>Area Distribution</strong>
                                    <small>Histogram of cell areas</small>
                                </span>
                            </label>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.intensityHistogram}
                                    onChange={() => toggleExportOption('intensityHistogram')}
                                />
                                <span className="option-icon">📈</span>
                                <span className="option-text">
                                    <strong>Intensity Distribution</strong>
                                    <small>Histogram of mean intensities</small>
                                </span>
                            </label>
                        </div>

                        <div className="export-section">
                            <span className="section-label">Cluster Analysis</span>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.clusterPCA}
                                    onChange={() => toggleExportOption('clusterPCA')}
                                />
                                <span className="option-icon">🎯</span>
                                <span className="option-text">
                                    <strong>Cluster Space (PCA)</strong>
                                    <small>2D PCA scatter plot with clusters</small>
                                </span>
                            </label>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.clusterDistribution}
                                    onChange={() => toggleExportOption('clusterDistribution')}
                                />
                                <span className="option-icon">📊</span>
                                <span className="option-text">
                                    <strong>Cluster Distribution</strong>
                                    <small>Bar chart of cells per cluster</small>
                                </span>
                            </label>
                        </div>

                        <div className="export-section">
                            <span className="section-label">Z-Score & Motility</span>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.zscoreHeatmap}
                                    onChange={() => toggleExportOption('zscoreHeatmap')}
                                />
                                <span className="option-icon">🌡️</span>
                                <span className="option-text">
                                    <strong>Z-Score Heatmap</strong>
                                    <small>Feature deviation by cluster</small>
                                </span>
                            </label>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.motilityChart}
                                    onChange={() => toggleExportOption('motilityChart')}
                                />
                                <span className="option-icon">📉</span>
                                <span className="option-text">
                                    <strong>Motility Over Time</strong>
                                    <small>Cell movement chart</small>
                                </span>
                            </label>
                            <label className="export-option">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.trajectory3D}
                                    onChange={() => toggleExportOption('trajectory3D')}
                                />
                                <span className="option-icon">🗺️</span>
                                <span className="option-text">
                                    <strong>3D Trajectory</strong>
                                    <small>Cell trajectories visualization</small>
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="export-dialog-footer">
                        <span className="export-count">
                            {Object.values(exportOptions).filter(Boolean).length} items selected
                        </span>
                        <div className="export-dialog-actions">
                            <button className="cancel-btn" onClick={() => setShowExportDialog(false)}>
                                Cancel
                            </button>
                            <button
                                className="export-confirm-btn"
                                onClick={performExport}
                                disabled={exporting || Object.values(exportOptions).every(v => !v)}
                            >
                                {exporting ? 'Exporting...' : 'Export Selected'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

// Histogram with proper axes
const AreaHistogram = forwardRef<HTMLCanvasElement, { data: CellFeature[] }>(({ data }, ref) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const areas = data.filter(d => d.area !== null).map(d => d.area as number);
        if (areas.length === 0) return;

        const min = Math.min(...areas);
        const max = Math.max(...areas);
        const binCount = 15;
        const binSize = (max - min) / binCount || 1;
        const bins = new Array(binCount).fill(0);

        areas.forEach(area => {
            const binIndex = Math.min(Math.floor((area - min) / binSize), binCount - 1);
            bins[binIndex]++;
        });

        const maxBin = Math.max(...bins);

        // Layout
        const padding = { top: 30, right: 20, bottom: 50, left: 55 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotHeight * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
        }

        // Draw bars
        const barWidth = plotWidth / binCount;
        ctx.fillStyle = '#4a90e2';
        bins.forEach((count, i) => {
            const barHeight = (count / maxBin) * plotHeight;
            const x = padding.left + i * barWidth;
            const y = padding.top + plotHeight - barHeight;
            ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        });

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y axis
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, canvas.height - padding.bottom);
        // X axis
        ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
        ctx.stroke();

        // Y axis labels (Count)
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const value = Math.round((maxBin * (4 - i)) / 4);
            const y = padding.top + (plotHeight * i) / 4;
            ctx.fillText(String(value), padding.left - 8, y + 4);
        }

        // X axis labels (Area values)
        ctx.textAlign = 'center';
        const xLabels = 5;
        for (let i = 0; i <= xLabels; i++) {
            const value = min + (max - min) * (i / xLabels);
            const x = padding.left + (plotWidth * i) / xLabels;
            ctx.fillText(String(Math.round(value)), x, canvas.height - padding.bottom + 18);
        }

        // Axis titles
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText('Area (px²)', canvas.width / 2, canvas.height - 8);

        // Y axis title (rotated)
        ctx.save();
        ctx.translate(14, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Count', 0, 0);
        ctx.restore();

        // Title
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Area Distribution', canvas.width / 2, 16);

    }, [data]);

    return <canvas ref={canvasRef} width={400} height={250} />;
});

const IntensityHistogram = forwardRef<HTMLCanvasElement, { data: CellFeature[] }>(({ data }, ref) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const intensities = data.filter(d => d.mean_intensity !== null).map(d => d.mean_intensity as number);
        if (intensities.length === 0) return;

        const min = Math.min(...intensities);
        const max = Math.max(...intensities);
        const binCount = 15;
        const binSize = (max - min) / binCount || 1;
        const bins = new Array(binCount).fill(0);

        intensities.forEach(intensity => {
            const binIndex = Math.min(Math.floor((intensity - min) / binSize), binCount - 1);
            bins[binIndex]++;
        });

        const maxBin = Math.max(...bins);

        // Layout
        const padding = { top: 30, right: 20, bottom: 50, left: 55 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotHeight * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
        }

        // Draw bars
        const barWidth = plotWidth / binCount;
        ctx.fillStyle = '#27ae60';
        bins.forEach((count, i) => {
            const barHeight = (count / maxBin) * plotHeight;
            const x = padding.left + i * barWidth;
            const y = padding.top + plotHeight - barHeight;
            ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        });

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y axis
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, canvas.height - padding.bottom);
        // X axis
        ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
        ctx.stroke();

        // Y axis labels (Count)
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const value = Math.round((maxBin * (4 - i)) / 4);
            const y = padding.top + (plotHeight * i) / 4;
            ctx.fillText(String(value), padding.left - 8, y + 4);
        }

        // X axis labels (Intensity values)
        ctx.textAlign = 'center';
        const xLabels = 5;
        for (let i = 0; i <= xLabels; i++) {
            const value = min + (max - min) * (i / xLabels);
            const x = padding.left + (plotWidth * i) / xLabels;
            ctx.fillText(value.toFixed(1), x, canvas.height - padding.bottom + 18);
        }

        // Axis titles
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText('Mean Intensity', canvas.width / 2, canvas.height - 8);

        // Y axis title (rotated)
        ctx.save();
        ctx.translate(14, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Count', 0, 0);
        ctx.restore();

        // Title
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Intensity Distribution', canvas.width / 2, 16);

    }, [data]);

    return <canvas ref={canvasRef} width={400} height={250} />;
});

// PCA implementation for 2D visualization
const computePCA = (data: number[][]): { pc1: number[], pc2: number[], variance: [number, number] } => {
    const n = data.length;
    const m = data[0].length;

    // Calculate mean for each feature
    const means = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
            means[j] += data[i][j];
        }
        means[j] /= n;
    }

    // Center the data and calculate std
    const stds = new Array(m).fill(0);
    const centered = data.map(row => row.map((val, j) => val - means[j]));
    for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
            stds[j] += centered[i][j] * centered[i][j];
        }
        stds[j] = Math.sqrt(stds[j] / n) || 1;
    }

    // Standardize (z-score normalization)
    const standardized = centered.map(row => row.map((val, j) => val / stds[j]));

    // Calculate covariance matrix
    const cov: number[][] = [];
    for (let i = 0; i < m; i++) {
        cov[i] = [];
        for (let j = 0; j < m; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += standardized[k][i] * standardized[k][j];
            }
            cov[i][j] = sum / (n - 1);
        }
    }

    // Power iteration to find first two eigenvectors
    const powerIteration = (matrix: number[][], numIterations: number = 100): number[] => {
        let vec = new Array(matrix.length).fill(0).map(() => Math.random());
        const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        vec = vec.map(x => x / norm(vec));

        for (let iter = 0; iter < numIterations; iter++) {
            const newVec = new Array(matrix.length).fill(0);
            for (let i = 0; i < matrix.length; i++) {
                for (let j = 0; j < matrix.length; j++) {
                    newVec[i] += matrix[i][j] * vec[j];
                }
            }
            const n = norm(newVec);
            vec = newVec.map(x => x / n);
        }
        return vec;
    };

    // Get first eigenvector
    const ev1 = powerIteration(cov);

    // Deflate matrix to get second eigenvector
    const eigenvalue1 = ev1.reduce((sum, _, i) =>
        sum + ev1.reduce((s, _, j) => s + cov[i][j] * ev1[j], 0) * ev1[i], 0
    );

    const deflated: number[][] = cov.map((row, i) =>
        row.map((val, j) => val - eigenvalue1 * ev1[i] * ev1[j])
    );

    const ev2 = powerIteration(deflated);

    // Project data onto principal components
    const pc1: number[] = [];
    const pc2: number[] = [];

    for (let i = 0; i < n; i++) {
        let p1 = 0, p2 = 0;
        for (let j = 0; j < m; j++) {
            p1 += standardized[i][j] * ev1[j];
            p2 += standardized[i][j] * ev2[j];
        }
        pc1.push(p1);
        pc2.push(p2);
    }

    // Calculate variance explained (approximate)
    const totalVar = cov.reduce((s, row, i) => s + row[i], 0);
    const eigenvalue2 = ev2.reduce((sum, _, i) =>
        sum + ev2.reduce((s, _, j) => s + deflated[i][j] * ev2[j], 0) * ev2[i], 0
    );

    const var1 = (eigenvalue1 / totalVar) * 100;
    const var2 = (Math.abs(eigenvalue2) / totalVar) * 100;

    return { pc1, pc2, variance: [var1, var2] };
};

// Cluster Space Scatter Plot using PCA (2D visualization)
const ClusterScatterPlot = forwardRef<HTMLCanvasElement, { data: CellFeature[] }>(({ data }, ref) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Filter cells with cluster assignments and required features
        const featureKeys = ['area', 'mean_intensity', 'eccentricity', 'solidity', 'circularity', 'aspect_ratio'];

        const clusteredData = data.filter(d => {
            if (d.gmm_state === null && d.hmm_state === null) return false;
            return featureKeys.every(key => (d as any)[key] !== null && (d as any)[key] !== undefined);
        });

        if (clusteredData.length < 3) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Insufficient data for PCA.', canvas.width / 2, canvas.height / 2 - 10);
            ctx.fillText('Need at least 3 clustered cells with features.', canvas.width / 2, canvas.height / 2 + 15);
            return;
        }

        // Extract feature matrix
        const featureMatrix = clusteredData.map(d =>
            featureKeys.map(key => (d as any)[key] as number)
        );

        // Compute PCA
        const { pc1, pc2, variance } = computePCA(featureMatrix);
        const clusters = clusteredData.map(d => d.hmm_state ?? d.gmm_state ?? 0);

        const minX = Math.min(...pc1), maxX = Math.max(...pc1);
        const minY = Math.min(...pc2), maxY = Math.max(...pc2);
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Add padding to ranges
        const padX = rangeX * 0.1;
        const padY = rangeY * 0.1;

        // Layout
        const padding = { top: 40, right: 80, bottom: 55, left: 65 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Grid lines
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (plotHeight * i) / 5;
            const x = padding.left + (plotWidth * i) / 5;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, canvas.height - padding.bottom);
            ctx.stroke();
        }

        // Get unique clusters and colors
        const uniqueClusters = [...new Set(clusters)].sort((a, b) => a - b);
        const clusterColors: { [key: number]: string } = {};
        const colorPalette = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];
        uniqueClusters.forEach((cluster, i) => {
            clusterColors[cluster] = colorPalette[i % colorPalette.length];
        });

        // Draw points
        clusteredData.forEach((_, i) => {
            const x = padding.left + ((pc1[i] - minX + padX) / (rangeX + 2 * padX)) * plotWidth;
            const y = padding.top + plotHeight - ((pc2[i] - minY + padY) / (rangeY + 2 * padY)) * plotHeight;
            const cluster = clusters[i];

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = clusterColors[cluster] + 'cc';
            ctx.fill();
            ctx.strokeStyle = clusterColors[cluster];
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, canvas.height - padding.bottom);
        ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
        ctx.stroke();

        // Y axis labels
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = (minY - padY) + ((rangeY + 2 * padY) * (5 - i)) / 5;
            const y = padding.top + (plotHeight * i) / 5;
            ctx.fillText(value.toFixed(1), padding.left - 8, y + 3);
        }

        // X axis labels
        ctx.textAlign = 'center';
        for (let i = 0; i <= 5; i++) {
            const value = (minX - padX) + ((rangeX + 2 * padX) * i) / 5;
            const x = padding.left + (plotWidth * i) / 5;
            ctx.fillText(value.toFixed(1), x, canvas.height - padding.bottom + 15);
        }

        // Axis titles with variance explained
        ctx.font = 'bold 11px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(`PC1 (${variance[0].toFixed(1)}% var)`, padding.left + plotWidth / 2, canvas.height - 8);

        ctx.save();
        ctx.translate(14, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`PC2 (${variance[1].toFixed(1)}% var)`, 0, 0);
        ctx.restore();

        // Title
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Cluster Space (PCA)', canvas.width / 2 - 20, 18);

        // Subtitle with features used
        ctx.font = '10px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`Features: ${featureKeys.length} morphology + intensity`, canvas.width / 2 - 20, 32);

        // Legend
        const legendX = canvas.width - padding.right + 10;
        let legendY = padding.top + 10;
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.fillText('Clusters:', legendX, legendY);
        legendY += 16;

        ctx.font = '10px Arial';
        uniqueClusters.forEach((cluster) => {
            ctx.fillStyle = clusterColors[cluster];
            ctx.beginPath();
            ctx.arc(legendX + 6, legendY - 3, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#333';
            ctx.fillText(`State ${cluster}`, legendX + 16, legendY);
            legendY += 14;
        });

        // Total cells info
        ctx.fillStyle = '#888';
        ctx.font = '9px Arial';
        ctx.fillText(`n=${clusteredData.length}`, legendX, legendY + 5);

    }, [data]);

    return <canvas ref={canvasRef} width={700} height={400} />;
});

// Cluster Distribution Bar Chart
const ClusterDistributionChart = forwardRef<HTMLCanvasElement, { data: CellFeature[] }>(({ data }, ref) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Count cells per cluster
        const clusteredData = data.filter(d => d.gmm_state !== null || d.hmm_state !== null);

        if (clusteredData.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No clustering data available.', canvas.width / 2, canvas.height / 2);
            return;
        }

        const clusterCounts: { [key: number]: number } = {};
        clusteredData.forEach(d => {
            const cluster = d.hmm_state ?? d.gmm_state ?? 0;
            clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
        });

        const clusters = Object.keys(clusterCounts).map(Number).sort((a, b) => a - b);
        const counts = clusters.map(c => clusterCounts[c]);
        const maxCount = Math.max(...counts);

        // Layout
        const padding = { top: 35, right: 20, bottom: 55, left: 55 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotHeight * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
        }

        // Colors
        const colorPalette = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];

        // Draw bars
        const barWidth = plotWidth / clusters.length;
        const barPadding = barWidth * 0.2;
        clusters.forEach((cluster, i) => {
            const count = clusterCounts[cluster];
            const barHeight = (count / maxCount) * plotHeight;
            const x = padding.left + i * barWidth + barPadding / 2;
            const y = padding.top + plotHeight - barHeight;

            ctx.fillStyle = colorPalette[i % colorPalette.length];
            ctx.fillRect(x, y, barWidth - barPadding, barHeight);

            // Count label on top of bar
            ctx.fillStyle = '#333';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(String(count), x + (barWidth - barPadding) / 2, y - 5);
        });

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, canvas.height - padding.bottom);
        ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
        ctx.stroke();

        // Y axis labels
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const value = Math.round((maxCount * (4 - i)) / 4);
            const y = padding.top + (plotHeight * i) / 4;
            ctx.fillText(String(value), padding.left - 8, y + 4);
        }

        // X axis labels (cluster numbers)
        ctx.textAlign = 'center';
        clusters.forEach((cluster, i) => {
            const x = padding.left + i * barWidth + barWidth / 2;
            ctx.fillText(`State ${cluster}`, x, canvas.height - padding.bottom + 18);
        });

        // Axis titles
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText('Cluster State', canvas.width / 2, canvas.height - 8);

        ctx.save();
        ctx.translate(14, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Cell Count', 0, 0);
        ctx.restore();

        // Title
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Cluster Distribution', canvas.width / 2, 18);

    }, [data]);

    return <canvas ref={canvasRef} width={400} height={280} />;
});

// BIC/AIC Chart for model selection visualization
const BicAicChart = forwardRef<HTMLCanvasElement, { clusteringInfo: ClusteringInfo }>(({ clusteringInfo }, ref) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { scores, optimal_components, optimal_k_by_bic, optimal_k_by_aic, selection_method } = clusteringInfo;

        if (!scores || scores.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No BIC/AIC data available.', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Extract data
        const kValues = scores.map(s => s.n_components);
        const bicValues = scores.map(s => s.bic);
        const aicValues = scores.map(s => s.aic);

        // Layout
        const padding = { top: 50, right: 120, bottom: 60, left: 80 };
        const plotWidth = canvas.width - padding.left - padding.right;
        const plotHeight = canvas.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Calculate scales
        const minK = Math.min(...kValues);
        const maxK = Math.max(...kValues);
        const allValues = [...bicValues, ...aicValues];
        const minY = Math.min(...allValues);
        const maxY = Math.max(...allValues);
        const rangeY = maxY - minY || 1;
        const padY = rangeY * 0.1;

        // Grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (plotHeight * i) / 5;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
        }

        // Helper to map data to canvas coordinates
        const xScale = (k: number) => padding.left + ((k - minK) / (maxK - minK || 1)) * plotWidth;
        const yScale = (v: number) => padding.top + plotHeight - ((v - minY + padY) / (rangeY + 2 * padY)) * plotHeight;

        // Draw BIC line
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        scores.forEach((s, i) => {
            const x = xScale(s.n_components);
            const y = yScale(s.bic);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw BIC points
        scores.forEach((s) => {
            const x = xScale(s.n_components);
            const y = yScale(s.bic);
            ctx.beginPath();
            ctx.arc(x, y, s.n_components === optimal_k_by_bic ? 8 : 5, 0, Math.PI * 2);
            ctx.fillStyle = s.n_components === optimal_k_by_bic ? '#c0392b' : '#e74c3c';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Draw AIC line
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        scores.forEach((s, i) => {
            const x = xScale(s.n_components);
            const y = yScale(s.aic);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw AIC points
        scores.forEach((s) => {
            const x = xScale(s.n_components);
            const y = yScale(s.aic);
            ctx.beginPath();
            ctx.arc(x, y, s.n_components === optimal_k_by_aic ? 8 : 5, 0, Math.PI * 2);
            ctx.fillStyle = s.n_components === optimal_k_by_aic ? '#2980b9' : '#3498db';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Draw vertical line at optimal k
        const optimalX = xScale(optimal_components);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(optimalX, padding.top);
        ctx.lineTo(optimalX, padding.top + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, canvas.height - padding.bottom);
        ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
        ctx.stroke();

        // X axis labels (k values)
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        kValues.forEach(k => {
            const x = xScale(k);
            ctx.fillText(String(k), x, canvas.height - padding.bottom + 18);
        });

        // Y axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = minY - padY + ((rangeY + 2 * padY) * (5 - i)) / 5;
            const y = padding.top + (plotHeight * i) / 5;
            ctx.fillText(value.toFixed(0), padding.left - 10, y + 4);
        }

        // Axis titles
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText('Number of Clusters (k)', padding.left + plotWidth / 2, canvas.height - 10);

        ctx.save();
        ctx.translate(18, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Information Criterion Score', 0, 0);
        ctx.restore();

        // Title
        ctx.font = 'bold 14px Arial';
        ctx.fillText('BIC & AIC vs Number of Clusters', canvas.width / 2 - 30, 20);

        // Subtitle with selection info
        ctx.font = '11px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`Selected k=${optimal_components} (${selection_method})`, canvas.width / 2 - 30, 36);

        // Legend
        const legendX = canvas.width - padding.right + 15;
        let legendY = padding.top + 10;

        ctx.font = 'bold 11px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.fillText('Legend:', legendX, legendY);
        legendY += 20;

        // BIC legend
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(legendX + 6, legendY - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.fillText(`BIC (k*=${optimal_k_by_bic})`, legendX + 16, legendY);
        legendY += 18;

        // AIC legend
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(legendX + 6, legendY - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillText(`AIC (k*=${optimal_k_by_aic})`, legendX + 16, legendY);
        legendY += 18;

        // Selected k legend
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(legendX, legendY - 3);
        ctx.lineTo(legendX + 12, legendY - 3);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#333';
        ctx.fillText(`Selected (k=${optimal_components})`, legendX + 16, legendY);
        legendY += 25;

        // Info box
        ctx.fillStyle = '#f8f9fa';
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        const infoBoxY = legendY;
        ctx.fillRect(legendX - 5, infoBoxY, 105, 55);
        ctx.strokeRect(legendX - 5, infoBoxY, 105, 55);

        ctx.fillStyle = '#666';
        ctx.font = '9px Arial';
        ctx.fillText('Lower = Better', legendX, infoBoxY + 14);
        ctx.fillText('BIC penalizes more', legendX, infoBoxY + 28);
        ctx.fillText('(conservative)', legendX, infoBoxY + 40);

    }, [clusteringInfo]);

    return <canvas ref={canvasRef} width={700} height={350} />;
});

export default AnalysisResults;
