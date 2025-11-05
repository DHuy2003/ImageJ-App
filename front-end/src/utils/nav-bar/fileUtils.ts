import type { NavigateFunction } from "react-router-dom";
import { uploadCellImages, uploadMasks } from '../common/uploadImages'; // Import new functions
import Swal from 'sweetalert2';

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

export const handleOpenNext = (navigate: NavigateFunction) => {
    const imageArrayString = sessionStorage.getItem("imageArray");
    const currentIndexString = sessionStorage.getItem("currentImageIndex");

    if (!imageArrayString || !currentIndexString) {
        alert('No folder opened or no images to navigate.');
        return;
    }

    try {
        const imageArray = JSON.parse(imageArrayString);
        let currentIndex = parseInt(currentIndexString, 10);

        if (currentIndex < imageArray.length - 1) {
            currentIndex += 1;
            sessionStorage.setItem("currentImageIndex", currentIndex.toString());
            navigate("/display-images", { state: { imageArray: imageArray, currentImageIndex: currentIndex }, replace: true });
        } else {
            alert('This is the last image in the folder.');
        }
    } catch (error) {
        console.error("Error parsing image data from session storage:", error);
        alert('Failed to load image data. Please try opening the folder again.');
    }
};

export const handleOpenRecent = () => {
    console.log("Open Recent Clicked");
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

export const handleClose = () => {
    console.log("Close Clicked");
};

export const handleCloseAll = (navigate: NavigateFunction) => {  
    const imageArray = sessionStorage.getItem("imageArray");
    if (!imageArray) {
        Swal.fire({
            title: 'Notification',
            text: 'No images available to close.',
            icon: 'info',
            confirmButtonText: 'OK',
            confirmButtonColor: '#3085d6',
        });
        return; 
    }
    Swal.fire({
        title: 'Notification',
        text: 'Some images are changed. Are you sure to close all images without saving them?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.removeItem("imageArray");
            navigate("/display-images", { state: { imageArray: [] }, replace: true });
        }
    });
};

export const handleSave = () => {
    console.log("Save Clicked");
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

export const handleQuit = (navigate: NavigateFunction) => {
    window.close(); 
    navigate('/');
};

