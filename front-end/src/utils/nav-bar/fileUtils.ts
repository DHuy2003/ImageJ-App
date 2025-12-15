import type { NavigateFunction } from "react-router-dom";
import { uploadCellImages, uploadMasks } from '../common/uploadImages'; 
import Swal from 'sweetalert2';
import axios from 'axios';
import { getSessionId } from "../common/getSessionId";

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

const naturalSort = (a: File, b: File): number => {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
};

export const FILE_MENU_EVENT_NAME = 'fileMenuAction';
export const IMAGES_APPENDED_EVENT = 'imagesAppended';
export const VIRTUAL_SEQUENCE_IMPORT_EVENT = 'openVirtualSequenceImport';
export type FileMenuActionType =
  | 'REVERT'
  | 'CLOSE'
  | 'CLOSE_ALL'
  | 'SAVE'
  | 'SAVE_ALL'
  | 'EXPORT_ALL';
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

let hasDataset = false;
if (typeof window !== 'undefined') {
  window.addEventListener('datasetCleared', () => {
    hasDataset = false;
  });
}

export const handleNewFile = (navigate: NavigateFunction) => {
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
        headers: { 
          "Content-Type": "multipart/form-data",
          "X-Session-Id": getSessionId(),
        },
      });

      const newUploadedImages =
        response.data.images ?? response.data.uploaded ?? [];

      if (!hasDataset && navigate) {
        navigate("/display-images", { replace: true });
        Swal.fire({
          title: 'Success',
          text: `${newUploadedImages.length} cell images uploaded and processed.`,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
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
    files.sort(naturalSort);

    await axios.post(
      `${API_BASE_URL}/reset`,
      null,
      {
        headers: {
          "X-Session-Id": getSessionId(),
        },
      }
    );

    await uploadCellImages(files, navigate, false);
  
  } catch (err: any) {
    console.error("Error opening folder:", err);
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
    files.sort(naturalSort);

    await uploadMasks(files, navigate);

  } catch (err: any) {
    console.error("Error opening mask folder:", err);
  }
};

export const handleCreateMask = () => {
  const event = new CustomEvent('createMask');
  window.dispatchEvent(event);
};

export const handleVirtualSequence = () => {
  window.dispatchEvent(new Event(VIRTUAL_SEQUENCE_IMPORT_EVENT));
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
      await axios.post(
        `${API_BASE_URL}/reset`,
        null,
        {
          headers: {
            "X-Session-Id": getSessionId(),
          },
        }
      );
    } catch (err) {
      console.error("Error resetting dataset on quit:", err);
    }
  
    navigate('/');
};

export const handleExportAll = () => {
  dispatchFileMenuAction('EXPORT_ALL');
};
