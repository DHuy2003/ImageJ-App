"""
Clustering Services - GMM + HMM clustering for cell state classification
"""
import numpy as np
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from hmmlearn import hmm
from app import db
from app.models import CellFeature


# Default features for clustering
DEFAULT_FEATURES = [
    'area', 'major_axis_length', 'minor_axis_length', 'aspect_ratio', 'circularity',
    'eccentricity', 'solidity', 'extent',
    'mean_intensity', 'max_intensity', 'min_intensity',
    'intensity_ratio_max_mean', 'intensity_ratio_mean_min', 'displacement'
]


def get_available_features():
    """Get list of available features for clustering"""
    return [
        {'name': 'area', 'description': 'Cell area in pixels'},
        {'name': 'major_axis_length', 'description': 'Length of major axis'},
        {'name': 'minor_axis_length', 'description': 'Length of minor axis'},
        {'name': 'aspect_ratio', 'description': 'Major/Minor axis ratio'},
        {'name': 'circularity', 'description': 'Shape circularity (4*pi*area/perimeter^2)'},
        {'name': 'eccentricity', 'description': 'Ellipse eccentricity'},
        {'name': 'solidity', 'description': 'Area/Convex area ratio'},
        {'name': 'extent', 'description': 'Area/Bounding box area'},
        {'name': 'perimeter', 'description': 'Cell perimeter'},
        {'name': 'convex_area', 'description': 'Convex hull area'},
        {'name': 'convexity_deficit', 'description': '(Convex area - area)/Convex area'},
        {'name': 'mean_intensity', 'description': 'Mean pixel intensity'},
        {'name': 'max_intensity', 'description': 'Maximum pixel intensity'},
        {'name': 'min_intensity', 'description': 'Minimum pixel intensity'},
        {'name': 'intensity_ratio_max_mean', 'description': 'Max/Mean intensity ratio'},
        {'name': 'intensity_ratio_mean_min', 'description': 'Mean/Min intensity ratio'},
        {'name': 'displacement', 'description': 'Movement from previous frame'},
        {'name': 'speed', 'description': 'Movement speed'},
        {'name': 'turning', 'description': 'Turning angle'},
        {'name': 'delta_x', 'description': 'X displacement'},
        {'name': 'delta_y', 'description': 'Y displacement'}
    ]


def run_gmm_clustering(selected_features=None, max_components=10, min_components=2):
    """
    Run GMM clustering on cell features

    Args:
        selected_features: List of feature names to use
        max_components: Maximum number of GMM components to try
        min_components: Minimum number of GMM components

    Returns:
        dict with clustering results
    """
    if selected_features is None:
        selected_features = DEFAULT_FEATURES

    # Get all features with track_id (only tracked cells)
    cells = CellFeature.query.filter(CellFeature.track_id.isnot(None)).all()

    if len(cells) < min_components:
        return {"error": f"Not enough cells for clustering. Need at least {min_components}, got {len(cells)}"}

    # Extract feature matrix
    feature_matrix = []
    cell_ids = []

    for cell in cells:
        row = []
        valid = True
        for feat_name in selected_features:
            val = getattr(cell, feat_name, None)
            if val is None:
                valid = False
                break
            row.append(val)

        if valid:
            feature_matrix.append(row)
            cell_ids.append(cell.id)

    if len(feature_matrix) < min_components:
        return {"error": f"Not enough cells with valid features. Need {min_components}, got {len(feature_matrix)}"}

    X = np.array(feature_matrix)

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Handle NaN/Inf
    X_scaled = np.nan_to_num(X_scaled, nan=0.0, posinf=0.0, neginf=0.0)

    # Find optimal number of components using BIC
    best_bic = np.inf
    best_n = min_components
    bic_scores = []

    for n in range(min_components, min(max_components + 1, len(feature_matrix))):
        try:
            gmm = GaussianMixture(n_components=n, covariance_type='full', random_state=42, n_init=3)
            gmm.fit(X_scaled)
            bic = gmm.bic(X_scaled)
            bic_scores.append({'n_components': n, 'bic': bic})
            if bic < best_bic:
                best_bic = bic
                best_n = n
        except Exception as e:
            print(f"GMM failed for n={n}: {e}")
            continue

    # Fit final model with optimal components
    final_gmm = GaussianMixture(n_components=best_n, covariance_type='full', random_state=42, n_init=3)
    final_gmm.fit(X_scaled)
    labels = final_gmm.predict(X_scaled)
    probabilities = final_gmm.predict_proba(X_scaled)

    # Update database
    for i, cell_id in enumerate(cell_ids):
        cell = CellFeature.query.get(cell_id)
        if cell:
            cell.gmm_state = int(labels[i])

    db.session.commit()

    # Compute cluster statistics
    cluster_stats = []
    for c in range(best_n):
        mask = labels == c
        cluster_stats.append({
            'cluster_id': c,
            'count': int(np.sum(mask)),
            'percentage': float(np.sum(mask) / len(labels) * 100)
        })

    return {
        "optimal_components": best_n,
        "best_bic": float(best_bic),
        "bic_scores": bic_scores,
        "total_cells": len(cell_ids),
        "cluster_stats": cluster_stats,
        "features_used": selected_features
    }


def run_hmm_smoothing(n_states=None):
    """
    Run HMM smoothing on GMM cluster assignments along tracks

    Args:
        n_states: Number of HMM states (default: use GMM n_components)

    Returns:
        dict with HMM results
    """
    # Get unique GMM states to determine n_states
    gmm_states = db.session.query(CellFeature.gmm_state).filter(
        CellFeature.gmm_state.isnot(None)
    ).distinct().all()

    if not gmm_states:
        return {"error": "No GMM states found. Run GMM clustering first."}

    unique_states = [s[0] for s in gmm_states]
    if n_states is None:
        n_states = len(unique_states)

    # Get all tracks
    tracks = db.session.query(CellFeature.track_id).filter(
        CellFeature.track_id.isnot(None),
        CellFeature.gmm_state.isnot(None)
    ).distinct().all()

    if not tracks:
        return {"error": "No tracked cells with GMM states found"}

    # Prepare sequences for HMM
    sequences = []
    lengths = []
    track_cell_mapping = []  # [(track_id, [cell_ids]), ...]

    for (track_id,) in tracks:
        cells = CellFeature.query.filter_by(track_id=track_id).filter(
            CellFeature.gmm_state.isnot(None)
        ).order_by(CellFeature.frame_num).all()

        if len(cells) >= 2:  # Need at least 2 observations
            seq = [[c.gmm_state] for c in cells]
            sequences.extend(seq)
            lengths.append(len(cells))
            track_cell_mapping.append((track_id, [c.id for c in cells]))

    if not sequences:
        return {"error": "Not enough sequence data for HMM"}

    X = np.array(sequences)

    # Fit HMM
    model = hmm.CategoricalHMM(n_components=n_states, n_iter=100, random_state=42)
    model.n_features = len(unique_states)

    try:
        model.fit(X, lengths)
    except Exception as e:
        return {"error": f"HMM fitting failed: {str(e)}"}

    # Predict states for each track
    total_updated = 0
    idx = 0
    for track_id, cell_ids in track_cell_mapping:
        length = len(cell_ids)
        track_seq = X[idx:idx + length]
        try:
            hmm_states = model.predict(track_seq)
            for i, cell_id in enumerate(cell_ids):
                cell = CellFeature.query.get(cell_id)
                if cell:
                    cell.hmm_state = int(hmm_states[i])
                    total_updated += 1
        except Exception as e:
            print(f"HMM prediction failed for track {track_id}: {e}")
        idx += length

    db.session.commit()

    # Compute state statistics
    state_stats = []
    for s in range(n_states):
        count = CellFeature.query.filter_by(hmm_state=s).count()
        state_stats.append({
            'state_id': s,
            'count': count
        })

    return {
        "n_states": n_states,
        "tracks_processed": len(track_cell_mapping),
        "cells_updated": total_updated,
        "state_stats": state_stats,
        "transition_matrix": model.transmat_.tolist() if hasattr(model, 'transmat_') else None
    }


def run_full_clustering(selected_features=None, max_components=10, min_components=2, n_components=None, use_hmm=True):
    """
    Run complete clustering pipeline: GMM + HMM

    Args:
        selected_features: Features for GMM
        max_components: Max GMM components
        min_components: Min GMM components
        n_components: Fixed number of components (overrides min/max when provided)
        use_hmm: Whether to run HMM smoothing after GMM

    Returns:
        dict with full results
    """
    # Allow caller to pin a fixed number of clusters
    if n_components:
        max_components = n_components
        min_components = n_components

    # Run GMM
    gmm_result = run_gmm_clustering(selected_features, max_components, min_components)

    if "error" in gmm_result:
        return gmm_result

    result = {
        "gmm": gmm_result,
        "hmm": None,
        "pipeline": "complete" if use_hmm else "gmm_only"
    }

    if not use_hmm:
        return result

    # Run HMM with same number of states as GMM clusters
    hmm_result = run_hmm_smoothing(n_states=gmm_result['optimal_components'])
    result["hmm"] = hmm_result

    if "error" in hmm_result:
        result["error"] = hmm_result["error"]
        return result

    return result


def get_clustering_results():
    """Get current clustering results summary"""
    # GMM statistics
    gmm_states = db.session.query(
        CellFeature.gmm_state,
        db.func.count(CellFeature.id)
    ).filter(
        CellFeature.gmm_state.isnot(None)
    ).group_by(CellFeature.gmm_state).all()

    # HMM statistics
    hmm_states = db.session.query(
        CellFeature.hmm_state,
        db.func.count(CellFeature.id)
    ).filter(
        CellFeature.hmm_state.isnot(None)
    ).group_by(CellFeature.hmm_state).all()

    # Per-frame clustering results
    frame_results = db.session.query(
        CellFeature.frame_num,
        CellFeature.gmm_state,
        CellFeature.hmm_state,
        db.func.count(CellFeature.id)
    ).filter(
        CellFeature.gmm_state.isnot(None)
    ).group_by(
        CellFeature.frame_num, CellFeature.gmm_state, CellFeature.hmm_state
    ).all()

    # Format frame results
    frames_data = {}
    for frame_num, gmm_state, hmm_state, count in frame_results:
        if frame_num not in frames_data:
            frames_data[frame_num] = []
        frames_data[frame_num].append({
            'gmm_state': gmm_state,
            'hmm_state': hmm_state,
            'count': count
        })

    return {
        "gmm_distribution": [{'state': s, 'count': c} for s, c in gmm_states],
        "hmm_distribution": [{'state': s, 'count': c} for s, c in hmm_states],
        "total_gmm_clustered": sum(c for _, c in gmm_states),
        "total_hmm_smoothed": sum(c for _, c in hmm_states),
        "frames": frames_data
    }
