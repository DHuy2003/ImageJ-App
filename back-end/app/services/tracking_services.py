"""
Tracking Services - Cell tracking across frames
Supports both simple nearest-neighbor tracking and GNN-based tracking (cell-tracker-gnn)
"""
import os
import sys
import numpy as np
import csv
import tempfile
import shutil
from io import StringIO
from scipy.optimize import linear_sum_assignment
from app import db, config
from app.models import Image as ImageModel, CellFeature

# GNN tracking configuration
GNN_TRACKER_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cell_tracker_gnn')
GNN_MODEL_PATH = os.path.join(GNN_TRACKER_PATH, 'models')  # Where pretrained models should be stored
GNN_AVAILABLE = False

# Pretrained models path (inside cell_tracker_gnn/models/pretrained/)
PRETRAINED_MODELS_PATH = os.path.join(GNN_MODEL_PATH, 'pretrained')

# Available pretrained datasets with their model configurations
PRETRAINED_DATASETS = {
    "Fluo-C2DL-Huh7": {
        "metric_model": os.path.join(PRETRAINED_MODELS_PATH, "Features_Models", "Fluo-C2DL-Huh7", "all_params.pth"),
        "tracking_model": os.path.join(PRETRAINED_MODELS_PATH, "Tracking_Models", "Fluo-C2DL-Huh7", "checkpoints", "epoch=136.ckpt"),
    },
    "Fluo-N2DH-SIM+": {
        "metric_model": os.path.join(PRETRAINED_MODELS_PATH, "Features_Models", "Fluo-N2DH-SIM+", "all_params.pth"),
        "tracking_model": os.path.join(PRETRAINED_MODELS_PATH, "Tracking_Models", "Fluo-N2DH-SIM+", "checkpoints", "epoch=132.ckpt"),
    },
    "Fluo-N2DL-HeLa": {
        "metric_model": os.path.join(PRETRAINED_MODELS_PATH, "Features_Models", "Fluo-N2DL-HeLa", "all_params.pth"),
        "tracking_model": os.path.join(PRETRAINED_MODELS_PATH, "Tracking_Models", "Fluo-N2DL-HeLa", "checkpoints", "epoch=312.ckpt"),
    },
    "Fluo-N3DH-SIM+": {
        "metric_model": os.path.join(PRETRAINED_MODELS_PATH, "Features_Models", "Fluo-N3DH-SIM+", "all_params.pth"),
        "tracking_model": os.path.join(PRETRAINED_MODELS_PATH, "Tracking_Models", "Fluo-N3DH-SIM+", "checkpoints", "epoch=42.ckpt"),
    },
    "PhC-C2DH-U373": {
        "metric_model": os.path.join(PRETRAINED_MODELS_PATH, "Features_Models", "PhC-C2DH-U373", "all_params.pth"),
        "tracking_model": os.path.join(PRETRAINED_MODELS_PATH, "Tracking_Models", "PhC-C2DH-U373", "checkpoints", "epoch=10.ckpt"),
    },
    "DIC-C2DH-HeLa": {
        "metric_model": os.path.join(PRETRAINED_MODELS_PATH, "Features_Models", "DIC-C2DH-HeLa", "all_params.pth"),
        "tracking_model": os.path.join(PRETRAINED_MODELS_PATH, "Tracking_Models", "DIC-C2DH-HeLa", "checkpoints", "epoch=39.ckpt"),
    },
}


def get_pretrained_models_for_dataset(dataset_name):
    """
    Find matching pretrained models for a given dataset name.
    Supports partial matching (e.g., "Fluo-N2DL-HeLa-01" matches "Fluo-N2DL-HeLa")

    Args:
        dataset_name: Name of the dataset (can include sequence number like -01, -02)

    Returns:
        tuple: (metric_model_path, tracking_model_path) or (None, None) if not found
    """
    if not dataset_name:
        return None, None

    # Try exact match first
    if dataset_name in PRETRAINED_DATASETS:
        models = PRETRAINED_DATASETS[dataset_name]
        if os.path.exists(models["metric_model"]) and os.path.exists(models["tracking_model"]):
            print(f"Found exact match pretrained models for: {dataset_name}")
            return models["metric_model"], models["tracking_model"]

    # Try partial match (remove sequence number like -01, -02)
    for key in PRETRAINED_DATASETS:
        if dataset_name.startswith(key) or key in dataset_name:
            models = PRETRAINED_DATASETS[key]
            if os.path.exists(models["metric_model"]) and os.path.exists(models["tracking_model"]):
                print(f"Found partial match pretrained models: {key} for dataset: {dataset_name}")
                return models["metric_model"], models["tracking_model"]

    print(f"No pretrained models found for dataset: {dataset_name}")
    return None, None


def get_available_pretrained_datasets():
    """
    Get list of available pretrained datasets with their model status.

    Returns:
        list: List of dicts with dataset info and model availability
    """
    result = []
    for name, paths in PRETRAINED_DATASETS.items():
        result.append({
            "name": name,
            "metric_model_exists": os.path.exists(paths["metric_model"]),
            "tracking_model_exists": os.path.exists(paths["tracking_model"]),
            "ready": os.path.exists(paths["metric_model"]) and os.path.exists(paths["tracking_model"])
        })
    return result

def check_gnn_availability():
    """Check if GNN tracking dependencies are available"""
    global GNN_AVAILABLE

    # Check if cell-tracker-gnn directory exists
    if not os.path.exists(GNN_TRACKER_PATH):
        print("GNN Tracker: cell-tracker-gnn directory not found")
        return False

    # Check for required Python packages
    try:
        import torch
        import torch_geometric
        print(f"GNN Tracker: PyTorch {torch.__version__} found")
        print(f"GNN Tracker: PyTorch Geometric {torch_geometric.__version__} found")

        # Check for CUDA availability
        if torch.cuda.is_available():
            print(f"GNN Tracker: CUDA available - {torch.cuda.get_device_name(0)}")
        else:
            print("GNN Tracker: CUDA not available, will use CPU (slower)")

        GNN_AVAILABLE = True
        return True
    except ImportError as e:
        print(f"GNN Tracker: Missing dependencies - {e}")
        GNN_AVAILABLE = False
        return False

# Check on module load
check_gnn_availability()


def run_tracking(max_distance=100.0):
    """
    Run simple nearest-neighbor cell tracking based on centroid distance

    Args:
        max_distance: Maximum distance threshold for linking cells

    Returns:
        dict with tracking results
    """
    print("="*50, flush=True)
    print("TRACKING SERVICE: Starting tracking process...", flush=True)
    print(f"Max distance threshold: {max_distance}", flush=True)

    # Get all features ordered by frame
    features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()
    print(f"Found {len(features)} existing features in database")

    # Auto extract features if not available
    if not features:
        print("No features found, auto-extracting features from masks...")
        from app.services.feature_extraction_services import extract_features_batch
        extract_result = extract_features_batch()
        print(f"Auto-extract completed: {extract_result}")

        # Re-query features after extraction
        features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()
        print(f"After extraction: {len(features)} features")

        if not features:
            print("ERROR: No features found after extraction!")
            return {"error": "No features found. Make sure masks are available."}

    # Group by frame
    frames = {}
    for f in features:
        if f.frame_num not in frames:
            frames[f.frame_num] = []
        frames[f.frame_num].append(f)

    frame_nums = sorted(frames.keys())
    print(f"Grouped features into {len(frame_nums)} frames")
    print(f"Frame range: {frame_nums[0]} to {frame_nums[-1]}" if frame_nums else "No frames")

    if len(frame_nums) < 2:
        print("Need at least 2 frames for tracking")
        return {"message": "Need at least 2 frames for tracking", "tracks": 0}

    # Initialize tracking
    next_track_id = 1
    track_mapping = {}  # cell_id -> track_id for current frame

    # First frame - assign new track IDs
    for cell in frames[frame_nums[0]]:
        cell.track_id = next_track_id
        track_mapping[cell.id] = next_track_id
        next_track_id += 1

    # Track through subsequent frames
    for i in range(1, len(frame_nums)):
        prev_frame = frame_nums[i - 1]
        curr_frame = frame_nums[i]

        prev_cells = frames[prev_frame]
        curr_cells = frames[curr_frame]

        # Build cost matrix based on distance
        cost_matrix = np.full((len(curr_cells), len(prev_cells)), np.inf)

        for ci, curr_cell in enumerate(curr_cells):
            for pi, prev_cell in enumerate(prev_cells):
                if curr_cell.centroid_row is None or prev_cell.centroid_row is None:
                    continue
                dist = np.sqrt(
                    (curr_cell.centroid_row - prev_cell.centroid_row) ** 2 +
                    (curr_cell.centroid_col - prev_cell.centroid_col) ** 2
                )
                if dist <= max_distance:
                    cost_matrix[ci, pi] = dist

        # Hungarian algorithm for optimal assignment
        if cost_matrix.shape[0] > 0 and cost_matrix.shape[1] > 0:
            row_ind, col_ind = linear_sum_assignment(cost_matrix)

            assigned_curr = set()
            for ci, pi in zip(row_ind, col_ind):
                if cost_matrix[ci, pi] < np.inf:
                    # Link to existing track
                    prev_cell = prev_cells[pi]
                    curr_cell = curr_cells[ci]
                    curr_cell.track_id = prev_cell.track_id
                    assigned_curr.add(ci)

                    # Compute motion features
                    curr_cell.delta_x = curr_cell.centroid_col - prev_cell.centroid_col
                    curr_cell.delta_y = curr_cell.centroid_row - prev_cell.centroid_row
                    curr_cell.displacement = np.sqrt(
                        curr_cell.delta_x ** 2 + curr_cell.delta_y ** 2
                    )
                    curr_cell.speed = curr_cell.displacement

                    # Compute turning angle if previous cell had motion
                    if prev_cell.delta_x is not None and prev_cell.delta_y is not None:
                        prev_angle = np.arctan2(prev_cell.delta_y, prev_cell.delta_x)
                        curr_angle = np.arctan2(curr_cell.delta_y, curr_cell.delta_x)
                        curr_cell.turning = curr_angle - prev_angle

            # Assign new track IDs to unassigned cells
            for ci, curr_cell in enumerate(curr_cells):
                if ci not in assigned_curr:
                    curr_cell.track_id = next_track_id
                    next_track_id += 1

    db.session.commit()

    # Count tracks
    unique_tracks = db.session.query(CellFeature.track_id).distinct().count()

    print(f"Tracking completed!")
    print(f"Total tracks: {unique_tracks}")
    print(f"Total cells: {len(features)}")
    print(f"Frames processed: {len(frame_nums)}")
    print("="*50)

    return {
        "message": "Tracking completed",
        "total_tracks": unique_tracks,
        "total_cells": len(features),
        "frames_processed": len(frame_nums)
    }


def run_tracking_from_mask_labels():
    """
    Use mask label values directly as track IDs.

    In Cell Tracking Challenge format and similar datasets,
    the same cell across frames has the same label value in the mask.
    This function uses cell_id (which comes from mask labels) as track_id.

    Returns:
        dict with tracking results
    """
    print("="*50, flush=True)
    print("MASK LABEL TRACKING: Using mask labels as track IDs...", flush=True)

    # Get all features ordered by frame
    features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()
    print(f"Found {len(features)} existing features in database", flush=True)

    # Auto extract features if not available
    if not features:
        print("No features found, auto-extracting features from masks...", flush=True)
        from app.services.feature_extraction_services import extract_features_batch
        extract_result = extract_features_batch()
        print(f"Auto-extract completed: {extract_result}", flush=True)

        # Re-query features after extraction
        features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()
        print(f"After extraction: {len(features)} features", flush=True)

        if not features:
            print("ERROR: No features found after extraction!", flush=True)
            return {"error": "No features found. Make sure masks are available."}

    # Check if mask labels are consistent (same cell_id appears in multiple frames)
    # This indicates Cell Tracking Challenge format where label = track ID
    from collections import defaultdict
    cell_id_frames = defaultdict(list)
    for f in features:
        cell_id_frames[f.cell_id].append(f.frame_num)

    # Check how many cell_ids appear in multiple frames
    multi_frame_ids = [cid for cid, frames in cell_id_frames.items() if len(frames) > 1]
    single_frame_ids = [cid for cid, frames in cell_id_frames.items() if len(frames) == 1]

    print(f"Cell IDs appearing in multiple frames: {len(multi_frame_ids)}", flush=True)
    print(f"Cell IDs appearing in single frame: {len(single_frame_ids)}", flush=True)

    # If most cells appear in multiple frames, use cell_id as track_id
    if len(multi_frame_ids) > 0:
        print("Detected consistent cell IDs across frames - using as track IDs", flush=True)

        # Group by frame for motion computation
        frames = {}
        for f in features:
            if f.frame_num not in frames:
                frames[f.frame_num] = {}
            frames[f.frame_num][f.cell_id] = f

        frame_nums = sorted(frames.keys())
        print(f"Frame range: {frame_nums[0]} to {frame_nums[-1]}", flush=True)

        # Assign cell_id as track_id
        for f in features:
            f.track_id = f.cell_id

        # Compute motion features by linking same cell_id across consecutive frames
        for i in range(1, len(frame_nums)):
            prev_frame = frame_nums[i - 1]
            curr_frame = frame_nums[i]

            prev_cells = frames[prev_frame]
            curr_cells = frames[curr_frame]

            # Find cells with same cell_id (track_id) in both frames
            for cell_id, curr_cell in curr_cells.items():
                if cell_id in prev_cells:
                    prev_cell = prev_cells[cell_id]

                    # Compute motion features
                    if curr_cell.centroid_col is not None and prev_cell.centroid_col is not None:
                        curr_cell.delta_x = curr_cell.centroid_col - prev_cell.centroid_col
                        curr_cell.delta_y = curr_cell.centroid_row - prev_cell.centroid_row
                        curr_cell.displacement = np.sqrt(
                            curr_cell.delta_x ** 2 + curr_cell.delta_y ** 2
                        )
                        curr_cell.speed = curr_cell.displacement

                        # Compute turning angle if previous cell had motion
                        if prev_cell.delta_x is not None and prev_cell.delta_y is not None:
                            prev_angle = np.arctan2(prev_cell.delta_y, prev_cell.delta_x)
                            curr_angle = np.arctan2(curr_cell.delta_y, curr_cell.delta_x)
                            curr_cell.turning = curr_angle - prev_angle

        db.session.commit()

        # Count unique tracks
        unique_tracks = db.session.query(CellFeature.track_id).distinct().count()

        print(f"Mask label tracking completed!", flush=True)
        print(f"Total tracks: {unique_tracks}", flush=True)
        print(f"Total cells: {len(features)}", flush=True)
        print(f"Frames processed: {len(frame_nums)}", flush=True)
        print("="*50, flush=True)

        return {
            "message": "Tracking completed using mask labels",
            "method": "mask_labels",
            "total_tracks": unique_tracks,
            "total_cells": len(features),
            "frames_processed": len(frame_nums)
        }
    else:
        # No consistent cell IDs - masks don't have track IDs embedded
        print("No consistent cell IDs across frames - masks don't have track IDs", flush=True)
        print("ERROR: Cannot perform tracking without GNN or embedded track IDs", flush=True)
        print("="*50, flush=True)
        return {
            "error": "Masks don't contain track IDs. Please install GNN dependencies or provide masks with embedded track IDs.",
            "message": "Tracking failed - no track IDs in masks",
            "method": "none"
        }


def run_gnn_tracking(dataset_name=None):
    """
    GNN-based tracking using cell-tracker-gnn
    Falls back to using mask labels as track IDs if GNN is not available

    Args:
        dataset_name: Optional name of the dataset to use for selecting pretrained models.
                     Supports CTC dataset names like "Fluo-N2DL-HeLa", "PhC-C2DH-U373", etc.
                     If the name matches a pretrained dataset, those models will be used.
    """
    print("="*50, flush=True)
    print("GNN TRACKING: Starting GNN-based tracking...", flush=True)
    if dataset_name:
        print(f"Dataset name provided: {dataset_name}", flush=True)

    # First, auto-extract features if not available
    features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()
    if not features:
        print("No features found, auto-extracting features from masks...", flush=True)
        from app.services.feature_extraction_services import extract_features_batch
        extract_result = extract_features_batch()
        print(f"Auto-extract completed: {extract_result}", flush=True)
        features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()

        if not features:
            return {"error": "No features found. Make sure masks are available."}

    # Check if GNN is available
    if not GNN_AVAILABLE:
        print("GNN dependencies not available", flush=True)
        print("Checking if masks contain embedded track IDs...", flush=True)
        print("="*50, flush=True)
        return run_tracking_from_mask_labels()

    # Try to find pretrained models for the given dataset name first
    metric_model_path = None
    tracking_model_path = None
    model_source = "unknown"

    if dataset_name:
        metric_model_path, tracking_model_path = get_pretrained_models_for_dataset(dataset_name)
        if metric_model_path and tracking_model_path:
            model_source = f"pretrained ({dataset_name})"
            print(f"Using pretrained models for dataset: {dataset_name}")
            print(f"  Metric model: {metric_model_path}")
            print(f"  Tracking model: {tracking_model_path}")

    # Fall back to default models if no pretrained match found
    if not metric_model_path or not tracking_model_path:
        metric_model_path = os.path.join(GNN_MODEL_PATH, 'all_params.pth')
        tracking_model_path = os.path.join(GNN_MODEL_PATH, 'gnn_tracking.ckpt')
        model_source = "default (local models)"
        print(f"Using default models from: {GNN_MODEL_PATH}")

    if not os.path.exists(metric_model_path) or not os.path.exists(tracking_model_path):
        print("GNN pretrained models not found!")
        print(f"Expected metric learning model at: {metric_model_path}")
        print(f"Expected tracking model at: {tracking_model_path}")
        print("Please train models using cell-tracker-gnn or copy pretrained models")
        print("Checking if masks contain embedded track IDs...")
        print("="*50)
        return run_tracking_from_mask_labels()

    try:
        result = _run_gnn_tracking_internal(metric_model_path, tracking_model_path)
        result["model_source"] = model_source
        if dataset_name:
            result["dataset_name"] = dataset_name
        print("="*50)
        return result
    except Exception as e:
        print(f"GNN tracking failed with error: {e}")
        print("Checking if masks contain embedded track IDs...")
        print("="*50)
        return run_tracking_from_mask_labels()


def _run_gnn_tracking_internal(metric_model_path, tracking_model_path):
    """
    Internal function to run GNN tracking pipeline

    The cell-tracker-gnn pipeline:
    1. Preprocess: Extract features using metric learning model
    2. Build graph: Create graph structure from cell features
    3. Inference: Run GNN model to predict edges (cell associations)
    4. Postprocess: Convert predictions to track assignments
    """
    import torch

    # Add cell-tracker-gnn to path
    if GNN_TRACKER_PATH not in sys.path:
        sys.path.insert(0, GNN_TRACKER_PATH)

    print(f"Loading metric learning model from: {metric_model_path}")
    print(f"Loading tracking model from: {tracking_model_path}")

    # Get images and masks paths
    images = ImageModel.query.order_by(ImageModel.id).all()
    if not images:
        return {"error": "No images found"}

    # Create temporary directory for GNN processing
    temp_dir = tempfile.mkdtemp(prefix='gnn_tracking_')
    print(f"Using temporary directory: {temp_dir}")

    try:
        # Prepare image and mask directories
        img_dir = os.path.join(temp_dir, 'images')
        seg_dir = os.path.join(temp_dir, 'segmentation')
        csv_dir = os.path.join(temp_dir, 'csv_output')
        os.makedirs(img_dir, exist_ok=True)
        os.makedirs(seg_dir, exist_ok=True)
        os.makedirs(csv_dir, exist_ok=True)

        # Copy/link images and masks with proper naming
        for i, img in enumerate(images):
            if img.filepath and os.path.exists(img.filepath):
                # Copy with standardized naming (t000.tif, t001.tif, etc.)
                ext = os.path.splitext(img.filepath)[1]
                dst_name = f"t{i:03d}{ext}"
                shutil.copy(img.filepath, os.path.join(img_dir, dst_name))

            if img.mask_filepath and os.path.exists(img.mask_filepath):
                ext = os.path.splitext(img.mask_filepath)[1]
                dst_name = f"man_seg{i:03d}{ext}"
                shutil.copy(img.mask_filepath, os.path.join(seg_dir, dst_name))

        # Step 1: Feature extraction using metric learning
        # Note: inference_clean.py expects folder structure: {csv_dir}/01_CSV/csv/
        # So we create csv output in {csv_dir}/01_CSV/
        print("Step 1: Extracting features using metric learning model...")
        from src.inference.preprocess_seq2graph_clean import create_csv

        # Create the expected folder structure for inference
        seq_csv_dir = os.path.join(csv_dir, '01_CSV')
        os.makedirs(seq_csv_dir, exist_ok=True)

        create_csv(
            input_images=img_dir,
            input_seg=seg_dir,
            input_model=metric_model_path,
            output_csv=seq_csv_dir,  # This will create 01_CSV/csv/ folder
            min_cell_size=20
        )

        # Step 2: Run GNN inference
        print("Step 2: Running GNN inference...")
        from src.inference.inference_clean import predict
        predict(
            ckpt_path=tracking_model_path,
            path_csv_output=csv_dir,  # inference will look for {csv_dir}/01_CSV/csv/
            num_seq='01'
        )

        # Step 3: Postprocess and update database
        print("Step 3: Processing tracking results...")
        result = _process_gnn_results(csv_dir)

        return result

    finally:
        # Cleanup temporary directory
        try:
            shutil.rmtree(temp_dir)
            print(f"Cleaned up temporary directory: {temp_dir}")
        except Exception as e:
            print(f"Warning: Failed to cleanup temp dir: {e}")


def _process_gnn_results(csv_dir):
    """
    Process GNN inference results and update database with track assignments.

    GNN outputs:
    - pytorch_geometric_data.pt: Graph data with edge_index
    - all_data_df.csv: DataFrame with cell info (frame_num, id, seg_label, features)
    - raw_output.pt: GNN edge predictions (probabilities for each edge)

    The edge_index defines pairs of cells that could be linked.
    The raw_output contains the predicted probability for each edge.
    We use these predictions to assign track IDs.
    """
    import torch
    import pandas as pd

    # Look for result files
    result_dir = None
    for d in os.listdir(csv_dir):
        if d.endswith('_RES_inference'):
            result_dir = os.path.join(csv_dir, d)
            break

    if not result_dir or not os.path.exists(result_dir):
        print("GNN results directory not found")
        return run_tracking_from_mask_labels()  # Fallback to mask labels

    # Load the dataframe with cell info
    df_path = os.path.join(result_dir, 'all_data_df.csv')
    graph_path = os.path.join(result_dir, 'pytorch_geometric_data.pt')
    output_path = os.path.join(result_dir, 'raw_output.pt')

    if not os.path.exists(df_path) or not os.path.exists(graph_path) or not os.path.exists(output_path):
        print("GNN results files not found")
        print(f"  df_path exists: {os.path.exists(df_path)}")
        print(f"  graph_path exists: {os.path.exists(graph_path)}")
        print(f"  output_path exists: {os.path.exists(output_path)}")
        return run_tracking_from_mask_labels()  # Fallback to mask labels

    # Load GNN outputs
    df = pd.read_csv(df_path)
    graph_data = torch.load(graph_path, weights_only=False)
    raw_output = torch.load(output_path, weights_only=False)

    print(f"Loaded GNN results:")
    print(f"  DataFrame: {len(df)} cells")
    print(f"  Edge index shape: {graph_data.edge_index.shape}")
    print(f"  Raw output shape: {raw_output.shape}")

    # Get edge predictions (apply sigmoid to get probabilities)
    edge_probs = torch.sigmoid(raw_output).squeeze().detach().cpu().numpy()
    edge_index = graph_data.edge_index.cpu().numpy()

    print(f"  Edge probabilities range: [{edge_probs.min():.4f}, {edge_probs.max():.4f}]")

    # Build mapping from df index to (frame_num, seg_label)
    # The df contains: frame_num, id (track id from GT), seg_label (cell label in mask), features...
    df_frame_nums = df['frame_num'].values
    df_seg_labels = df['seg_label'].values if 'seg_label' in df.columns else df['id'].values

    # Get unique frames
    unique_frames = sorted(df['frame_num'].unique())
    print(f"  Frames: {unique_frames}")

    # Build cell index mapping: df_index -> (frame_num, seg_label)
    cell_info = []
    for idx in range(len(df)):
        cell_info.append({
            'df_idx': idx,
            'frame_num': df_frame_nums[idx],
            'seg_label': df_seg_labels[idx]
        })

    # Extract edges between consecutive frames with high probability
    # edge_index[0] = source nodes, edge_index[1] = target nodes
    THRESHOLD = 0.5  # Probability threshold for edge acceptance

    # Build adjacency list for high-confidence edges between consecutive frames
    edges_by_frame = {}  # frame -> list of (src_seg_label, tgt_seg_label, prob)

    for edge_idx in range(edge_index.shape[1]):
        src_idx = edge_index[0, edge_idx]
        tgt_idx = edge_index[1, edge_idx]
        prob = edge_probs[edge_idx]

        src_frame = cell_info[src_idx]['frame_num']
        tgt_frame = cell_info[tgt_idx]['frame_num']

        # Only consider edges between consecutive frames (src -> tgt, src is earlier)
        if tgt_frame == src_frame + 1 and prob >= THRESHOLD:
            src_seg = cell_info[src_idx]['seg_label']
            tgt_seg = cell_info[tgt_idx]['seg_label']

            if src_frame not in edges_by_frame:
                edges_by_frame[src_frame] = []
            edges_by_frame[src_frame].append((src_seg, tgt_seg, prob))

    print(f"  High-confidence edges by frame: {[(f, len(e)) for f, e in edges_by_frame.items()]}")

    # Now update database with track assignments using GNN predictions
    features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()

    if not features:
        return {"error": "No features found in database"}

    # Group features by frame
    frames = {}
    for f in features:
        if f.frame_num not in frames:
            frames[f.frame_num] = {}
        frames[f.frame_num][f.cell_id] = f  # cell_id is the seg_label

    frame_nums = sorted(frames.keys())
    next_track_id = 1

    # First frame - assign new track IDs
    for cell_id, cell in frames[frame_nums[0]].items():
        cell.track_id = next_track_id
        next_track_id += 1

    # Process subsequent frames using GNN predictions
    for i in range(1, len(frame_nums)):
        prev_frame = frame_nums[i - 1]
        curr_frame = frame_nums[i]

        prev_cells = frames[prev_frame]
        curr_cells = frames[curr_frame]

        # Get GNN predicted edges for this frame transition
        gnn_edges = edges_by_frame.get(prev_frame, [])

        # Sort edges by probability (highest first)
        gnn_edges.sort(key=lambda x: x[2], reverse=True)

        # Track which cells have been assigned
        assigned_prev = set()
        assigned_curr = set()

        # Use GNN predictions to link cells
        for src_seg, tgt_seg, prob in gnn_edges:
            # Check if both cells exist and are not yet assigned
            if src_seg in prev_cells and tgt_seg in curr_cells:
                if src_seg not in assigned_prev and tgt_seg not in assigned_curr:
                    prev_cell = prev_cells[src_seg]
                    curr_cell = curr_cells[tgt_seg]

                    # Assign same track ID
                    curr_cell.track_id = prev_cell.track_id
                    assigned_prev.add(src_seg)
                    assigned_curr.add(tgt_seg)

                    # Compute motion features
                    if curr_cell.centroid_col is not None and prev_cell.centroid_col is not None:
                        curr_cell.delta_x = curr_cell.centroid_col - prev_cell.centroid_col
                        curr_cell.delta_y = curr_cell.centroid_row - prev_cell.centroid_row
                        curr_cell.displacement = np.sqrt(
                            curr_cell.delta_x ** 2 + curr_cell.delta_y ** 2
                        )
                        curr_cell.speed = curr_cell.displacement

                        # Compute turning angle if previous cell had motion
                        if prev_cell.delta_x is not None and prev_cell.delta_y is not None:
                            prev_angle = np.arctan2(prev_cell.delta_y, prev_cell.delta_x)
                            curr_angle = np.arctan2(curr_cell.delta_y, curr_cell.delta_x)
                            curr_cell.turning = curr_angle - prev_angle

        # Assign new track IDs to unassigned cells in current frame
        for cell_id, curr_cell in curr_cells.items():
            if cell_id not in assigned_curr:
                curr_cell.track_id = next_track_id
                next_track_id += 1

    db.session.commit()

    unique_tracks = db.session.query(CellFeature.track_id).distinct().count()

    print(f"GNN Tracking completed!")
    print(f"Total tracks: {unique_tracks}")
    print(f"Total cells: {len(features)}")
    print(f"Frames processed: {len(frame_nums)}")

    return {
        "message": "GNN Tracking completed",
        "method": "gnn",
        "total_tracks": unique_tracks,
        "total_cells": len(features),
        "frames_processed": len(frame_nums)
    }


def get_track_data(track_id):
    """Get all cells belonging to a specific track"""
    cells = CellFeature.query.filter_by(track_id=track_id).order_by(CellFeature.frame_num).all()
    return [c.to_dict() for c in cells]


def get_all_tracks():
    """Get summary of all tracks"""
    # Get unique track IDs with their cell counts and frame ranges
    from sqlalchemy import func

    tracks = db.session.query(
        CellFeature.track_id,
        func.count(CellFeature.id).label('cell_count'),
        func.min(CellFeature.frame_num).label('start_frame'),
        func.max(CellFeature.frame_num).label('end_frame')
    ).filter(
        CellFeature.track_id.isnot(None)
    ).group_by(
        CellFeature.track_id
    ).all()

    return [
        {
            "track_id": t.track_id,
            "cell_count": t.cell_count,
            "start_frame": t.start_frame,
            "end_frame": t.end_frame,
            "duration": t.end_frame - t.start_frame + 1
        }
        for t in tracks
    ]


def export_tracks_to_csv():
    """Export tracking results to CSV"""
    features = CellFeature.query.filter(
        CellFeature.track_id.isnot(None)
    ).order_by(
        CellFeature.track_id, CellFeature.frame_num
    ).all()

    output = StringIO()
    writer = csv.writer(output)

    header = [
        'track_id', 'frame_num', 'cell_id', 'image_id',
        'centroid_row', 'centroid_col', 'area',
        'delta_x', 'delta_y', 'displacement', 'speed', 'turning',
        'gmm_state', 'hmm_state'
    ]
    writer.writerow(header)

    for f in features:
        row = [
            f.track_id, f.frame_num, f.cell_id, f.image_id,
            f.centroid_row, f.centroid_col, f.area,
            f.delta_x, f.delta_y, f.displacement, f.speed, f.turning,
            f.gmm_state, f.hmm_state
        ]
        writer.writerow(row)

    return output.getvalue()


def export_for_cell_tracker_gnn(output_dir=None):
    """
    Export features in format compatible with cell-tracker-gnn

    Args:
        output_dir: Output directory (default: temp folder)

    Returns:
        dict with export info
    """
    import json
    import tempfile

    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix='cell_tracker_')

    os.makedirs(output_dir, exist_ok=True)

    # Get all features grouped by frame
    features = CellFeature.query.order_by(CellFeature.frame_num).all()

    frames_data = {}
    for f in features:
        frame_num = f.frame_num
        if frame_num not in frames_data:
            frames_data[frame_num] = []

        frames_data[frame_num].append({
            'cell_id': f.cell_id,
            'centroid': [f.centroid_row, f.centroid_col],
            'bbox': [f.min_row_bb, f.min_col_bb, f.max_row_bb, f.max_col_bb],
            'area': f.area,
            'features': {
                'major_axis_length': f.major_axis_length,
                'minor_axis_length': f.minor_axis_length,
                'eccentricity': f.eccentricity,
                'solidity': f.solidity,
                'mean_intensity': f.mean_intensity
            }
        })

    # Save as JSON files per frame
    for frame_num, cells in frames_data.items():
        frame_file = os.path.join(output_dir, f'frame_{frame_num:04d}.json')
        with open(frame_file, 'w') as f:
            json.dump(cells, f, indent=2)

    return {
        "output_dir": output_dir,
        "frames_exported": len(frames_data),
        "total_cells": len(features)
    }
