import axios from 'axios';
import type { NavigateFunction } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { ImageInfo } from '../../types/image';
import { getSessionId } from './getSessionId';

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
        "X-Session-Id": getSessionId(),
      },
    });

    const newUploadedImages: ImageInfo[] =
      response.data.images ?? response.data.uploaded ?? [];

    Swal.fire({
      title: 'Success',
      text: `${newUploadedImages.length} cell images uploaded and processed. Linking with masks will be automatic.`,
      icon: 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });

    navigate("/display-images", {
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

export const uploadMasks = async (
  files: FileList | File[] | null,
  navigate: NavigateFunction
) => {
  if (!files || files.length === 0) {
    console.warn("No files selected for mask upload.");
    return;
  }

  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("masks", file));

  try {
    await axios.post(`${API_BASE_URL}/upload-masks`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Session-Id": getSessionId(),
      },
    });

    Swal.fire({
      title: 'Success',
      text: `Mask images uploaded and processed. Linking with cell images is automatic.`,
      icon: 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });

    navigate("/display-images", {
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

