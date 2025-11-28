import os
from PIL import Image
import shutil
import numpy as np
from app import db, config
from app.models import Image as ImageModel
import re
from flask import url_for
from sqlalchemy import or_
import base64
import requests
from io import BytesIO
from pathlib import Path
from PIL import Image as PILImage

UPLOAD_FOLDER = config.UPLOAD_FOLDER
CONVERTED_FOLDER = config.CONVERTED_FOLDER
MASK_FOLDER = config.MASK_FOLDER
EDITED_FOLDER = config.EDITED_FOLDER

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
    input_path = os.path.join(UPLOAD_FOLDER, original_filename)
    image.save(input_path)

    img = Image.open(input_path)
    arr = np.array(img)

    bit_depth = determine_bit_depth(img, arr)

    converted_filename_base = os.path.splitext(original_filename)[0]
    converted_filename = converted_filename_base + '.png'
    output_path = os.path.join(destination_folder, converted_filename)

    if destination_folder == MASK_FOLDER:
        if img.mode != 'L':
            img = img.convert('L')
            arr = np.array(img)
        
        arr = arr.astype(np.float32)
        if arr.max() > 0:
            arr = (arr / arr.max()) * 255
        arr = arr.astype(np.uint8)

        min_pixel_value = arr.min()

        unique_vals = np.unique(arr)
        lut = np.zeros((256, 3), dtype=np.uint8)

        if min_pixel_value < 256: 
            lut[min_pixel_value] = [0, 0, 0]

        np.random.seed(42)
        for val in unique_vals:
            if val != min_pixel_value:
                color = np.random.randint(0, 255, 3)
                while np.all(color < 50): 
                    color = np.random.randint(0, 255, 3)
                lut[val] = color

        color_arr = lut[arr]
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
            min_val, max_val = np.percentile(arr, [1,99])
            arr = np.clip((arr - min_val) / (max_val - min_val), 0, 1)
            arr = arr * 255
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

    numeric_part = extract_numeric_part(original_filename)
    image_record = None

    if numeric_part:
        image_record = ImageModel.query.filter(
            or_(
                ImageModel.filename.like(f'%{numeric_part}%'),
                ImageModel.mask_filename.like(f'%{numeric_part}%')
            )
        ).first()

    if not image_record:
        image_record = ImageModel()
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

def upload_cell_images(images):
    uploaded_cells_info = []
    for image in images:
        try:
            cell_image_info = process_and_save_image(image, CONVERTED_FOLDER)
            cell_image_info["url"] = url_for(
                'image_file_bp.get_converted_image',
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
                linked_image_record = ImageModel.query.filter(
                    or_(
                        ImageModel.filename.like(f'%{numeric_part}%'),
                        ImageModel.mask_filename.like(f'%{numeric_part}%')
                    )
                ).first()
                if linked_image_record:
                    mask_info["id"] = linked_image_record.id
                    mask_info["cell_filename"] = linked_image_record.filename
                    if linked_image_record.filename:
                        cell_converted_filename = os.path.splitext(linked_image_record.filename)[0] + '.png'
                        mask_info["url"] = url_for(
                            'image_file_bp.get_converted_image',
                            filename=cell_converted_filename,
                            _external=True
                        )
                    mask_info["mask_url"] = url_for(
                        'image_file_bp.get_mask_image',
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

def update_edited_image(image_file, image_id):
    img_record = ImageModel.query.get(image_id)
    if not img_record:
        raise ValueError(f"Image with id {image_id} not found")

    stem = Path(img_record.filename).stem if img_record.filename else f"image_{image_id}"
    edited_filename = f"{stem}_edited.png"
    output_path = os.path.join(EDITED_FOLDER, edited_filename)

    img = PILImage.open(image_file)
    if img.mode not in ["RGB", "RGBA", "L"]:
        img = img.convert("RGB")
    img.save(output_path, "PNG")

    img_record.edited_filename = edited_filename
    img_record.edited_filepath = output_path
    img_record.status = "edited"
    db.session.commit()

    edited_url = url_for(
        'image_file_bp.get_edited_image',
        filename=edited_filename,
        _external=True
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

    stem = Path(img_record.filename).stem if img_record.filename else f"image_{image_id}"
    mask_filename = f"{stem}_mask.png"
    output_path = os.path.join(MASK_FOLDER, mask_filename)

    img = PILImage.open(mask_file)
    # mask có thể là L hoặc RGB, convert nếu cần
    if img.mode not in ["L", "RGB", "RGBA"]:
        img = img.convert("L")
    img.save(output_path, "PNG")

    img_record.mask_filename = mask_filename
    img_record.mask_filepath = output_path
    # status: nếu đã có filename thì có thể là 'original' hoặc 'edited', tuỳ em
    if img_record.filename and img_record.status == "mask_only":
        img_record.status = "original"
    db.session.commit()

    mask_url = url_for(
        'image_file_bp.get_mask_image',
        filename=mask_filename,
        _external=True
    )

    return {
        "id": img_record.id,
        "mask_filepath": img_record.mask_filepath,
        "mask_url": mask_url,
        "mask_filename": img_record.mask_filename,
    }

def get_all_images():
    images = ImageModel.query.filter(ImageModel.filename.isnot(None)).all()
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
                    'image_file_bp.get_converted_image',
                    filename=converted_filename,
                    _external=True
                )

            if img_db.edited_filepath:
                edited_filename = os.path.basename(img_db.edited_filepath)
                if os.path.exists(img_db.edited_filepath):
                    edited_url = url_for(
                        'image_file_bp.get_edited_image',
                        filename=edited_filename,
                        _external=True
                    )

            if img_db.mask_filename:
                mask_url = url_for(
                    'image_file_bp.get_mask_image',
                    filename=img_db.mask_filename,
                    _external=True
                )

            path_for_info = None
            final_url = None

            if img_db.edited_filepath and os.path.exists(img_db.edited_filepath):
                path_for_info = img_db.edited_filepath
                final_url = edited_url
            elif converted_filename and os.path.exists(os.path.join(CONVERTED_FOLDER, converted_filename)):
                path_for_info = os.path.join(CONVERTED_FOLDER, converted_filename)
                final_url = original_url
            elif img_db.mask_filename and os.path.exists(os.path.join(MASK_FOLDER, img_db.mask_filename)):
                path_for_info = os.path.join(MASK_FOLDER, img_db.mask_filename)
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

def save_image(image_data=None, image_url=None, filename=None):
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
    
def revert_image(image_id):
    img_db = ImageModel.query.get(image_id)
    if not img_db:
        raise ValueError(f"Image with id {image_id} not found")

    if getattr(img_db, "edited_filepath", None) and os.path.exists(img_db.edited_filepath):
        try:
            os.remove(img_db.edited_filepath)
        except OSError as e:
            print(f"Failed to remove edited file {img_db.edited_filepath}: {e}")

    if hasattr(img_db, "edited_filename"):
        img_db.edited_filename = None
    if hasattr(img_db, "edited_filepath"):
        img_db.edited_filepath = None

    if img_db.filename:
        img_db.status = "original"
    elif img_db.mask_filename:
        img_db.status = "mask_only"

    img_db.last_edited_on = None
    db.session.commit()

    converted_filename = None
    original_url = None
    edited_url = None
    mask_url = None

    if img_db.filename:
        converted_filename = os.path.splitext(img_db.filename)[0] + '.png'
        original_url = url_for(
            'image_file_bp.get_converted_image',
            filename=converted_filename,
            _external=True
        )

    if img_db.mask_filename:
        mask_url = url_for(
            'image_file_bp.get_mask_image',
            filename=img_db.mask_filename,
            _external=True
        )

    path_for_info = None
    final_url = None

    if converted_filename and os.path.exists(os.path.join(CONVERTED_FOLDER, converted_filename)):
        path_for_info = os.path.join(CONVERTED_FOLDER, converted_filename)
        final_url = original_url
    elif img_db.mask_filename and os.path.exists(os.path.join(MASK_FOLDER, img_db.mask_filename)):
        path_for_info = os.path.join(MASK_FOLDER, img_db.mask_filename)
        final_url = mask_url

    width = height = file_size = bit_depth = None
    if path_for_info and os.path.exists(path_for_info):
        with Image.open(path_for_info) as img_pil:
            width, height = img_pil.size
            file_size = os.path.getsize(path_for_info)
            arr = np.array(img_pil)
            bit_depth = determine_bit_depth(img_pil, arr)

    return {
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
        "last_edited_on": img_db.last_edited_on.isoformat() if img_db.last_edited_on else None,
    }

    
def delete_image(image_id):
    img = ImageModel.query.get(image_id)
    if not img:
        raise ValueError(f"Image with id {image_id} not found")

    for path in [img.filepath, img.mask_filepath, img.edited_filepath]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError as e:
                print(f"Failed to remove file {path}: {e}")

    db.session.delete(img)
    db.session.commit()

    return {"id": image_id}

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
            ImageModel.query.delete()
            db.session.commit()
            print("Already cleared all records from the imageJ table.")
        except Exception as e:
            print(f"Failed to clear imageJ table. Reason: {e}")
    print("DB cleanup complete.")


