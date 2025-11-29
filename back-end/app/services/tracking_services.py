"""
Tracking Services - Cell tracking across frames
"""
import os
import numpy as np
import csv
from io import StringIO
from scipy.optimize import linear_sum_assignment
from app import db, config
from app.models import Image as ImageModel, CellFeature


def run_tracking(max_distance=100.0):
    """
    Run simple nearest-neighbor cell tracking based on centroid distance

    Args:
        max_distance: Maximum distance threshold for linking cells

    Returns:
        dict with tracking results
    """
    # Get all features ordered by frame
    features = CellFeature.query.order_by(CellFeature.frame_num, CellFeature.cell_id).all()

    if not features:
        return {"error": "No features found. Run feature extraction first."}

    # Group by frame
    frames = {}
    for f in features:
        if f.frame_num not in frames:
            frames[f.frame_num] = []
        frames[f.frame_num].append(f)

    frame_nums = sorted(frames.keys())
    if len(frame_nums) < 2:
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

    return {
        "message": "Tracking completed",
        "total_tracks": unique_tracks,
        "total_cells": len(features),
        "frames_processed": len(frame_nums)
    }


def run_gnn_tracking():
    """
    Placeholder for GNN-based tracking (cell-tracker-gnn integration)
    Currently falls back to simple nearest-neighbor tracking
    """
    return run_tracking()


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
