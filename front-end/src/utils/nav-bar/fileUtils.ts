import type { NavigateFunction } from "react-router-dom";
import { uploadCellImages, uploadMasks } from '../common/uploadImages'; 
import Swal from 'sweetalert2';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

export const FILE_MENU_EVENT_NAME = 'fileMenuAction';
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

export const handleNewWindow = () => {
    const newWindow = window.open('about:blank', '_blank');
    
    if (newWindow) {
      newWindow.location.href = 'http://localhost:5173/?newWindow=true';
      newWindow.focus();
    } else {
      Swal.fire({
        title: 'Notification',
        text: 'Your browser is blocking pop-ups. Please allow pop-ups to open in new windows.',
        icon: 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
    } 
};

export const handleOpen = (navigate: NavigateFunction) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;

  input.onchange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    await uploadCellImages(files, navigate, false);
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

export const handleRevert = (_navigate: NavigateFunction) => {
    dispatchFileMenuAction('REVERT');
};
  
export const handleClose = (_navigate?: NavigateFunction) => {
  dispatchFileMenuAction('CLOSE');
};
  
export const handleCloseAll = (_navigate: NavigateFunction) => {
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

