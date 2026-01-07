"""
Segmentation Services - Cellpose segmentation for cell images
"""
import os
import numpy as np
from PIL import Image
from flask import url_for
from app import db, config
from app.models import Image as ImageModel

MASK_FOLDER = config.MASK_FOLDER
CONVERTED_FOLDER = config.CONVERTED_FOLDER


def run_cellpose_segmentation(image_id, diameter=None, flow_threshold=0.4, cellprob_threshold=0.0):
    """
    Run Cellpose segmentation on a single image (Cellpose v4.0.1+ API)

    Args:
        image_id: Database ID of the image
        diameter: Expected cell diameter (None for auto-detection)
        flow_threshold: Flow error threshold
        cellprob_threshold: Cell probability threshold

    Returns:
        dict with segmentation results
    """
    from cellpose import models

    img_record = ImageModel.query.get(image_id)
    if not img_record:
        raise ValueError(f"Image with id {image_id} not found")

    session_id = img_record.session_id

    # Get the image path (use edited if available, else converted)
    if img_record.edited_filepath and os.path.exists(img_record.edited_filepath):
        image_path = img_record.edited_filepath
    elif img_record.filepath and os.path.exists(img_record.filepath):
        image_path = img_record.filepath
    else:
        # Try converted folder
        if img_record.filename:
            converted_name = os.path.splitext(img_record.filename)[0] + '.png'
            image_path = os.path.join(CONVERTED_FOLDER, converted_name)
            if not os.path.exists(image_path):
                raise ValueError(f"No image file found for image id {image_id}")
        else:
            raise ValueError(f"No image file found for image id {image_id}")

    # Load image
    img = Image.open(image_path)
    img_array = np.array(img)

    # Save mask with original image extension (TIF, PNG, etc.)
    # Route will convert TIF to PNG on-the-fly for browser display
    original_ext = os.path.splitext(img_record.filename)[1].lower() if img_record.filename else '.png'
    if original_ext not in ['.png', '.jpg', '.jpeg', '.tif', '.tiff']:
        original_ext = '.png'
    mask_ext = original_ext

    # Convert to grayscale if needed
    if len(img_array.shape) == 3:
        img_array = np.mean(img_array, axis=2)

    # Run Cellpose (v4.0.1+ API - no model_type, no channels)
    model = models.CellposeModel(gpu=False)
    masks, flows, styles = model.eval(
        img_array,
        diameter=diameter,
        flow_threshold=flow_threshold,
        cellprob_threshold=cellprob_threshold
    )

    # Save mask to session folder with original format
    stem = os.path.splitext(img_record.filename)[0] if img_record.filename else f"image_{image_id}"
    mask_filename = f"{stem}_mask{mask_ext}"

    # Create session mask folder if not exists
    session_mask_folder = os.path.join(MASK_FOLDER, session_id) if session_id else MASK_FOLDER
    os.makedirs(session_mask_folder, exist_ok=True)
    mask_path = os.path.join(session_mask_folder, mask_filename)

    print(f"[DEBUG] Saving mask to: {mask_path}")
    print(f"[DEBUG] Session ID: {session_id}")
    print(f"[DEBUG] Mask filename: {mask_filename}")

    # Convert mask to colored visualization and save
    colored_mask = create_colored_mask(masks)
    Image.fromarray(colored_mask).save(mask_path)

    # Verify file was saved
    if os.path.exists(mask_path):
        print(f"[DEBUG] Mask saved successfully: {mask_path}")
    else:
        print(f"[ERROR] Failed to save mask: {mask_path}")

    # Update database
    img_record.mask_filename = mask_filename
    img_record.mask_filepath = mask_path
    db.session.commit()

    # Count cells
    num_cells = len(np.unique(masks)) - 1  # Exclude background (0)

    # Use correct route with session_id
    if session_id:
        mask_url = url_for('image_bp.get_mask_image_session', session_id=session_id, filename=mask_filename, _external=True)
    else:
        mask_url = url_for('image_bp.get_mask_image', filename=mask_filename, _external=True)

    print(f"[DEBUG] Mask URL: {mask_url}")

    return {
        "image_id": image_id,
        "mask_filename": mask_filename,
        "mask_url": mask_url,
        "num_cells": num_cells,
        "diameter": diameter
    }


def run_batch_segmentation(image_ids=None, diameter=None):
    """
    Run Cellpose segmentation on multiple images (Cellpose v4.0.1+ API)

    Args:
        image_ids: List of image IDs (None = all images without masks)
        diameter: Expected cell diameter

    Returns:
        dict with batch results
    """
    if image_ids is None:
        # Get all images without masks
        images = ImageModel.query.filter(
            ImageModel.filename.isnot(None),
            ImageModel.mask_filename.is_(None)
        ).all()
        image_ids = [img.id for img in images]

    results = []
    errors = []

    for img_id in image_ids:
        try:
            result = run_cellpose_segmentation(img_id, diameter=diameter)
            results.append(result)
        except Exception as e:
            errors.append({"image_id": img_id, "error": str(e)})

    return {
        "processed": len(results),
        "errors": len(errors),
        "results": results,
        "error_details": errors
    }


def create_colored_mask(masks):
    """
    Create a colored visualization of segmentation masks

    Args:
        masks: 2D numpy array with cell labels

    Returns:
        RGB numpy array with colored cells
    """
    np.random.seed(42)

    unique_labels = np.unique(masks)
    colored = np.zeros((*masks.shape, 3), dtype=np.uint8)

    for label in unique_labels:
        if label == 0:  # Background
            continue
        color = np.random.randint(50, 255, 3)
        colored[masks == label] = color

    return colored


def get_cell_contours(image_id):
    """
    Get cell contours from mask for visualization

    Args:
        image_id: Database ID of the image

    Returns:
        List of cell contours with cell_id and polygon points
    """
    import cv2
    from app.models import CellFeature

    img_record = ImageModel.query.get(image_id)
    if not img_record or not img_record.mask_filepath:
        return []

    if not os.path.exists(img_record.mask_filepath):
        return []

    # Load the colored mask and convert to label mask
    mask_img = Image.open(img_record.mask_filepath)
    mask_array = np.array(mask_img)

    # If colored (RGB), we need to get cell features to map
    # Load original grayscale mask if available, or use cell features
    features = CellFeature.query.filter_by(image_id=image_id).all()
    if not features:
        return []

    contours_data = []

    for feature in features:
        # Create a mask for this specific cell based on bounding box and centroid
        cell_id = feature.cell_id
        min_row = int(feature.min_row_bb) if feature.min_row_bb else 0
        max_row = int(feature.max_row_bb) if feature.max_row_bb else mask_array.shape[0]
        min_col = int(feature.min_col_bb) if feature.min_col_bb else 0
        max_col = int(feature.max_col_bb) if feature.max_col_bb else mask_array.shape[1]

        # Extract the region
        if len(mask_array.shape) == 3:
            region = mask_array[min_row:max_row, min_col:max_col]
            # Convert to grayscale for contour detection
            region_gray = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY)
        else:
            region_gray = mask_array[min_row:max_row, min_col:max_col]

        # Threshold to get binary mask
        _, binary = cv2.threshold(region_gray, 10, 255, cv2.THRESH_BINARY)

        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            # Get the largest contour
            largest_contour = max(contours, key=cv2.contourArea)

            # Simplify contour for efficiency
            epsilon = 0.01 * cv2.arcLength(largest_contour, True)
            simplified = cv2.approxPolyDP(largest_contour, epsilon, True)

            # Convert to list of points and offset by bounding box position
            points = []
            for point in simplified:
                x = int(point[0][0] + min_col)
                y = int(point[0][1] + min_row)
                points.append([x, y])

            if len(points) >= 3:  # Need at least 3 points for a polygon
                contours_data.append({
                    'cell_id': cell_id,
                    'feature_id': feature.id,
                    'gmm_state': feature.gmm_state,
                    'hmm_state': feature.hmm_state,
                    'contour': points
                })

    return contours_data
