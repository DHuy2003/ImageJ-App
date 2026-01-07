import os
from PIL import Image
import shutil
import numpy as np
from app import db, config
from app.models import Image as ImageModel, CellFeature
import re
from flask import url_for, request
from sqlalchemy import or_
import base64
import requests
from io import BytesIO
from pathlib import Path
from PIL import Image as PILImage
from sqlalchemy.exc import OperationalError
import time
from uuid import uuid4
import shutil

UPLOAD_FOLDER = config.UPLOAD_FOLDER
CONVERTED_FOLDER = config.CONVERTED_FOLDER
MASK_FOLDER = config.MASK_FOLDER
EDITED_FOLDER = config.EDITED_FOLDER
SESSION_HEADER = "X-Session-Id"

def _session_scoped_dir(base_dir: str, session_id):
    if not session_id:
        return base_dir
    return os.path.join(base_dir, session_id)

def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def get_current_session_id():
    return request.headers.get(SESSION_HEADER)

def commit_with_retry(retries: int = 3, delay: float = 0.3):
    for attempt in range(retries):
        try:
            db.session.commit()
            return
        except OperationalError as e:
            msg = str(e).lower()
            if "database is locked" in msg and attempt < retries - 1:
                db.session.rollback()
                time.sleep(delay)
                continue
            db.session.rollback()
            raise

def determine_bit_depth(img, arr):
    dtype_to_bit = {
        np.uint8: 8, np.int8: 8, np.uint16: 16, np.int16: 16,
        np.uint32: 32, np.int32: 32, np.float32: 32, np.float64: 64
    }
    return dtype_to_bit.get(arr.dtype.type, 8)

def extract_numeric_part(filename):
    match = re.search(r'\d+', os.path.splitext(filename)[0])
    if match:
        return match.group(0)
    return None

def process_and_save_image(image, destination_folder):
    original_filename = image.filename
    session_id = get_current_session_id()

    upload_dir = _session_scoped_dir(UPLOAD_FOLDER, session_id)
    dest_dir = _session_scoped_dir(destination_folder, session_id)
    _ensure_dir(upload_dir)
    _ensure_dir(dest_dir)

    input_path = os.path.join(upload_dir, original_filename)
    image.save(input_path)

    img = Image.open(input_path)
    arr = np.array(img)

    bit_depth = determine_bit_depth(img, arr)

    converted_filename_base = os.path.splitext(original_filename)[0]
    converted_filename = converted_filename_base + '.png'
    output_path = os.path.join(dest_dir, converted_filename)

    if destination_folder == MASK_FOLDER:
        if img.mode != 'L' and img.mode != 'I' and img.mode != 'I;16':
            if len(arr.shape) == 3:
                arr = arr[:, :, 0].astype(np.int32)
            else:
                arr = arr.astype(np.int32)
        else:
            arr = np.array(img).astype(np.int32)

        original_mask_filename = converted_filename_base + '_labels.png'
        original_mask_path = os.path.join(dest_dir, original_mask_filename)

        if arr.max() > 255:
            original_mask_img = Image.fromarray(arr.astype(np.uint16), mode='I;16')
        else:
            original_mask_img = Image.fromarray(arr.astype(np.uint8), mode='L')
        original_mask_img.save(original_mask_path)

        unique_vals = np.unique(arr)
        lut = np.zeros((int(arr.max()) + 1, 3), dtype=np.uint8)

        lut[0] = [0, 0, 0]

        np.random.seed(42)
        for val in unique_vals:
            if val != 0:
                color = np.random.randint(50, 255, 3)
                lut[int(val)] = color

        color_arr = np.zeros((arr.shape[0], arr.shape[1], 3), dtype=np.uint8)
        for val in unique_vals:
            mask = arr == val
            color_arr[mask] = lut[int(val)]

        img = Image.fromarray(color_arr, mode="RGB")

    else: 
        if 'palette' in img.info:
            img = img.convert('RGB')
            arr = np.array(img)

        if img.mode == '1':
            img = img.convert('L')
            img = img.point(lambda p: 255 * p)
            arr = np.array(img)

        if arr.dtype in [np.uint16, np.int32, np.float32, np.float64]:
            arr = arr.astype(np.float32)
            min_val = arr.min()
            max_val = arr.max()
            if max_val > min_val:
                arr = (arr - min_val) / (max_val - min_val) * 255
            else:
                arr = np.zeros_like(arr)
            arr = arr.astype(np.uint8)
            img = Image.fromarray(arr)

        elif len(arr.shape) == 2 and np.unique(arr).size < 100:
            unique_vals = np.unique(arr)
            lut = np.zeros((256,3), dtype = np.uint8)
            np.random.seed(42)
            for val in unique_vals:
                if val > 0:
                    lut[val] = np.random.randint(0,255,3)
            color_arr = lut[arr]
            img = Image.fromarray(color_arr, mode="RGB")

        elif img.mode in ['CMYK', 'P']:
            img = img.convert('RGB')
            
    img.save(output_path,"PNG")

    width, height = img.size
    file_size = os.path.getsize(output_path)
    session_id = get_current_session_id()
    numeric_part = extract_numeric_part(original_filename)
    image_record = None

    if numeric_part:
        query = ImageModel.query.filter(
            or_(
                ImageModel.filename.like(f'%{numeric_part}%'),
                ImageModel.mask_filename.like(f'%{numeric_part}%')
            )
        )
        if session_id:
            query = query.filter(ImageModel.session_id == session_id)
        image_record = query.first()

    if not image_record:
        image_record = ImageModel()
        image_record.session_id = session_id
        db.session.add(image_record)
        if destination_folder == MASK_FOLDER:
            image_record.status = 'mask_only'
        else: 
            image_record.status = 'original'
    
    old_filename = image_record.filename
    old_filepath = image_record.filepath
    old_mask_filename = image_record.mask_filename
    old_mask_filepath = image_record.mask_filepath
    old_status = image_record.status

    if destination_folder == CONVERTED_FOLDER: 
        image_record.filename = original_filename
        image_record.filepath = output_path
        if image_record.status == 'mask_only':
            image_record.status = 'original'
    elif destination_folder == MASK_FOLDER:
        image_record.mask_filename = converted_filename
        image_record.mask_filepath = output_path
        if not image_record.filename and not old_filename: 
             image_record.status = 'mask_only'
    
    db.session.commit()

    return {
        "id": image_record.id,
        "filename": image_record.filename, 
        "converted_filename": converted_filename, 
        "filepath": image_record.filepath, 
        "mask_filename": image_record.mask_filename, 
        "mask_filepath": image_record.mask_filepath, 
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "size": file_size,
        "status": image_record.status,
        "uploaded_on": image_record.uploaded_on.isoformat(),
        "last_edited_on": image_record.last_edited_on.isoformat() if image_record.last_edited_on else None
    }

def convert_image_for_preview(image, session_id=None):
    img = Image.open(image)
    arr = np.array(img)

    if 'palette' in img.info:
        img = img.convert('RGB')
        arr = np.array(img)

    if img.mode == '1':
        img = img.convert('L')
        img = img.point(lambda p: 255 * p)
        arr = np.array(img)

    if arr.dtype in [np.uint16, np.int32, np.float32, np.float64]:
        arr = arr.astype(np.float32)
        min_val = arr.min()
        max_val = arr.max()
        if max_val > min_val:
            arr = (arr - min_val) / (max_val - min_val) * 255
        else:
            arr = np.zeros_like(arr)
        arr = arr.astype(np.uint8)
        img = Image.fromarray(arr)

    elif len(arr.shape) == 2 and np.unique(arr).size < 100:
        unique_vals = np.unique(arr)
        lut = np.zeros((256, 3), dtype=np.uint8)
        np.random.seed(42)
        for val in unique_vals:
            if val > 0:
                lut[val] = np.random.randint(0, 255, 3)
        color_arr = lut[arr]
        img = Image.fromarray(color_arr, mode="RGB")

    elif img.mode in ['CMYK', 'P']:
        img = img.convert('RGB')

    preview_filename = f"vs_{uuid4().hex}.png"
    session_id = session_id or get_current_session_id()
    preview_dir = _session_scoped_dir(CONVERTED_FOLDER, session_id)
    _ensure_dir(preview_dir)
    output_path = os.path.join(preview_dir, preview_filename)
    img.save(output_path, "PNG")

    return preview_filename


def upload_cell_images(images):
    uploaded_cells_info = []

    for image in images:
        try:
            cell_image_info = process_and_save_image(image, CONVERTED_FOLDER)
            cell_image_info["url"] = url_for(
                'image_bp.get_converted_image_session',
                session_id=get_current_session_id(),
                filename=cell_image_info['converted_filename'],
                _external=True
            )
            uploaded_cells_info.append(cell_image_info)
        except Exception as e:
            uploaded_cells_info.append({
                "filename": image.filename,
                "error": str(e)
            })
    return uploaded_cells_info

def upload_mask_images(images):
    uploaded_masks_info = []

    for mask_file in images:
        try:
            mask_info = process_and_save_image(mask_file, MASK_FOLDER)
            numeric_part = extract_numeric_part(mask_file.filename)
            if numeric_part:
                session_id = get_current_session_id()
                linked_query = ImageModel.query.filter(
                    or_(
                        ImageModel.filename.like(f'%{numeric_part}%'),
                        ImageModel.mask_filename.like(f'%{numeric_part}%')
                    )
                )
                if session_id:
                    linked_query = linked_query.filter(ImageModel.session_id == session_id)
                linked_image_record = linked_query.first()
                if linked_image_record:
                    mask_info["id"] = linked_image_record.id
                    mask_info["cell_filename"] = linked_image_record.filename
                    if linked_image_record.filename:
                        cell_converted_filename = os.path.splitext(linked_image_record.filename)[0] + '.png'
                        mask_info["url"] = url_for(
                            'image_bp.get_converted_image_session',
                            session_id=session_id,
                            filename=cell_converted_filename,
                            _external=True
                        )
                    mask_info["mask_url"] = url_for(
                        'image_bp.get_mask_image_session',
                        session_id=session_id,
                        filename=linked_image_record.mask_filename,
                        _external=True
                    )
                    uploaded_masks_info.append(mask_info)
                else:
                    print(f"Warning: No linked image record found for mask {mask_file.filename} after processing.")
            else:
                print(f"Warning: Could not extract numeric part from mask filename {mask_file.filename} for linking.")
        except Exception as e:
            uploaded_masks_info.append({
                "filename": mask_file.filename,
                "error": str(e)
            })
    return uploaded_masks_info

def update_edited_image(image, image_id):
    img_record = ImageModel.query.get(image_id)
    if not img_record:
        raise ValueError(f"Image with id {image_id} not found")

    session_id = get_current_session_id()
    if img_record.session_id:
        if not session_id or img_record.session_id != session_id:
            raise PermissionError("Image does not belong to this session")

    stem = Path(img_record.filename).stem if img_record.filename else f"image_{image_id}"
    edited_filename = f"{stem}_edited.png"
    edited_dir = _session_scoped_dir(EDITED_FOLDER, session_id)
    _ensure_dir(edited_dir)
    output_path = os.path.join(edited_dir, edited_filename)

    img = PILImage.open(image)
    if img.mode not in ["RGB", "RGBA", "L"]:
        img = img.convert("RGB")
    img.save(output_path, "PNG")

    img_record.edited_filename = edited_filename
    img_record.edited_filepath = output_path
    img_record.status = "edited"

    commit_with_retry()

    edited_url = url_for(
        "image_bp.get_edited_image_session",
        session_id=session_id,
        filename=edited_filename,
        _external=True,
    )

    return {
        "id": img_record.id,
        "edited_filepath": img_record.edited_filepath,
        "edited_url": edited_url,
    }

def update_mask_image(mask_file, image_id):
    img_record = ImageModel.query.get(image_id)
    if not img_record:
        raise ValueError(f"Image with id {image_id} not found")

    session_id = get_current_session_id()
    if img_record.session_id:
        if not session_id or img_record.session_id != session_id:
            raise PermissionError("Image does not belong to this session")

    stem = Path(img_record.filename).stem if img_record.filename else f"image_{image_id}"
    mask_filename = f"{stem}_mask.png"
    mask_dir = _session_scoped_dir(MASK_FOLDER, session_id)
    _ensure_dir(mask_dir)
    output_path = os.path.join(mask_dir, mask_filename)

    img = PILImage.open(mask_file)
    if img.mode not in ["L", "RGB", "RGBA"]:
        img = img.convert("L")
    img.save(output_path, "PNG")

    img_record.mask_filename = mask_filename
    img_record.mask_filepath = output_path
    if img_record.filename and img_record.status == "mask_only":
        img_record.status = "original"

    commit_with_retry()

    mask_url = url_for(
        "image_bp.get_mask_image_session",
        session_id=session_id,
        filename=mask_filename,
        _external=True,
    )

    return {
        "id": img_record.id,
        "mask_filepath": img_record.mask_filepath,
        "mask_url": mask_url,
        "mask_filename": img_record.mask_filename,
    }

def get_all_images():
    session_id = get_current_session_id()
    if not session_id:
        return []
    query = ImageModel.query.filter(ImageModel.filename.isnot(None))
    if session_id:
        query = query.filter(ImageModel.session_id == session_id)
    images = query.all()
    image_list = []

    for img_db in images:
        try:
            converted_filename = None
            original_url = None
            edited_url = None
            mask_url = None

            if img_db.filename:
                converted_filename = os.path.splitext(img_db.filename)[0] + '.png'
                original_url = url_for(
                    'image_bp.get_converted_image_session',
                    session_id=img_db.session_id,
                    filename=converted_filename,
                    _external=True
                )

            if img_db.edited_filepath:
                edited_filename = os.path.basename(img_db.edited_filepath)
                if os.path.exists(img_db.edited_filepath):
                    edited_url = url_for(
                        'image_bp.get_edited_image_session',
                        session_id=img_db.session_id,
                        filename=edited_filename,
                        _external=True
                    )

            if img_db.mask_filename:
                # Debug: check mask file path
                expected_mask_path = os.path.join(_session_scoped_dir(MASK_FOLDER, img_db.session_id), img_db.mask_filename)
                db_mask_path = img_db.mask_filepath
                print(f"[DEBUG get_all_images] mask_filename: {img_db.mask_filename}")
                print(f"[DEBUG get_all_images] DB mask_filepath: {db_mask_path}")
                print(f"[DEBUG get_all_images] Expected mask path: {expected_mask_path}")
                print(f"[DEBUG get_all_images] DB path exists: {os.path.exists(db_mask_path) if db_mask_path else False}")
                print(f"[DEBUG get_all_images] Expected path exists: {os.path.exists(expected_mask_path)}")

                mask_url = url_for(
                    'image_bp.get_mask_image_session',
                    session_id=img_db.session_id,
                    filename=img_db.mask_filename,
                    _external=True
                )
                print(f"[DEBUG get_all_images] Generated mask_url: {mask_url}")

            path_for_info = None
            final_url = None

            if img_db.edited_filepath and os.path.exists(img_db.edited_filepath):
                path_for_info = img_db.edited_filepath
                final_url = edited_url
            elif converted_filename and os.path.exists(os.path.join(_session_scoped_dir(CONVERTED_FOLDER, img_db.session_id), converted_filename)):
                path_for_info = os.path.join(_session_scoped_dir(CONVERTED_FOLDER, img_db.session_id), converted_filename)
                final_url = original_url
            elif img_db.mask_filename and os.path.exists(os.path.join(_session_scoped_dir(MASK_FOLDER, img_db.session_id), img_db.mask_filename)):
                path_for_info = os.path.join(_session_scoped_dir(MASK_FOLDER, img_db.session_id), img_db.mask_filename)
                final_url = mask_url

            width = height = file_size = bit_depth = None
            if path_for_info and os.path.exists(path_for_info):
                with Image.open(path_for_info) as img_pil:
                    width, height = img_pil.size
                    file_size = os.path.getsize(path_for_info)
                    arr = np.array(img_pil)
                    bit_depth = determine_bit_depth(img_pil, arr)

            image_list.append({
                "id": img_db.id,
                "filename": img_db.filename,
                "url": final_url,        
                "original_url": original_url,
                "edited_url": edited_url,
                "mask_filename": img_db.mask_filename,
                "mask_filepath": img_db.mask_filepath,
                "mask_url": mask_url,
                "width": width,
                "height": height,
                "bitDepth": bit_depth,
                "size": file_size,
                "uploaded_on": img_db.uploaded_on.isoformat(),
                "status": img_db.status,
                "last_edited_on": img_db.last_edited_on.isoformat() if img_db.last_edited_on else None
            })
        except Exception as e:
            image_list.append({
                "id": img_db.id,
                "filename": img_db.filename,
                "url": None,
                "mask_filename": img_db.mask_filename,
                "mask_filepath": img_db.mask_filepath,
                "mask_url": None,
                "width": None,
                "height": None,
                "bitDepth": None,
                "size": None,
                "uploaded_on": img_db.uploaded_on.isoformat(),
                "status": img_db.status,
                "last_edited_on": img_db.last_edited_on.isoformat() if img_db.last_edited_on else None
            })

    return image_list

def convert_image_to_tiff(image_data=None, image_url=None, filename=None):
    try:
        img = None
        
        if image_data:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            img = Image.open(BytesIO(image_bytes))
        
        elif image_url:
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
        
        else:
            raise ValueError("Either image_data or image_url must be provided")
        
        if img.mode not in ['RGB', 'RGBA', 'L', 'LA', 'P']:
            if img.mode == 'CMYK':
                img = img.convert('RGB')
            elif img.mode in ['1', 'I', 'F']:
                img = img.convert('RGB')
            else:
                img = img.convert('RGB')

        tiff_buffer = BytesIO()
 
        img.save(tiff_buffer, format='TIFF', compression='tiff_lzw')
        tiff_buffer.seek(0)
        
        return tiff_buffer
    
    except Exception as e:
        print(f"Error converting image to TIFF: {str(e)}")
        raise Exception(f"Failed to convert image to TIFF: {str(e)}")

def delete_image(image_id):
    img = ImageModel.query.get(image_id)
    if not img:
        raise ValueError(f"Image with id {image_id} not found")

    session_id = get_current_session_id()
    if img.session_id:
        if not session_id or img.session_id != session_id:
            raise PermissionError("Image does not belong to this session")

    for path in [img.filepath, img.mask_filepath, img.edited_filepath]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError as e:
                print(f"Failed to remove file {path}: {e}")

    db.session.delete(img)
    db.session.commit()

    return {"id": image_id}

def delete_session_data(session_id: str):
    if not session_id:
        raise ValueError("Session ID is required to reset session data")

    print(f"Cleaning up data for session {session_id}")
    images = ImageModel.query.filter(ImageModel.session_id == session_id).all()
    if not images:
        return {"deleted_images": 0, "deleted_features": 0}

    image_ids = [img.id for img in images]

    CellFeature.query.filter(
        CellFeature.image_id.in_(image_ids)
    ).delete(synchronize_session=False)

    for img in images:
        paths = []
        for p in [img.filepath, img.mask_filepath, img.edited_filepath]:
            if p:
                paths.append(p)

        if img.mask_filename:
            mask_dir = os.path.dirname(img.mask_filepath) if img.mask_filepath else _session_scoped_dir(MASK_FOLDER, session_id)
            label_path = os.path.join(
                mask_dir,
                f"{os.path.splitext(img.mask_filename)[0]}_labels.png",
            )
            paths.append(label_path)

        for path in paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError as e:
                    print(f"Failed to remove file {path}: {e}")

        db.session.delete(img)

    commit_with_retry()

    for base in [UPLOAD_FOLDER, CONVERTED_FOLDER, MASK_FOLDER, EDITED_FOLDER]:
        session_dir = os.path.join(base, session_id)
        try:
            shutil.rmtree(session_dir, ignore_errors=True)
        except Exception as e:
            print(f"Failed to remove session dir {session_dir}: {e}")
    print(f"Cleaning up data for session complete")
    return {"deleted_images": len(image_ids)}

def cleanup_folders():
    print("Cleaning up folders...")
    for folder in [UPLOAD_FOLDER, CONVERTED_FOLDER, MASK_FOLDER, EDITED_FOLDER]:
        if not os.path.exists(folder):
            continue
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
    print("File cleanup complete.")

def cleanup_database(app):
    print("Cleaning up DB")
    with app.app_context():
        try:
            CellFeature.query.delete()
            ImageModel.query.delete()
            db.session.commit()
            print("Cleared Image and CellFeature tables.")
        except Exception as e:
            print(f"Failed to clear imageJ table. Reason: {e}")
    print("DB cleanup complete.")


def export_masks_to_zip(session_id=None):
    """
    Export all mask images to a ZIP file, keeping original format

    Args:
        session_id: Optional session ID to filter images

    Returns:
        BytesIO buffer containing the ZIP file
    """
    import zipfile

    if session_id:
        images = ImageModel.query.filter(
            ImageModel.session_id == session_id,
            ImageModel.mask_filepath.isnot(None)
        ).order_by(ImageModel.id).all()
    else:
        images = ImageModel.query.filter(
            ImageModel.mask_filepath.isnot(None)
        ).order_by(ImageModel.id).all()

    if not images:
        raise ValueError("No masks found to export")

    zip_buffer = BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for img in images:
            if img.mask_filepath and os.path.exists(img.mask_filepath):
                # Keep original filename and format
                mask_filename = os.path.basename(img.mask_filepath)
                with open(img.mask_filepath, 'rb') as f:
                    zip_file.writestr(f"masks/{mask_filename}", f.read())

                # Also export labels mask if exists
                mask_dir = os.path.dirname(img.mask_filepath)
                base_name = os.path.splitext(os.path.basename(img.mask_filepath))[0]

                # Try to find labels file with any extension
                for ext in ['.png', '.tif', '.tiff']:
                    labels_path = os.path.join(mask_dir, f"{base_name}_labels{ext}")
                    if os.path.exists(labels_path):
                        labels_filename = os.path.basename(labels_path)
                        with open(labels_path, 'rb') as f:
                            zip_file.writestr(f"masks_labels/{labels_filename}", f.read())
                        break

    zip_buffer.seek(0)
    return zip_buffer


def export_images_to_zip(session_id=None, include_original=True, include_edited=True):
    """
    Export all images to a ZIP file, keeping original format

    Args:
        session_id: Optional session ID to filter images
        include_original: Include original images
        include_edited: Include edited images

    Returns:
        BytesIO buffer containing the ZIP file
    """
    import zipfile

    if session_id:
        images = ImageModel.query.filter(
            ImageModel.session_id == session_id
        ).order_by(ImageModel.id).all()
    else:
        images = ImageModel.query.all()

    if not images:
        raise ValueError("No images found to export")

    zip_buffer = BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for img in images:
            # Export original image - keep original format
            if include_original and img.filepath and os.path.exists(img.filepath):
                original_filename = os.path.basename(img.filepath)
                with open(img.filepath, 'rb') as f:
                    zip_file.writestr(f"original/{original_filename}", f.read())

            # Export edited image - keep original format
            if include_edited and img.edited_filepath and os.path.exists(img.edited_filepath):
                edited_filename = os.path.basename(img.edited_filepath)
                with open(img.edited_filepath, 'rb') as f:
                    zip_file.writestr(f"edited/{edited_filename}", f.read())

    zip_buffer.seek(0)
    return zip_buffer


def export_all_to_zip(session_id=None):
    """
    Export all images, masks, and labels to a single ZIP file, keeping original formats

    Args:
        session_id: Optional session ID to filter images

    Returns:
        BytesIO buffer containing the ZIP file
    """
    import zipfile

    if session_id:
        images = ImageModel.query.filter(
            ImageModel.session_id == session_id
        ).order_by(ImageModel.id).all()
    else:
        images = ImageModel.query.all()

    if not images:
        raise ValueError("No images found to export")

    zip_buffer = BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for img in images:
            # Original image - keep original format
            if img.filepath and os.path.exists(img.filepath):
                original_filename = os.path.basename(img.filepath)
                with open(img.filepath, 'rb') as f:
                    zip_file.writestr(f"original/{original_filename}", f.read())

            # Edited image - keep original format
            if img.edited_filepath and os.path.exists(img.edited_filepath):
                edited_filename = os.path.basename(img.edited_filepath)
                with open(img.edited_filepath, 'rb') as f:
                    zip_file.writestr(f"edited/{edited_filename}", f.read())

            # Mask image - keep original format
            if img.mask_filepath and os.path.exists(img.mask_filepath):
                mask_filename = os.path.basename(img.mask_filepath)
                with open(img.mask_filepath, 'rb') as f:
                    zip_file.writestr(f"masks/{mask_filename}", f.read())

                # Labels mask
                mask_dir = os.path.dirname(img.mask_filepath)
                base_name = os.path.splitext(os.path.basename(img.mask_filepath))[0]

                for ext in ['.png', '.tif', '.tiff']:
                    labels_path = os.path.join(mask_dir, f"{base_name}_labels{ext}")
                    if os.path.exists(labels_path):
                        labels_filename = os.path.basename(labels_path)
                        with open(labels_path, 'rb') as f:
                            zip_file.writestr(f"masks_labels/{labels_filename}", f.read())
                        break

    zip_buffer.seek(0)
    return zip_buffer

