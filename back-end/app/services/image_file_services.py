import os
from PIL import Image
import shutil
import numpy as np
from app import db
from app.models import Image as ImageModel
import re
from flask import url_for

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  
BACKEND_DIR = os.path.dirname(os.path.dirname(BASE_DIR)) 

UPLOAD_FOLDER = os.path.join(BACKEND_DIR, 'uploads')
CONVERTED_FOLDER = os.path.join(BACKEND_DIR, 'converted')
MASK_FOLDER = os.path.join(BACKEND_DIR, 'masks')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)
os.makedirs(MASK_FOLDER, exist_ok=True)

def determine_bit_depth(img, arr):
    dtype_to_bit = {
        np.uint8: 8, np.int8: 8, np.uint16: 16, np.int16: 16,
        np.uint32: 32, np.int32: 32, np.float32: 32, np.float64: 64
    }
    return dtype_to_bit.get(arr.dtype.type, 8)

def process_and_save_image(image, destination_folder, save_to_db=True):
    input_filename = image.filename
    input_path = os.path.join(UPLOAD_FOLDER, input_filename)
    image.save(input_path)

    img = Image.open(input_path)
    arr = np.array(img)

    bit_depth = determine_bit_depth(img, arr)

    if destination_folder == MASK_FOLDER:
        # Đảm bảo ảnh mask được xử lý thành ảnh grayscale trước
        if img.mode != 'L':
            img = img.convert('L')
            arr = np.array(img)
        
        # Chuẩn hóa giá trị về 0-255
        arr = arr.astype(np.float32)
        if arr.max() > 0:
            arr = (arr / arr.max()) * 255
        arr = arr.astype(np.uint8)
        
        # Tìm giá trị nền (giá trị pixel tối thiểu)
        min_pixel_value = arr.min()
        
        # Tạo một bảng tra cứu (LUT) để gán màu ngẫu nhiên cho các đối tượng
        unique_vals = np.unique(arr)
        lut = np.zeros((256, 3), dtype=np.uint8) # LUT cho RGB
        
        # Đặt màu đen cho nền
        if min_pixel_value < 256: # Đảm bảo giá trị hợp lệ cho index LUT
            lut[min_pixel_value] = [0, 0, 0] # Nền là màu đen
        
        # Gán màu ngẫu nhiên cho các đối tượng (giá trị khác nền)
        np.random.seed(42) # Giữ màu ngẫu nhiên nhất quán nếu muốn
        for val in unique_vals:
            if val != min_pixel_value:
                # Tạo màu ngẫu nhiên khác màu đen
                color = np.random.randint(0, 255, 3)
                # Đảm bảo màu không quá tối (tránh gần với nền đen)
                while np.all(color < 50): # Nếu tất cả kênh đều nhỏ hơn 50, tạo lại
                    color = np.random.randint(0, 255, 3)
                lut[val] = color
        
        # Áp dụng LUT vào mảng ảnh để tạo ảnh màu
        color_arr = lut[arr]
        img = Image.fromarray(color_arr, mode="RGB")

    else: # Xử lý cho ảnh cell (hoặc các ảnh không phải mask)
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

    converted_filename = os.path.splitext(input_filename)[0] + '.png'
    output_path = os.path.join(destination_folder, converted_filename)
    img.save(output_path,"PNG")

    width, height = img.size
    file_size = os.path.getsize(output_path)

    if save_to_db:
        existing_image = ImageModel.query.filter_by(filename=input_filename).first()
        if existing_image:
            existing_image.filepath = output_path
            existing_image.status = 'updated'
            db.session.commit()
        else:
            new_image = ImageModel(filename=input_filename, filepath=output_path, status='original')
            db.session.add(new_image)
            db.session.commit()

    return {
        "filename": input_filename,
        "converted_filename": converted_filename,
        "filepath": output_path,
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "size": file_size
    }

def convert_tiff_to_png(images):
    converted_images = []

    for image in images:
        image_info = process_and_save_image(image, CONVERTED_FOLDER, save_to_db=True)
        image_info["url"] = f"http://127.0.0.1:5000/api/images/converted/{image_info['converted_filename']}"
        converted_images.append(image_info)

    return converted_images

def upload_cell_images(images):
    uploaded_cells_info = []
    for image in images:
        try:
            cell_image_info = process_and_save_image(image, CONVERTED_FOLDER, save_to_db=True)
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
        mask_info = process_and_save_image(mask_file, MASK_FOLDER, save_to_db=False)
        mask_filename = mask_info['filename']
        mask_basename = os.path.splitext(mask_filename)[0]
        
        match = re.search(r'\d+', mask_basename)
        if match:
            numeric_part = match.group(0)
            cell_image_record = ImageModel.query.filter(ImageModel.filename.like(f'%{numeric_part}.tif'), ImageModel.mask_filename == None).first()

            if cell_image_record:
                cell_image_record.mask_filename = mask_info['converted_filename']
                cell_image_record.mask_filepath = mask_info['filepath']
                db.session.commit()
                mask_info["cell_image_id"] = cell_image_record.id
                mask_info["mask_url"] = url_for(
                    'image_file_bp.get_mask_image',
                    filename=mask_info['converted_filename'],
                    _external=True
                )
                uploaded_masks_info.append(mask_info)
            else:
                print(f"Warning: No matching cell image found for mask {mask_filename}")
        else:
            print(f"Warning: Could not extract numeric part from mask filename {mask_filename}")
    return uploaded_masks_info

def cleanup_folders(app):
    print("Cleaning up upload and converted folders...")
    for folder in [UPLOAD_FOLDER, CONVERTED_FOLDER, MASK_FOLDER]:
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
    print("Cleanup complete.")

    with app.app_context():
        try:
            ImageModel.query.delete()
            db.session.commit()
            print("Already cleared all records from the imageJ table.")
        except Exception as e:
            print(f"Failed to clear imageJ table. Reason: {e}")

def get_all_images():
    images = ImageModel.query.all()
    image_list = []
    for img_db in images:
        converted_filename = os.path.splitext(img_db.filename)[0] + '.png'
        image_url = url_for(
            'image_file_bp.get_converted_image',
            filename=converted_filename,
            _external=True
        )
        
        mask_url = None
        if img_db.mask_filename:
            mask_url = url_for(
                'image_file_bp.get_mask_image',
                filename=img_db.mask_filename,
                _external=True
            )

        try:
            converted_image_path = os.path.join(CONVERTED_FOLDER, converted_filename)
            if os.path.exists(converted_image_path):
                with Image.open(converted_image_path) as img_pil:
                    width, height = img_pil.size
                    file_size = os.path.getsize(converted_image_path)

                    arr = np.array(img_pil)
                    bit_depth = determine_bit_depth(img_pil, arr)

                    image_list.append({
                        "id": img_db.id,
                        "filename": img_db.filename,
                        "url": image_url,
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
            else:
                image_list.append({
                    "id": img_db.id,
                    "filename": img_db.filename,
                    "url": image_url,
                    "mask_filename": img_db.mask_filename,
                    "mask_filepath": img_db.mask_filepath,
                    "mask_url": mask_url,
                    "width": None,
                    "height": None,
                    "bitDepth": None,
                    "size": None,
                    "uploaded_on": img_db.uploaded_on.isoformat(),
                    "status": img_db.status,
                    "last_edited_on": img_db.last_edited_on.isoformat() if img_db.last_edited_on else None
                })
        except Exception as e:
            print(f"Error processing image {img_db.filename}: {e}")
            image_list.append({
                "id": img_db.id,
                "filename": img_db.filename,
                "url": image_url,
                "mask_filename": img_db.mask_filename,
                "mask_filepath": img_db.mask_filepath,
                "mask_url": mask_url,
                "width": None,
                "height": None,
                "bitDepth": None,
                "size": None,
                "uploaded_on": img_db.uploaded_on.isoformat(),
                "status": img_db.status,
                "last_edited_on": img_db.last_edited_on.isoformat() if img_db.last_edited_on else None
            })
    return image_list



