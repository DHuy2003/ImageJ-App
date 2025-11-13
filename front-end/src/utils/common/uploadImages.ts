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

    const newUploadedImages: ImageInfo[] = response.data.images ?? [];
    let imagesToStore: ImageInfo[] = [];

    if (isNewWindow) {
      sessionStorage.removeItem("imageArray");
      imagesToStore = newUploadedImages;
    } else {
      const existingImageArrayString = sessionStorage.getItem("imageArray");
      if (existingImageArrayString) {
        imagesToStore = JSON.parse(existingImageArrayString) as ImageInfo[];
      }
      newUploadedImages.forEach((newImg) => {
        const idx = imagesToStore.findIndex(
          (img) => img.id === newImg.id || img.filename === newImg.filename
        );

        if (idx >= 0) {
          const oldImg = imagesToStore[idx];

          imagesToStore[idx] = {
            ...oldImg,
            ...newImg,
            cropped_url: oldImg.cropped_url ?? newImg.cropped_url,
            last_edited_on: newImg.last_edited_on ?? oldImg.last_edited_on,
          };
        } else {
          imagesToStore.push(newImg);
        }
      });
    }
    sessionStorage.setItem("imageArray", JSON.stringify(imagesToStore));
    sessionStorage.setItem("currentImageIndex", "0");

    navigate("/display-images", {
      state: {
        imageArray: imagesToStore,
        isNewWindow: isNewWindow,
      },
      replace: !isNewWindow,
    });

    Swal.fire({
      title: 'Success',
      text: `${newUploadedImages.length} cell images uploaded and processed. Linking with masks will be automatic.`,
      icon: 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
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

    Swal.fire({
      title: 'Success',
      text: `Mask images uploaded and processed. Linking with cell images is automatic.`,
      icon: 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });

    const allImagesResponse = await axios.get(`${API_BASE_URL}/`);
    const updatedImageArray: ImageInfo[] = allImagesResponse.data.images ?? [];

    const existingImageArrayString = sessionStorage.getItem("imageArray");
    let imagesToStore: ImageInfo[];

    if (!existingImageArrayString) {
      imagesToStore = updatedImageArray;
    } else {
      const existingImages: ImageInfo[] = JSON.parse(existingImageArrayString) as ImageInfo[];

      imagesToStore = existingImages.map((img) => {
        const updated = updatedImageArray.find(
          (u) => u.id === img.id || u.filename === img.filename
        );

        if (!updated) {
          return img;
        }

        return {
          ...img,
          ...updated,
          cropped_url: img.cropped_url ?? updated.cropped_url,
          last_edited_on: updated.last_edited_on ?? img.last_edited_on,
        };
      });
    }

    sessionStorage.setItem("imageArray", JSON.stringify(imagesToStore));
    sessionStorage.setItem("currentImageIndex", "0");

    navigate("/display-images", {
      state: { imageArray: imagesToStore },
      replace: true,
    });

  } catch (error: any) {
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

