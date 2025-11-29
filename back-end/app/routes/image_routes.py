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