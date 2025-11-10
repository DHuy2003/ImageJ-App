from flask import Blueprint, request, jsonify, send_from_directory
from flask_cors import cross_origin
from app.services.image_file_services import get_all_images, upload_cell_images, upload_mask_images
import os

image_file_bp = Blueprint('image_file_bp', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(BASE_DIR))
CONVERTED_FOLDER = os.path.join(BACKEND_DIR, 'converted')
MASK_FOLDER = os.path.join(BACKEND_DIR, 'masks')

@image_file_bp.route('/converted/<filename>')
@cross_origin()  # đảm bảo header CORS trên file ảnh
def get_converted_image(filename):
    try:
        return send_from_directory(CONVERTED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

@image_file_bp.route('/masks/<filename>')
@cross_origin()  # đảm bảo header CORS trên file mask
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
