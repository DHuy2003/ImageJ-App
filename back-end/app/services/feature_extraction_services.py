"""
Feature Extraction Services - Extract cell features from segmentation masks
"""
import os
import numpy as np
from PIL import Image
import csv
from io import StringIO
from skimage import measure
from app import db, config
from app.models import Image as ImageModel, CellFeature

MASK_FOLDER = config.MASK_FOLDER
CONVERTED_FOLDER = config.CONVERTED_FOLDER


def extract_features_from_mask(image_id):
    """
    Extract cell features from segmentation mask for a single image

    Args:
        image_id: Database ID of the image

    Returns:
        list of feature dicts for each cell
    """
    img_record = ImageModel.query.get(image_id)
    if not img_record:
        raise ValueError(f"Image with id {image_id} not found")

    if not img_record.mask_filepath or not os.path.exists(img_record.mask_filepath):
        raise ValueError(f"No mask found for image {image_id}")

    # Load mask
    mask_img = Image.open(img_record.mask_filepath)
    mask_array = np.array(mask_img)

    # Convert to grayscale/labels if colored
    if len(mask_array.shape) == 3:
        # Convert colored mask back to labels
        mask_array = convert_colored_to_labels(mask_array)

    # Load original image for intensity features
    intensity_image = None
    if img_record.filepath and os.path.exists(img_record.filepath):
        orig_img = Image.open(img_record.filepath)
        intensity_image = np.array(orig_img)
        if len(intensity_image.shape) == 3:
            intensity_image = np.mean(intensity_image, axis=2)
    elif img_record.filename:
        converted_name = os.path.splitext(img_record.filename)[0] + '.png'
        converted_path = os.path.join(CONVERTED_FOLDER, converted_name)
        if os.path.exists(converted_path):
            orig_img = Image.open(converted_path)
            intensity_image = np.array(orig_img)
            if len(intensity_image.shape) == 3:
                intensity_image = np.mean(intensity_image, axis=2)

    # Extract frame number from filename
    frame_num = extract_frame_number(img_record.filename) if img_record.filename else image_id

    # Delete existing features for this image
    CellFeature.query.filter_by(image_id=image_id).delete()

    # Extract features using regionprops
    features_list = []
    regions = measure.regionprops(mask_array, intensity_image=intensity_image)

    for idx, region in enumerate(regions):
        cell_id = idx + 1

        # Basic geometry
        area = region.area
        bbox = region.bbox  # (min_row, min_col, max_row, max_col)
        centroid = region.centroid

        # Shape features
        major_axis = region.major_axis_length if region.major_axis_length else 0
        minor_axis = region.minor_axis_length if region.minor_axis_length else 0
        aspect_ratio = major_axis / minor_axis if minor_axis > 0 else 1.0
        eccentricity = region.eccentricity
        solidity = region.solidity if region.solidity else 0
        extent = region.extent if region.extent else 0
        perimeter = region.perimeter if region.perimeter else 0
        convex_area = region.convex_area if region.convex_area else area

        # Circularity
        circularity = (4 * np.pi * area) / (perimeter ** 2) if perimeter > 0 else 0

        # Convexity deficit
        convexity_deficit = (convex_area - area) / convex_area if convex_area > 0 else 0

        # Intensity features
        if intensity_image is not None:
            mean_intensity = region.mean_intensity if region.mean_intensity else 0
            max_intensity = region.max_intensity if region.max_intensity else 0
            min_intensity = region.min_intensity if region.min_intensity else 0
        else:
            mean_intensity = max_intensity = min_intensity = 0

        # Intensity ratios
        intensity_ratio_max_mean = max_intensity / mean_intensity if mean_intensity > 0 else 1.0
        intensity_ratio_mean_min = mean_intensity / min_intensity if min_intensity > 0 else 1.0

        # Create feature record
        feature = CellFeature(
            image_id=image_id,
            cell_id=cell_id,
            frame_num=frame_num,
            min_row_bb=bbox[0],
            min_col_bb=bbox[1],
            max_row_bb=bbox[2],
            max_col_bb=bbox[3],
            area=area,
            major_axis_length=major_axis,
            minor_axis_length=minor_axis,
            centroid_row=centroid[0],
            centroid_col=centroid[1],
            max_intensity=max_intensity,
            mean_intensity=mean_intensity,
            min_intensity=min_intensity,
            convex_area=convex_area,
            solidity=solidity,
            eccentricity=eccentricity,
            extent=extent,
            perimeter=perimeter,
            circularity=circularity,
            aspect_ratio=aspect_ratio,
            convexity_deficit=convexity_deficit,
            intensity_ratio_max_mean=intensity_ratio_max_mean,
            intensity_ratio_mean_min=intensity_ratio_mean_min
        )

        db.session.add(feature)
        features_list.append(feature.to_dict())

    db.session.commit()
    return features_list


def extract_features_batch(image_ids=None):
    """
    Extract features for multiple images

    Args:
        image_ids: List of image IDs (None = all images with masks)

    Returns:
        dict with batch results
    """
    if image_ids is None:
        images = ImageModel.query.filter(
            ImageModel.mask_filename.isnot(None)
        ).all()
        image_ids = [img.id for img in images]

    results = []
    errors = []

    for img_id in image_ids:
        try:
            features = extract_features_from_mask(img_id)
            results.append({
                "image_id": img_id,
                "num_cells": len(features)
            })
        except Exception as e:
            errors.append({"image_id": img_id, "error": str(e)})

    return {
        "processed": len(results),
        "errors": len(errors),
        "results": results,
        "error_details": errors
    }


def get_features_by_image(image_id):
    """Get all cell features for a specific image"""
    features = CellFeature.query.filter_by(image_id=image_id).all()
    return [f.to_dict() for f in features]


def get_all_features():
    """Get all cell features from database"""
    features = CellFeature.query.all()
    return [f.to_dict() for f in features]


def export_features_to_csv(image_id=None):
    """
    Export features to CSV format

    Args:
        image_id: Optional - export only for specific image

    Returns:
        CSV string
    """
    if image_id:
        features = CellFeature.query.filter_by(image_id=image_id).all()
    else:
        features = CellFeature.query.all()

    output = StringIO()
    writer = csv.writer(output)

    # Header
    header = [
        'id', 'image_id', 'cell_id', 'frame_num', 'track_id',
        'centroid_row', 'centroid_col', 'area',
        'major_axis_length', 'minor_axis_length', 'aspect_ratio',
        'eccentricity', 'solidity', 'extent', 'perimeter', 'circularity',
        'convex_area', 'convexity_deficit',
        'mean_intensity', 'max_intensity', 'min_intensity',
        'intensity_ratio_max_mean', 'intensity_ratio_mean_min',
        'delta_x', 'delta_y', 'displacement', 'speed', 'turning',
        'gmm_state', 'hmm_state'
    ]
    writer.writerow(header)

    for f in features:
        row = [
            f.id, f.image_id, f.cell_id, f.frame_num, f.track_id,
            f.centroid_row, f.centroid_col, f.area,
            f.major_axis_length, f.minor_axis_length, f.aspect_ratio,
            f.eccentricity, f.solidity, f.extent, f.perimeter, f.circularity,
            f.convex_area, f.convexity_deficit,
            f.mean_intensity, f.max_intensity, f.min_intensity,
            f.intensity_ratio_max_mean, f.intensity_ratio_mean_min,
            f.delta_x, f.delta_y, f.displacement, f.speed, f.turning,
            f.gmm_state, f.hmm_state
        ]
        writer.writerow(row)

    return output.getvalue()


def convert_colored_to_labels(colored_mask):
    """Convert colored mask back to label mask"""
    # Create unique identifier for each color
    if len(colored_mask.shape) == 2:
        return colored_mask

    h, w = colored_mask.shape[:2]
    labels = np.zeros((h, w), dtype=np.int32)

    # Get unique colors
    flat = colored_mask.reshape(-1, colored_mask.shape[-1])
    unique_colors = np.unique(flat, axis=0)

    label_id = 1
    for color in unique_colors:
        if np.all(color == 0):  # Skip background (black)
            continue
        mask = np.all(colored_mask == color, axis=-1)
        labels[mask] = label_id
        label_id += 1

    return labels


def extract_frame_number(filename):
    """Extract frame number from filename"""
    import re
    if not filename:
        return 0
    match = re.search(r'(\d+)', filename)
    return int(match.group(1)) if match else 0
