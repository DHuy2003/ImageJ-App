import type { NavigateFunction } from "react-router-dom";
import { uploadCellImages, uploadMasks } from '../common/uploadImages'; 
import Swal from 'sweetalert2';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

export const FILE_MENU_EVENT_NAME = 'fileMenuAction';
export const IMAGES_APPENDED_EVENT = 'imagesAppended';
export type FileMenuActionType = 'REVERT' | 'CLOSE' | 'CLOSE_ALL' | 'SAVE' | 'SAVE_ALL';
export type FileMenuActionPayload = {
  type: FileMenuActionType;
};

const dispatchFileMenuAction = (type: FileMenuActionType) => {
  window.dispatchEvent(
    new CustomEvent<FileMenuActionPayload>(FILE_MENU_EVENT_NAME, {
      detail: { type },
    })
  );
};

let hasDataset = true;
if (typeof window !== 'undefined') {
  window.addEventListener('datasetCleared', () => {
    hasDataset = false;
  });
}

export const handleOpen = (navigate: NavigateFunction) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;

  input.onchange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("images", file));

    try {
      const response = await axios.post(`${API_BASE_URL}/upload-cells`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newUploadedImages =
        response.data.images ?? response.data.uploaded ?? [];

      await Swal.fire({
        title: 'Success',
        text: `${newUploadedImages.length} cell images uploaded and processed.`,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });

      if (!hasDataset && navigate) {
        navigate("/display-images", { replace: true });
      } else {
        window.dispatchEvent(
          new CustomEvent(IMAGES_APPENDED_EVENT, {
            detail: newUploadedImages,
          })
        );
      }

      hasDataset = true;
    } catch (error: any) {
      console.error("Error uploading cell images (append):", error);
      await Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || "Failed to upload cell images. Please try again.",
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
    }
  };
  input.click();
};

export const handleOpenFolder = async (navigate: NavigateFunction) => {
  try {
    const dirHandle = await (window as any).showDirectoryPicker();
    const files: File[] = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        const file = await entry.getFile();
        if (file.type.startsWith("image/") || /\.(tif|tiff)$/i.test(file.name)) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) {
      Swal.fire({
        title: 'Notification',
        text: 'No image files found in this folder.',
        icon: 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    await axios.post(`${API_BASE_URL}/reset`);

    await uploadCellImages(files, navigate, false);
  
  } catch (err: any) {
    console.error("Error opening folder:", err);
    Swal.fire({
      title: 'Error',
      text: err.message || "Failed to open folder.",
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });
  }
};
  
export const handleOpenMaskFolder = async (navigate: NavigateFunction) => {
  try {
    const dirHandle = await (window as any).showDirectoryPicker();
    const files: File[] = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        const file = await entry.getFile();
        if (file.type.startsWith("image/") || /\.(tif|tiff)$/i.test(file.name)) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) {
      Swal.fire({
        title: 'Notification',
        text: 'No files found in the mask folder.',
        icon: 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    await uploadMasks(files, navigate);

  } catch (err: any) {
    console.error("Error opening mask folder:", err);
    Swal.fire({
      title: 'Error',
      text: err.message || "Failed to open mask folder.",
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });
  }
};

export const handleRevert = () => {
    dispatchFileMenuAction('REVERT');
};
  
export const handleClose = () => {
  dispatchFileMenuAction('CLOSE');
};
  
export const handleCloseAll = () => {
  dispatchFileMenuAction('CLOSE_ALL');
};
  
export const handleSave = () => {
  dispatchFileMenuAction('SAVE');
};

export const handleSaveAll = async () => {
  dispatchFileMenuAction('SAVE_ALL');
};

export const handleQuit = async (navigate: NavigateFunction) => {
    const result = await Swal.fire({
      title: 'Do you want to quit',
      text: 'The database will not be saved. Do you want to continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Quit',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
    });
  
    if (!result.isConfirmed) return;
  
    try {
      await axios.post(`${API_BASE_URL}/reset`);
    } catch (err) {
      console.error("Error resetting dataset on quit:", err);
    }
  
    navigate('/');
};

