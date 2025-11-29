from flask import Blueprint, request, jsonify, send_from_directory, Response, current_app
from flask_cors import cross_origin
from app.services.image_services import (
    get_all_images,
    upload_cell_images,
    upload_mask_images,
    save_image,
    update_edited_image,
    update_mask_image,
    revert_image,
    delete_image,
    cleanup_folders,
    cleanup_database
)
from app.services.segmentation_services import (
    run_cellpose_segmentation,
    run_batch_segmentation
)
from app.services.feature_extraction_services import (
    extract_features_from_mask,
    extract_features_batch,
    get_features_by_image,
    get_all_features,
    export_features_to_csv
)
from app.services.tracking_services import (
    run_tracking,
    get_track_data,
    get_all_tracks,
    export_tracks_to_csv,
    export_for_cell_tracker_gnn
)
from app.services.clustering_services import (
    get_available_features,
    run_gmm_clustering,
    run_hmm_smoothing,
    run_full_clustering,
    get_clustering_results
)
from app import config
import os

image_bp = Blueprint('image_bp', __name__)

UPLOAD_FOLDER = config.UPLOAD_FOLDER
CONVERTED_FOLDER = config.CONVERTED_FOLDER
MASK_FOLDER = config.MASK_FOLDER
EDITED_FOLDER = config.EDITED_FOLDER

@image_bp.route('/uploads/<filename>')
@cross_origin() 
def get_origin_image(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    
@image_bp.route('/converted/<filename>')
@cross_origin() 
def get_converted_image(filename):
    try:
        return send_from_directory(CONVERTED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

@image_bp.route('/masks/<filename>')
@cross_origin()  
def get_mask_image(filename):
    try:
        return send_from_directory(MASK_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    
@image_bp.route('/edited/<filename>')
@cross_origin()
def get_edited_image(filename):
    try:
        return send_from_directory(EDITED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

@image_bp.route('/', methods=['GET'])
def get_images():
    images = get_all_images()
    return jsonify({"images": images}), 200

@image_bp.route('/upload-cells', methods=['POST'])
def upload_cells():
    if "images" not in request.files:
        return jsonify({"error": "No cell images uploaded"}), 400
    
    cell_images = request.files.getlist("images")
    uploaded_cells_info = upload_cell_images(cell_images)
    
    return jsonify({
        "message": "Cell images uploaded and processed successfully",
        "images": uploaded_cells_info
    }), 200

@image_bp.route('/upload-masks', methods=['POST'])
def upload_masks():
    if "masks" not in request.files:
        return jsonify({"error": "No mask images uploaded"}), 400
    
    mask_files = request.files.getlist("masks")
    uploaded_masks_info = upload_mask_images(mask_files)
    
    return jsonify({
        "message": "Mask images uploaded and processed successfully",
        "masks": uploaded_masks_info
    }), 200

@image_bp.route('/save', methods=['POST'])
@cross_origin()
def save_images():
    try:
        data = request.get_json()     
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        image_data = data.get('image_data')  
        image_url = data.get('image_url')    
        filename = data.get('filename')      
        
        if not image_data and not image_url:
            return jsonify({"error": "Either image_data or image_url must be provided"}), 400
        
        tiff_buffer = save_image(
            image_data=image_data,
            image_url=image_url,
            filename=filename
        )
        
        if filename:
            base_name = os.path.splitext(filename)[0]
            output_filename = f"{base_name}.tif"
        else:
            output_filename = "image.tif"

        return Response(
            tiff_buffer.read(),
            mimetype='image/tiff',
            headers={
                'Content-Disposition': f'attachment; filename="{output_filename}"',
                'Content-Type': 'image/tiff'
            }
        )
    
    except Exception as e:
        print(f"Error in save image: {str(e)}")
        return jsonify({"error": str(e)}), 500

@image_bp.route('/update/<int:image_id>', methods=['POST'])
@cross_origin()
def upload_edited_image(image_id):
    if "edited" not in request.files:
        return jsonify({"error": "No edited image uploaded"}), 400

    edited_image = request.files["edited"]
    try:
        info = update_edited_image(edited_image, image_id)
        return jsonify({
            "message": "Edited image saved successfully",
            "image": info
        }), 200
    except Exception as e:
        print(f"Error saving edited image: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@image_bp.route('/update-mask/<int:image_id>', methods=['POST'])
@cross_origin()
def upload_mask_image(image_id):
    if "mask" not in request.files:
        return jsonify({"error": "No mask image uploaded"}), 400

    mask_image = request.files["mask"]
    try:
        info = update_mask_image(mask_image, image_id)
        return jsonify({
            "message": "Mask image saved successfully",
            "image": info
        }), 200
    except Exception as e:
        print(f"Error saving mask image: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@image_bp.route('/revert/<int:image_id>', methods=['POST'])
@cross_origin()
def revert_single_image(image_id):
    try:
        info = revert_image(image_id)
        return jsonify({
            "message": "Image reverted successfully",
            "image": info,
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"Error reverting image {image_id}: {e}")
        return jsonify({"error": "Failed to revert image"}), 500
    
@image_bp.route('/delete/<int:image_id>', methods=['DELETE'])
@cross_origin()
def remove_image(image_id):
    try:
        info = delete_image(image_id)
        return jsonify({
            "message": "Image deleted successfully",
            "image": info,
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"Error deleting image {image_id}: {e}")
        return jsonify({"error": "Failed to delete image"}), 500


@image_bp.route('/reset', methods=['POST'])
@cross_origin()
def reset_dataset():
    try:
        cleanup_folders()
        cleanup_database(current_app)
        return jsonify({"message": "Dataset reset successfully"}), 200
    except Exception as e:
        print(f"Error resetting dataset: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/segmentation/<int:image_id>', methods=['POST'])
@cross_origin()
def segment_single_image(image_id):
    """Chạy Cellpose segmentation cho một ảnh"""
    try:
        result = run_cellpose_segmentation(image_id)
        return jsonify({
            "message": "Segmentation completed successfully",
            "result": result
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"Error in segmentation for image {image_id}: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/segmentation/batch', methods=['POST'])
@cross_origin()
def segment_batch_images():
    """Chạy Cellpose segmentation cho nhiều ảnh hoặc tất cả ảnh chưa có mask"""
    try:
        data = request.get_json()
        image_ids = data.get('image_ids') if data else None

        result = run_batch_segmentation(image_ids)
        return jsonify({
            "message": "Batch segmentation completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error in batch segmentation: {e}")
        return jsonify({"error": str(e)}), 500


# ============ Cell Features Routes ============

@image_bp.route('/features', methods=['GET'])
@cross_origin()
def get_features():
    """Get all cell features"""
    try:
        features = get_all_features()
        return jsonify({
            "features": features,
            "total": len(features)
        }), 200
    except Exception as e:
        print(f"Error getting features: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/features/<int:image_id>', methods=['GET'])
@cross_origin()
def get_image_features(image_id):
    """Get cell features for a specific image"""
    try:
        features = get_features_by_image(image_id)
        return jsonify({
            "image_id": image_id,
            "features": features,
            "num_cells": len(features)
        }), 200
    except Exception as e:
        print(f"Error getting features for image {image_id}: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/features/extract/<int:image_id>', methods=['POST'])
@cross_origin()
def extract_image_features(image_id):
    """Extract features from mask for a single image"""
    try:
        features = extract_features_from_mask(image_id)
        return jsonify({
            "message": "Feature extraction completed",
            "image_id": image_id,
            "features": features,
            "num_cells": len(features)
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"Error extracting features for image {image_id}: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/features/extract/batch', methods=['POST'])
@cross_origin()
def extract_batch_features():
    """Extract features for multiple images or all images with masks"""
    try:
        data = request.get_json()
        image_ids = data.get('image_ids') if data else None

        result = extract_features_batch(image_ids)
        return jsonify({
            "message": "Batch feature extraction completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error in batch feature extraction: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/features/export', methods=['GET'])
@cross_origin()
def export_features():
    """Export all features to CSV"""
    try:
        csv_data = export_features_to_csv()
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={
                'Content-Disposition': 'attachment; filename="cell_features.csv"'
            }
        )
    except Exception as e:
        print(f"Error exporting features: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/features/export/<int:image_id>', methods=['GET'])
@cross_origin()
def export_image_features(image_id):
    """Export features for a specific image to CSV"""
    try:
        csv_data = export_features_to_csv(image_id)
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename="cell_features_frame_{image_id}.csv"'
            }
        )
    except Exception as e:
        print(f"Error exporting features for image {image_id}: {e}")
        return jsonify({"error": str(e)}), 500


# ============ Cell Tracking Routes ============

@image_bp.route('/tracking/run-gnn', methods=['POST'])
@cross_origin()
def run_gnn_tracking():
    """Run GNN-based cell tracking using cell-tracker-gnn"""
    try:
        from app.services.tracking_services import run_gnn_tracking as gnn_track
        result = gnn_track()
        return jsonify({
            "message": "GNN tracking completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error in GNN tracking: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/tracking/tracks', methods=['GET'])
@cross_origin()
def get_tracks():
    """Get all track summaries"""
    try:
        tracks = get_all_tracks()
        return jsonify({
            "tracks": tracks,
            "total": len(tracks)
        }), 200
    except Exception as e:
        print(f"Error getting tracks: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/tracking/tracks/<int:track_id>', methods=['GET'])
@cross_origin()
def get_single_track(track_id):
    """Get all cells for a specific track"""
    try:
        cells = get_track_data(track_id)
        return jsonify({
            "track_id": track_id,
            "cells": cells,
            "length": len(cells)
        }), 200
    except Exception as e:
        print(f"Error getting track {track_id}: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/tracking/export', methods=['GET'])
@cross_origin()
def export_tracking_csv():
    """Export tracking results to CSV"""
    try:
        csv_data = export_tracks_to_csv()
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={
                'Content-Disposition': 'attachment; filename="cell_tracks.csv"'
            }
        )
    except Exception as e:
        print(f"Error exporting tracks: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/tracking/export-gnn', methods=['POST'])
@cross_origin()
def export_for_gnn():
    """Export features in cell-tracker-gnn compatible format"""
    try:
        data = request.get_json() or {}
        output_dir = data.get('output_dir')

        result = export_for_cell_tracker_gnn(output_dir)
        return jsonify({
            "message": "Export completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error exporting for GNN: {e}")
        return jsonify({"error": str(e)}), 500


# ============ Cell Clustering Routes ============

@image_bp.route('/clustering/features', methods=['GET'])
@cross_origin()
def get_clustering_features():
    """Get list of available features for clustering"""
    try:
        features = get_available_features()
        return jsonify({
            "features": features
        }), 200
    except Exception as e:
        print(f"Error getting clustering features: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/clustering/run', methods=['POST'])
@cross_origin()
def run_clustering():
    """Run full clustering pipeline (GMM + HMM)"""
    try:
        data = request.get_json() or {}
        selected_features = data.get('features', [
            'area', 'major_axis_length', 'minor_axis_length', 'aspect_ratio', 'circularity',
            'eccentricity', 'solidity', 'extent',
            'mean_intensity', 'max_intensity', 'min_intensity',
            'intensity_ratio_max_mean', 'intensity_ratio_mean_min', 'displacement'
        ])
        max_components = data.get('max_components', 10)
        min_components = data.get('min_components', 2)

        result = run_full_clustering(selected_features, max_components, min_components)
        return jsonify({
            "message": "Clustering completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error in clustering: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/clustering/gmm', methods=['POST'])
@cross_origin()
def run_gmm_only():
    """Run GMM clustering only"""
    try:
        data = request.get_json() or {}
        selected_features = data.get('features', [])
        if not selected_features:
            return jsonify({"error": "No features selected"}), 400

        max_components = data.get('max_components', 10)
        min_components = data.get('min_components', 2)

        result = run_gmm_clustering(selected_features, max_components, min_components)
        return jsonify({
            "message": "GMM clustering completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error in GMM clustering: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/clustering/hmm', methods=['POST'])
@cross_origin()
def run_hmm_only():
    """Run HMM smoothing on existing GMM clusters"""
    try:
        data = request.get_json() or {}
        n_states = data.get('n_states')

        result = run_hmm_smoothing(n_states)
        return jsonify({
            "message": "HMM smoothing completed",
            "result": result
        }), 200
    except Exception as e:
        print(f"Error in HMM smoothing: {e}")
        return jsonify({"error": str(e)}), 500


@image_bp.route('/clustering/results', methods=['GET'])
@cross_origin()
def get_cluster_results():
    """Get current clustering results summary"""
    try:
        result = get_clustering_results()
        return jsonify(result), 200
    except Exception as e:
        print(f"Error getting clustering results: {e}")
        return jsonify({"error": str(e)}), 500