import type { NavigateFunction } from "react-router-dom";
import { uploadCellImages, uploadMasks } from '../common/uploadImages'; 
import Swal from 'sweetalert2';
import type { ImageInfo } from '../../types/image';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

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

export const handleRevert = async (navigate: NavigateFunction) => {
    try {
      const imageArrayString = sessionStorage.getItem("imageArray");
      const currentIndexString = sessionStorage.getItem("currentImageIndex");

      if (!imageArrayString || !currentIndexString) {
        await Swal.fire({
          title: "Notice",
          text: "No image available to revert.",
          icon: "info",
          confirmButtonText: "OK",
          confirmButtonColor: "#3085d6"
        });
        return;
      }
  
      const imageArray: ImageInfo[] = JSON.parse(imageArrayString);
      if (!imageArray.length) {
        await Swal.fire({
          title: "Notice",
          text: "No image available to revert.",
          icon: "info",
          confirmButtonText: "OK",
          confirmButtonColor: "#3085d6"
        });
        return;
      }
  
      let currentIndex = parseInt(currentIndexString, 10);
      if (isNaN(currentIndex) || currentIndex < 0 || currentIndex >= imageArray.length) {
        currentIndex = 0;
      }
  
      const currentImage = imageArray[currentIndex];

      const hasChanges =
        !!currentImage.cropped_url ||
        (!!currentImage.last_edited_on &&
          currentImage.last_edited_on !== currentImage.uploaded_on);
  
      if (!hasChanges) {
        await Swal.fire({
          title: "Notice",
          text: "The current image has no changes to revert.",
          icon: "info",
          confirmButtonText: "OK",
          confirmButtonColor: "#3085d6"
        });
        return;
      }

      let originalImage: ImageInfo | undefined;
      try {
        const response = await axios.get(`${API_BASE_URL}/`);
        const serverImages: ImageInfo[] = response.data.images ?? [];
        originalImage = serverImages.find(
          (img) => img.id === currentImage.id || img.filename === currentImage.filename
        );
      } catch (err) {
        console.error("Error fetching original image list:", err);
      }
  
      let reverted: ImageInfo;
  
      if (originalImage) {
        reverted = {
          ...currentImage,
          ...originalImage,
          cropped_url: undefined,
          last_edited_on: originalImage.last_edited_on ?? originalImage.uploaded_on
        };
      } else {
        reverted = {
          ...currentImage,
          cropped_url: undefined,
          last_edited_on: currentImage.uploaded_on
        };
      }
  
      imageArray[currentIndex] = reverted;
  
      sessionStorage.setItem("imageArray", JSON.stringify(imageArray));
      sessionStorage.setItem("currentImageIndex", currentIndex.toString());

      navigate("/display-images", {
        state: { imageArray, currentImageIndex: currentIndex },
        replace: true
      });
  
    } catch (err: any) {
      console.error("Error reverting image:", err);
      await Swal.fire({
        title: "Revert Failed",
        text: err?.message || "An error occurred while reverting the image.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#3085d6"
      });
    }
};    

export const handleClose = async (navigate?: NavigateFunction) => {
    try {
        const imageArrayString = sessionStorage.getItem("imageArray");
        const currentIndexString = sessionStorage.getItem("currentImageIndex");

        if (!imageArrayString) {
            Swal.fire({
                title: 'Notification',
                text: 'No images available to close.',
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
            return;
        }

        const imageArray: ImageInfo[] = JSON.parse(imageArrayString);
        if (!imageArray.length) {
            Swal.fire({
                title: 'Notification',
                text: 'No images available to close.',
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
            return;
        }

        let currentIndex = Math.max(
            0,
            Math.min(
                currentIndexString ? parseInt(currentIndexString, 10) : 0,
                imageArray.length - 1
            )
        );

        const currentImage = imageArray[currentIndex];

        const hasChanges =
            !!currentImage.cropped_url ||
            (!!currentImage.last_edited_on &&
                currentImage.last_edited_on !== currentImage.uploaded_on);

        if (hasChanges) {
            const result = await Swal.fire({
                title: 'Save changes?',
                text: `Do you want to save changes to "${currentImage.filename}" before closing?`,
                icon: 'warning',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Save',
                denyButtonText: "Don't Save",
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#3085d6',
                denyButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
            });

            if (result.isConfirmed) {
                try {
                    const tiffBlob = await convertImageToTIFF(currentImage);
                    const saveFilename = generateSaveFilename(currentImage);

                    const dirHandle = await (window as any).showDirectoryPicker({
                        mode: 'readwrite'
                    });

                    let fileExists = false;
                    try {
                        await dirHandle.getFileHandle(saveFilename, { create: false });
                        fileExists = true;
                    } catch (existErr: any) {
                        if (existErr?.name !== 'NotFoundError') throw existErr;
                    }

                    if (fileExists) {
                        const overwrite = await Swal.fire({
                            title: 'File Already Exists',
                            text: `The file "${saveFilename}" already exists. Overwrite?`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Overwrite',
                            cancelButtonText: 'Cancel',
                            confirmButtonColor: '#3085d6',
                            cancelButtonColor: '#d33',
                        });
                        if (!overwrite.isConfirmed) return; // hủy đóng nếu không overwrite
                    }

                    const fileHandle = await dirHandle.getFileHandle(saveFilename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(tiffBlob);
                    await writable.close();

                    await Swal.fire({
                        title: 'Saved',
                        text: `Saved "${saveFilename}".`,
                        icon: 'success',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#3085d6',
                    });
                } catch (saveErr: any) {
                    console.error('Save single image failed:', saveErr);
                    await Swal.fire({
                        title: 'Error',
                        text: saveErr?.message || 'Failed to save the image.',
                        icon: 'error',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#3085d6',
                    });
                    return;
                }
            } else if (result.isDismissed) {
                return;
            }
        }

        const nextArray = [...imageArray];
        nextArray.splice(currentIndex, 1);

        if (nextArray.length === 0) {
            sessionStorage.removeItem("imageArray");
            sessionStorage.removeItem("currentImageIndex");
            if (navigate) {
                navigate("/display-images", { state: { imageArray: [] }, replace: true });
            } else {
                window.location.reload();
            }
            return;
        }

        if (currentIndex >= nextArray.length) currentIndex = nextArray.length - 1;

        sessionStorage.setItem("imageArray", JSON.stringify(nextArray));
        sessionStorage.setItem("currentImageIndex", currentIndex.toString());

        if (navigate) {
            navigate("/display-images", {
                state: { imageArray: nextArray, currentImageIndex: currentIndex },
                replace: true
            });
        } else {
            window.location.reload();
        }
    } catch (err: any) {
        console.error('Error closing image:', err);
        Swal.fire({
            title: 'Error',
            text: err?.message || 'Failed to close the image.',
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#3085d6',
        });
    }
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


const generateSaveFilename = (image: ImageInfo): string => {
    const baseFilename = image.filename.replace(/\.[^/.]+$/, '');
    return `${baseFilename}.tif`;
};

const convertImageToTIFF = async (image: ImageInfo): Promise<Blob> => {
    try {
        const imageUrl = image.cropped_url || image.url;
        if (!imageUrl) {
            throw new Error(`No URL found for image: ${image.filename}`);
        }

        const requestData: { image_data?: string; image_url?: string; filename: string } = {
            filename: image.filename
        };

        if (image.cropped_url && image.cropped_url.startsWith('data:')) {
            requestData.image_data = image.cropped_url;
        } else {
            requestData.image_url = imageUrl;
        }

        const response = await axios.post(
            `${API_BASE_URL}/save`,
            requestData,
            {
                responseType: 'blob',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error: any) {
        console.error(`Error converting image ${image.filename} to TIFF:`, error);
        throw new Error(`Failed to convert image to TIFF: ${error.message}`);
    }
};

export const handleSave = async () => {
    try {
        const imageArrayString = sessionStorage.getItem("imageArray");
        if (!imageArrayString) {
            Swal.fire({
                title: 'Notification',
                text: 'No images available to save.',
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
            return;
        }

        const imageArray: ImageInfo[] = JSON.parse(imageArrayString);
        if (!imageArray || imageArray.length === 0) {
            Swal.fire({
                title: 'Notification',
                text: 'No images available to save.',
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
            return;
        }

        const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite'
        });

        let savedCount = 0;
        let skippedCount = 0;
        const totalCount = imageArray.length;
        const errors: string[] = [];
        let overwriteAll = false;

        for (const image of imageArray) {
            try {
                const tiffBlob = await convertImageToTIFF(image);    
                const saveFilename = generateSaveFilename(image);
                let fileExists = false;
                try {
                    await dirHandle.getFileHandle(saveFilename, { create: false });
                    fileExists = true;
                } catch (existError: any) {
                    if (existError?.name !== 'NotFoundError') {
                        throw existError;
                    }
                }

                if (fileExists) {
                    if (!overwriteAll) {
                        const overwriteResult = await Swal.fire({
                            title: 'File Already Exists',
                            text: `The file "${saveFilename}" already exists. What would you like to do?`,
                            icon: 'warning',
                            showCancelButton: true,
                            showDenyButton: true,
                            confirmButtonText: 'Overwrite',
                            denyButtonText: 'Overwrite All',
                            cancelButtonText: 'Skip',
                            confirmButtonColor: '#3085d6',
                            denyButtonColor: '#3085d6',
                            cancelButtonColor: '#d33',
                        });

                        if (overwriteResult.isDenied) {
                            overwriteAll = true;
                        } else if (!overwriteResult.isConfirmed) {
                            skippedCount++;
                            continue;
                        }
                    }
                }

                const fileHandle = await dirHandle.getFileHandle(saveFilename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(tiffBlob);
                await writable.close();

                savedCount++;
            } catch (error: any) {
                console.error(`Error saving image ${image.filename}:`, error);
                errors.push(`${image.filename}: ${error.message}`);
            }
        }

        if (savedCount === totalCount) {
            Swal.fire({
                title: 'Success',
                text: `Successfully saved ${savedCount} image(s) as TIFF files to the selected folder.`,
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
        } else if (savedCount > 0) {
            const partialDetails = [
                `Saved ${savedCount} out of ${totalCount} image(s).`,
                skippedCount > 0 ? `${skippedCount} file(s) were skipped because overwrite was declined.` : null,
                errors.length > 0 ? `${errors.length} file(s) failed to save.${errors.length > 0 ? '\n\nErrors:\n' + errors.slice(0, 3).join('\n') : ''}` : null
            ].filter(Boolean).join('\n\n');

            Swal.fire({
                title: 'Partial Success',
                text: partialDetails,
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
        } else if (skippedCount === totalCount && errors.length === 0) {
            Swal.fire({
                title: 'No Files Overwritten',
                text: 'All files were skipped because overwrite was declined. Existing files remain unchanged.',
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
        } else {
            Swal.fire({
                title: 'Error',
                text: `Failed to save images.${errors.length > 0 ? '\n\nErrors:\n' + errors.slice(0, 3).join('\n') : ''}`,
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
        }
    } catch (err: any) {
        if (err.name === 'AbortError' || err.name === 'SecurityError') {
            return;
        }
        console.error("Error saving images:", err);
        Swal.fire({
            title: 'Error',
            text: err.message || "Failed to save images. Please try again.",
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

