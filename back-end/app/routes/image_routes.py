from flask import Blueprint, request, jsonify, send_from_directory
from app.services.image_services import convert_tiff_to_png
import os

image_bp = Blueprint('image_bp', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(BASE_DIR))
CONVERTED_FOLDER = os.path.join(BACKEND_DIR, 'converted')

@image_bp.route('/upload', methods=['POST'])
def upload_image():
    if "images" not in request.files:
        return jsonify({"error": "No images uploaded"}), 400
    
    images = request.files.getlist("images")

    converted_images = convert_tiff_to_png(images)

    return jsonify({
        "message": "Upload successfully",
        "images": converted_images
    }), 200

@image_bp.route('/converted/<filename>')
def get_converted_image(filename):
    try:
        return send_from_directory(CONVERTED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404