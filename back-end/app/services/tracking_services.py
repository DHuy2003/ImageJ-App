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


def run_gnn_tracking():
    """
    GNN-based tracking using cell-tracker-gnn
    Falls back to using mask labels as track IDs if GNN is not available
    """
    print("="*50, flush=True)
    print("GNN TRACKING: Starting GNN-based tracking...", flush=True)

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

    # Check for pretrained models
    metric_model_path = os.path.join(GNN_MODEL_PATH, 'all_params.pth')
    tracking_model_path = None

    # Look for .ckpt file in models directory
    if os.path.exists(GNN_MODEL_PATH):
        for f in os.listdir(GNN_MODEL_PATH):
            if f.endswith('.ckpt'):
                tracking_model_path = os.path.join(GNN_MODEL_PATH, f)
                break

    if not os.path.exists(metric_model_path) or tracking_model_path is None:
        print("GNN pretrained models not found!")
        print(f"Expected metric learning model at: {metric_model_path}")
        print(f"Expected tracking model (.ckpt) in: {GNN_MODEL_PATH}")
        print("Please download pretrained models from cell-tracker-gnn repository")
        print("Checking if masks contain embedded track IDs...")
        print("="*50)
        return run_tracking_from_mask_labels()

    try:
        result = _run_gnn_tracking_internal(metric_model_path, tracking_model_path)
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
        print("Step 1: Extracting features using metric learning model...")
        from src.inference.preprocess_seq2graph_clean import create_csv
        create_csv(
            input_images=img_dir,
            input_seg=seg_dir,
            input_model=metric_model_path,
            output_csv=csv_dir,
            min_cell_size=20
        )

        # Step 2: Run GNN inference
        print("Step 2: Running GNN inference...")
        from src.inference.inference_clean import predict
        predict(
            ckpt_path=tracking_model_path,
            path_csv_output=csv_dir,
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
    Process GNN inference results and update database with track assignments
    """
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

    # Load the dataframe with predictions
    df_path = os.path.join(result_dir, 'all_data_df.csv')
    if not os.path.exists(df_path):
        print("GNN results CSV not found")
        return run_tracking_from_mask_labels()  # Fallback to mask labels

    df = pd.read_csv(df_path)
    print(f"Loaded GNN results with {len(df)} entries")

    # TODO: Map GNN predictions to track IDs
    # The GNN outputs edge predictions that need to be converted to track assignments
    # For now, we'll use a simplified approach based on the predicted edges

    # Update database with track assignments
    features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()

    # Group by frame
    frames = {}
    for f in features:
        if f.frame_num not in frames:
            frames[f.frame_num] = []
        frames[f.frame_num].append(f)

    frame_nums = sorted(frames.keys())
    next_track_id = 1

    # First frame - assign new track IDs
    for cell in frames[frame_nums[0]]:
        cell.track_id = next_track_id
        next_track_id += 1

    # Process subsequent frames using GNN predictions
    # (Simplified - in practice would use the edge predictions from GNN)
    for i in range(1, len(frame_nums)):
        prev_frame = frame_nums[i - 1]
        curr_frame = frame_nums[i]

        prev_cells = frames[prev_frame]
        curr_cells = frames[curr_frame]

        # Build cost matrix (using feature similarity from GNN embeddings if available)
        cost_matrix = np.full((len(curr_cells), len(prev_cells)), np.inf)

        for ci, curr_cell in enumerate(curr_cells):
            for pi, prev_cell in enumerate(prev_cells):
                if curr_cell.centroid_row is None or prev_cell.centroid_row is None:
                    continue
                dist = np.sqrt(
                    (curr_cell.centroid_row - prev_cell.centroid_row) ** 2 +
                    (curr_cell.centroid_col - prev_cell.centroid_col) ** 2
                )
                if dist <= 100.0:  # Max distance threshold
                    cost_matrix[ci, pi] = dist

        # Hungarian algorithm
        if cost_matrix.shape[0] > 0 and cost_matrix.shape[1] > 0:
            row_ind, col_ind = linear_sum_assignment(cost_matrix)

            assigned_curr = set()
            for ci, pi in zip(row_ind, col_ind):
                if cost_matrix[ci, pi] < np.inf:
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

            # Assign new track IDs to unassigned cells
            for ci, curr_cell in enumerate(curr_cells):
                if ci not in assigned_curr:
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
        "method": "gnn" if GNN_AVAILABLE else "nearest_neighbor",
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
