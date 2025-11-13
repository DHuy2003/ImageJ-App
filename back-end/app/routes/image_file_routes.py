from flask import Blueprint, request, jsonify, send_from_directory, Response
from flask_cors import cross_origin
from app.services.image_file_services import get_all_images, upload_cell_images, upload_mask_images, save_image
import os
from app import config

image_file_bp = Blueprint('image_file_bp', __name__)

CONVERTED_FOLDER = config.CONVERTED_FOLDER
MASK_FOLDER = config.MASK_FOLDER

@image_file_bp.route('/converted/<filename>')
@cross_origin() 
def get_converted_image(filename):
    try:
        return send_from_directory(CONVERTED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

@image_file_bp.route('/masks/<filename>')
@cross_origin()  
def get_mask_image(filename):
    try:
        return send_from_directory(MASK_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

@image_file_bp.route('/', methods=['GET'])
def get_images():
    images = get_all_images()
    return jsonify({"images": images}), 200

@image_file_bp.route('/upload-cells', methods=['POST'])
def upload_cells():
    if "images" not in request.files:
        return jsonify({"error": "No cell images uploaded"}), 400
    
    cell_images = request.files.getlist("images")
    uploaded_cells_info = upload_cell_images(cell_images)
    
    return jsonify({
        "message": "Cell images uploaded and processed successfully",
        "images": uploaded_cells_info
    }), 200

@image_file_bp.route('/upload-masks', methods=['POST'])
def upload_masks():
    if "masks" not in request.files:
        return jsonify({"error": "No mask images uploaded"}), 400
    
    mask_files = request.files.getlist("masks")
    uploaded_masks_info = upload_mask_images(mask_files)
    
    return jsonify({
        "message": "Mask images uploaded and processed successfully",
        "masks": uploaded_masks_info
    }), 200

@image_file_bp.route('/save', methods=['POST'])
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
