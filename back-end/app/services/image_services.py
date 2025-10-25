import os
from PIL import Image
import shutil
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  
BACKEND_DIR = os.path.dirname(os.path.dirname(BASE_DIR)) 

UPLOAD_FOLDER = os.path.join(BACKEND_DIR, 'uploads')
CONVERTED_FOLDER = os.path.join(BACKEND_DIR, 'converted')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

def convert_tiff_to_png(images):
    converted_images = []

    for image in images:
        input_filename = image.filename
        input_path = os.path.join(UPLOAD_FOLDER, input_filename)
        image.save(input_path)

        img = Image.open(input_path)
        arr = np.array(img)

        dtype_to_bit = {
            np.uint8: 8,
            np.int8: 8,
            np.uint16: 16,
            np.int16: 16,
            np.uint32: 32,
            np.int32: 32,
            np.float32: 32,
            np.float64: 64
        }
        bit_depth = dtype_to_bit.get(arr.dtype.type, 8)

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

        output_filename = os.path.splitext(input_filename)[0] + '.png'
        output_path = os.path.join(CONVERTED_FOLDER, output_filename)
        img.save(output_path,"PNG")
        
        raw_npy_path = os.path.join(CONVERTED_FOLDER, os.path.splitext(input_filename)[0] + "_raw.npy")
        np.save(raw_npy_path, np.array(Image.open(input_path))) 

        width, height = img.size
        file_size = os.path.getsize(output_path)
        image_url = "http://127.0.0.1:5000/api/images/converted/" + output_filename

        converted_images.append({
            "filename": input_filename,
            "url": image_url,
            "width": width,
            "height": height,
            "bitDepth": bit_depth,    
            "size": file_size,
            "rawData": raw_npy_path    
        })

    return converted_images

def cleanup_folders():
    print("Cleaning up upload and converted folders...")
    for folder in [UPLOAD_FOLDER, CONVERTED_FOLDER]:
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


