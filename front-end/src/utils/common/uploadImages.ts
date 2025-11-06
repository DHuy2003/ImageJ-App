import axios from 'axios';
import type { NavigateFunction } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { ImageInfo } from '../../types/image';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

export const uploadCellImages = async (
  files: FileList | File[] | null,
  navigate: NavigateFunction,
  isNewWindow: boolean
) => {
  if (!files || files.length === 0) {
    console.warn("No files selected for cell image upload.");
    return;
  }

  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("images", file));

  try {
    const response = await axios.post(`${API_BASE_URL}/upload-cells`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    const newImageArray: ImageInfo[] = response.data.images;
    let combinedArray: ImageInfo[] = [];

    const existingImageArrayString = sessionStorage.getItem("imageArray");
    let existingImagesMap = new Map<string, ImageInfo>();

    if (existingImageArrayString) {
        const parsedExistingArray: ImageInfo[] = JSON.parse(existingImageArrayString);
        parsedExistingArray.forEach(img => existingImagesMap.set(img.filename, img));
    }

    newImageArray.forEach(newImg => {
        existingImagesMap.set(newImg.filename, newImg);
    });

    combinedArray = Array.from(existingImagesMap.values());

    if (isNewWindow) {
      sessionStorage.removeItem("imageArray"); 
      combinedArray = newImageArray; 
    }
    
    sessionStorage.setItem("imageArray", JSON.stringify(combinedArray));
    sessionStorage.setItem("currentImageIndex", "0"); 
    navigate("/display-images", {
      state: {
        imageArray: combinedArray,
        isNewWindow: isNewWindow,
      },
      replace: !isNewWindow,
    });
  } catch (error: any) {
    console.error("Error uploading cell images:", error);
    Swal.fire({
      title: 'Error',
      text: error.response?.data?.message || "Failed to upload cell images. Please try again.",
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });
  }
};

export const uploadMasks = async (files: FileList | File[] | null, navigate: NavigateFunction) => {
  if (!files || files.length === 0) {
    console.warn("No files selected for mask upload.");
    return;
  }

  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("masks", file));

  try {
    const response = await axios.post(`${API_BASE_URL}/upload-masks`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.data.masks && response.data.masks.length > 0) {
      Swal.fire({
        title: 'Success',
        text: `${response.data.masks.length} masks uploaded and linked.`,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
    } else {
      Swal.fire({
        title: 'Notification',
        text: 'No masks were uploaded or linked. Ensure filenames match cell images (e.g., mask_001.tif for t001.tif).',
        icon: 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
    }

    const allImagesResponse = await axios.get(`${API_BASE_URL}/`);
    const updatedImageArray: ImageInfo[] = allImagesResponse.data.images;

    sessionStorage.setItem("imageArray", JSON.stringify(updatedImageArray));
    navigate("/display-images", {
      state: { imageArray: updatedImageArray },
      replace: true,
    });

  } catch (error) {
    console.error("Error uploading masks:", error);
    Swal.fire({
      title: 'Error',
      text: "Failed to upload masks.",
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });
  }
};
