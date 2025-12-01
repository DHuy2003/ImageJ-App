import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';
import type { ImageInfo, ImageViewProps } from '../../../types/image';
import {
  FILE_MENU_EVENT_NAME,
  type FileMenuActionPayload,
} from '../../../utils/nav-bar/fileUtils';

const API_BASE_URL = "http://127.0.0.1:5000/api/images";

type UseFileEventsParams ={
  imageArray: ImageViewProps['imageArray'];
  setImageArray: Dispatch<SetStateAction<ImageInfo[]>>;
  currentIndex: number;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  currentFile: ImageInfo | null;
  currentImageURL: string | null;
  setCurrentImageURL: (url: string | null) => void;
}

const useFileEvents = ({
  imageArray,
  setImageArray,
  currentIndex,
  setCurrentIndex,
  currentFile,
  currentImageURL,
  setCurrentImageURL,
}: UseFileEventsParams) => {

const generateSaveFilename = (image: ImageInfo): string => {
  const baseFilename =
    image.filename?.replace(/\.[^/.]+$/, '') ||
    (image as any).edited_filename?.replace(/\.[^/.]+$/, '') ||
    'image';
  return `${baseFilename}.tif`;
};
  
const convertImageToTIFF = async (image: ImageInfo): Promise<Blob> => {
  try {
    let imageUrl: string | undefined | null =
      (image as any).cropped_url || (image as any).url;

    if (!imageUrl && (image as any).edited_url) {
      imageUrl = (image as any).edited_url as string;
    }

    if (!imageUrl && (image as any).edited_filepath) {
      const fullPath = (image as any).edited_filepath as string;
      const filename = fullPath.split(/[/\\]/).pop();
      if (filename) {
        imageUrl = `${API_BASE_URL}/edited/${filename}`;
      }
    }

    if (!imageUrl) {
      throw new Error(
        `No URL found for image: ${
          image.filename ?? (image as any).edited_filepath ?? 'unknown'
        }`,
      );
    }
  
      const requestData: {
        image_data?: string;
        image_url?: string;
        filename: string;
      } = {
        filename:
          image.filename ??
          (image as any).edited_filename ??
          'image',
      };
  
      if ((image as any).cropped_url && (image as any).cropped_url.startsWith('data:')) {
        requestData.image_data = (image as any).cropped_url;
      } else {
        requestData.image_url = imageUrl;
      }
  
      const response = await axios.post(`${API_BASE_URL}/save`, requestData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'application/json' },
      });
  
      return response.data;
    } catch (error: any) {
      console.error(
        `Error converting image ${image.filename} to TIFF:`,
        error,
      );
      throw new Error(`Failed to convert image to TIFF: ${error.message}`);
    }
  };

  useEffect(() => {
    const hasUnsavedImageChanges = () => {
      if (!currentFile || !currentImageURL) return false;
      if (currentImageURL.startsWith('data:')) return true;
      if (currentImageURL.startsWith('blob:')) return true;
      return false;
    };
    
    const hasUnsavedMaskChanges = () => {
      if (!currentFile || !currentFile.mask_url) return false;
      return currentFile.mask_url.startsWith('data:');
    };

    const hasUnsavedChanges = () => {
      return hasUnsavedImageChanges() || hasUnsavedMaskChanges();
    };

    const saveCurrentImage = async () => {
      if (!currentFile) {
        await Swal.fire({
          title: 'Notice',
          text: 'No image to save.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return false;
      }
    
      const unsavedImage = hasUnsavedImageChanges();
      const unsavedMask = hasUnsavedMaskChanges();
    
      if (!unsavedImage && !unsavedMask) {
        await Swal.fire({
          title: 'Notice',
          text: 'The image has no changes to save.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return false;
      }
    
      if (!(window as any).showDirectoryPicker) {
        await Swal.fire({
          title: 'Notification',
          text: 'Your browser does not support choosing a folder (File System Access API).',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return false;
      }
    
      let dirHandle: any;
      try {
        dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
          return false;
        }
        console.error('Error choosing folder:', err);
        // await Swal.fire({
        //   title: 'Error',
        //   text: err.message || 'Failed to choose folder to save image.',
        //   icon: 'error',
        //   confirmButtonText: 'OK',
        //   confirmButtonColor: '#3085d6',
        // });
        return false;
      }
    
      try {
        let updatedImageInfo: ImageInfo & { edited_url?: string | null } = currentFile as any;
        let editedUrl: string | null = null;

        if (unsavedImage && currentImageURL) {
          const res = await fetch(currentImageURL);
          const blob = await res.blob();
    
          const formData = new FormData();
          formData.append(
            'edited',
            blob,
            `${currentFile.filename || 'image'}_edited.png`,
          );
    
          const response = await axios.post(
            `${API_BASE_URL}/update/${currentFile.id}`,
            formData,
            {
              headers: { 'Content-Type': 'multipart/form-data' },
            },
          );
    
          const updated = response.data
            .image as ImageInfo & {
            edited_filepath?: string;
            edited_url?: string;
          };
    
          editedUrl = (updated as any).edited_url || null;
    
          if (!editedUrl && updated.edited_filepath) {
            const filename = updated.edited_filepath
              .split(/[/\\]/)
              .pop();
            if (filename) {
              editedUrl = `${API_BASE_URL}/edited/${filename}`;
            }
          }

          updatedImageInfo = {
            ...updatedImageInfo,
            ...updated,
            ...(editedUrl
              ? {
                  url: editedUrl,
                  edited_url: editedUrl,
                  status: 'edited',
                }
              : {}),
          } as any;
    
          setImageArray((prev) => {
            const copy = [...prev];
            if (copy[currentIndex]) {
              copy[currentIndex] = updatedImageInfo;
            }
            return copy;
          });
    
          if (editedUrl) {
            setCurrentImageURL(editedUrl);
          }
        }

        if (unsavedMask && currentFile.mask_url) {
          try {
            const maskRes = await fetch(currentFile.mask_url);
            const maskBlob = await maskRes.blob();
    
            const maskForm = new FormData();
            maskForm.append(
              'mask',
              maskBlob,
              `${currentFile.filename || 'image'}_mask.png`,
            );
    
            const maskResponse = await axios.post(
              `${API_BASE_URL}/update-mask/${currentFile.id}`,
              maskForm,
              { headers: { 'Content-Type': 'multipart/form-data' } },
            );
    
            const maskUpdated = maskResponse.data.image as {
              mask_filepath: string;
              mask_url: string;
              mask_filename: string;
            };
    
            updatedImageInfo = {
              ...updatedImageInfo,
              ...maskUpdated,
            } as any;
    
            setImageArray((prev) => {
              const copy = [...prev];
              if (copy[currentIndex]) {
                copy[currentIndex] = {
                  ...copy[currentIndex],
                  ...maskUpdated,
                } as any;
              }
              return copy;
            });
          } catch (err) {
            console.error('Error saving mask:', err);
          }
        }

        try {
          const imageForTiff: ImageInfo = {
            ...(updatedImageInfo as any),
            ...(editedUrl ? { url: editedUrl } : {}),
          } as ImageInfo;
    
          const tiffBlob = await convertImageToTIFF(imageForTiff);
          const saveFilename = generateSaveFilename(imageForTiff);
    
          const fileHandle = await dirHandle.getFileHandle(
            saveFilename,
            { create: true },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(tiffBlob);
          await writable.close();
        } catch (err: any) {
          console.error('Error saving TIFF:', err);
          await Swal.fire({
            title: 'Warning',
            text:
              'Image/mask was saved to database but failed to save TIFF file to the selected folder.',
            icon: 'warning',
            confirmButtonText: 'OK',
            confirmButtonTextColor: '#fff',
            confirmButtonColor: '#3085d6',
          } as any);
        }
    
        await Swal.fire({
          title: 'Saved',
          text: 'Image and mask have been saved to the selected folder and updated in the database.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
    
        return true;
      } catch (err: any) {
        console.error('Error saving image/mask:', err);
        await Swal.fire({
          title: 'Error',
          text: err.message || 'Failed to save edited image/mask.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return false;
      }
    };    

    const saveAllImages = async () => {
      if (!imageArray || imageArray.length === 0) {
        await Swal.fire({
          title: 'Notice',
          text: 'No images available to save.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
    
      if (!(window as any).showDirectoryPicker) {
        await Swal.fire({
          title: 'Error',
          text: 'Your browser does not support folder selection.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
    
      let dirHandle;
      try {
        dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      } catch {
        return;
      }
    
      for (let i = 0; i < imageArray.length; i++) {
        const img = imageArray[i];
    
        let finalImage = img;
        let editedUrl: string | null = null;
    
        const needSaveImageDB =
          (img.url && img.url.startsWith('data:')) ||
          ((img as any).cropped_url && (img as any).cropped_url.startsWith('data:'));
    
        const needSaveMaskDB =
          typeof img.mask_url === 'string' && img.mask_url.startsWith('data:');

        if (needSaveImageDB) {
          try {
            const cropped = (img as any).cropped_url as string | undefined;
            let sourceUrl: string | null = null;

            if (cropped && cropped.startsWith('data:')) {
              sourceUrl = cropped;
            } else if (img.url && img.url.startsWith('data:')) {
              sourceUrl = img.url;
            } else if (cropped) {
              sourceUrl = cropped;
            } else if (img.url) {
              sourceUrl = img.url;
            }

            if (!sourceUrl) {
              console.error('No source URL for saving image id =', img.id);
              continue;
            }

            const res = await fetch(sourceUrl);
            const blob = await res.blob();
    
            const formData = new FormData();
            formData.append('edited', blob, `${img.filename || 'image'}_edited.png`);
    
            const response = await axios.post(
              `${API_BASE_URL}/update/${img.id}`,
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } },
            );
    
            const updated = response.data.image as ImageInfo & {
              edited_filepath?: string;
              edited_url?: string;
            };
    
            if (updated.edited_filepath) {
              const filename = updated.edited_filepath.split(/[/\\]/).pop();
              if (filename) {
                editedUrl = `${API_BASE_URL}/edited/${filename}`;
              }
            } else if ((updated as any).edited_url) {
              editedUrl = (updated as any).edited_url as string;
            }
    
            finalImage = {
              ...img,
              ...updated,
              url: editedUrl ?? img.url,
              edited_url: editedUrl ?? img.edited_url,
              status: 'edited',
              cropped_url: null as any,
            };
    
            setImageArray((prev) => {
              const copy = [...prev];
              copy[i] = finalImage;
              return copy;
            });
          } catch (err) {
            console.error('Save DB fail (image): ', err);
            continue;
          }
        }

        if (needSaveMaskDB && img.mask_url) {
          try {
            const maskRes = await fetch(img.mask_url);
            const maskBlob = await maskRes.blob();
    
            const maskForm = new FormData();
            maskForm.append(
              'mask',
              maskBlob,
              `${img.filename || 'image'}_mask.png`,
            );
    
            const maskResp = await axios.post(
              `${API_BASE_URL}/update-mask/${img.id}`,
              maskForm,
              { headers: { 'Content-Type': 'multipart/form-data' } },
            );
    
            const maskUpdated = maskResp.data.image as {
              mask_filepath: string;
              mask_url: string;
              mask_filename: string;
            };
    
            finalImage = {
              ...finalImage,
              ...maskUpdated,
            };
    
            setImageArray((prev) => {
              const copy = [...prev];
              copy[i] = {
                ...copy[i],
                ...maskUpdated,
              } as any;
              return copy;
            });
          } catch (err) {
            console.error('Save mask fail: ', err);
          }
        }

        try {
          const tiffBlob = await convertImageToTIFF(finalImage);
    
          const saveFilename = generateSaveFilename(finalImage);
    
          const fileHandle = await dirHandle.getFileHandle(saveFilename, {
            create: true,
          });
    
          const writable = await fileHandle.createWritable();
          await writable.write(tiffBlob);
          await writable.close();
        } catch (err) {
          console.error('TIFF conversion failed: ', err);
        }
      }
    
      await Swal.fire({
        title: 'Saved',
        text: 'All images have been saved to the selected folder.',
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
    };        
  
    const revertCurrentImage = async () => {
      if (!currentFile){
        await Swal.fire({
          title: 'Notice',
          text: 'No image to revert.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }

      const hasSavedEdit =
        currentFile.status === 'edited' ||
        !!(currentFile as any).edited_url;
  
      if (!hasUnsavedChanges() && !hasSavedEdit) {
        await Swal.fire({
          title: 'Notice',
          text: 'Image has no changes to revert.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
  
      const result = await Swal.fire({
        title: 'Revert to original?',
        text: 'All changes for this image will be discarded.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Revert',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
      });
  
      if (!result.isConfirmed) return;
  
      try {
        const response = await axios.post(
          `${API_BASE_URL}/revert/${currentFile.id}`,
        );
        const updated = response.data.image as ImageInfo;
  
        setImageArray(prev => {
          const copy = [...prev];
          if (copy[currentIndex]) {
            copy[currentIndex] = {
              ...copy[currentIndex],
              ...updated,
              cropped_url: (updated as any).cropped_url ?? null,
              edited_url: (updated as any).edited_url ?? null,
            };
          }
          return copy;
        });
  
        const newUrl = (updated as any).cropped_url ?? (updated as any).edited_url ?? updated.url ?? null;
        if (newUrl) {
          setCurrentImageURL(newUrl);
        }
  
        await Swal.fire({
          title: 'Reverted',
          text: 'Image has been reverted to the original version.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
      } catch (err) {
        console.error('Error reverting image:', err);
        await Swal.fire({
          title: 'Error',
          text: 'Failed to revert image.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
      }
    };
  
    const closeCurrentImage = async () => {
      if (!currentFile || imageArray.length === 0){
        await Swal.fire({
          title: 'Notice',
          text: 'No image to close.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
  
      if (hasUnsavedChanges()) {
        const result = await Swal.fire({
          title: 'Save changes?',
          text: 'The current image has unsaved. Are you sure you want to close it?',
          icon: 'warning',
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'Save',
          denyButtonText: "Don't save",
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#3085d6',
          denyButtonColor: '#d33',
        });
  
        if (result.isConfirmed) {
          const ok = await saveCurrentImage();
          if (!ok) {
            return;
          }
        } else if (result.isDenied) {

        } else {
          return;
        }
      }
  
      try {
        await axios.delete(`${API_BASE_URL}/delete/${currentFile.id}`);
      } catch (err) {
        console.error('Error deleting image from DB:', err);
        await Swal.fire({
          title: 'Error',
          text: 'Failed to delete image. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
  
      const wasLastImage = imageArray.length <= 1;
  
      setImageArray(prev => {
        if (prev.length <= 1) {
          return [];
        }
        const copy = [...prev];
        copy.splice(currentIndex, 1);
        return copy;
      });
  
      if (wasLastImage) {
        setCurrentIndex(0);
        setCurrentImageURL(null);
        window.dispatchEvent(new Event('datasetCleared'));
      } else {
        setCurrentIndex(prev => {
          if (prev >= imageArray.length - 1) {
            return imageArray.length - 2;
          }
          return prev;
        });
      }
    };
  
    const closeAllImages = async () => {
      if (imageArray.length === 0){
        await Swal.fire({
          title: 'Notice',
          text: 'No image to close.',
          icon: 'info',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
  
      const result = await Swal.fire({
        title: 'Close all images?',
        text: 'All images in the current dataset will be closed without changes.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
      });
  
      if (!result.isConfirmed) return;
  
      try {
        await axios.post(`${API_BASE_URL}/reset`);
      } catch (err) {
        console.error('Error resetting dataset from DB:', err);
        await Swal.fire({
          title: 'Error',
          text: 'Failed to delete all images. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6',
        });
        return;
      }
  
      setImageArray([]);
      setCurrentIndex(0);
      setCurrentImageURL(null);
  
      window.dispatchEvent(new Event('datasetCleared'));
    };
  
    const handler = async (e: Event) => {
      const { type } = (e as CustomEvent<FileMenuActionPayload>).detail;
  
      switch (type) {
        case 'SAVE':
          await saveCurrentImage();
          break;
        case 'REVERT':
          await revertCurrentImage();
          break;
        case 'CLOSE':
          await closeCurrentImage();
          break;
        case 'CLOSE_ALL':
          await closeAllImages();
          break;
        case 'SAVE_ALL':
          await saveAllImages();
          break;          
        default:
          break;
      }
    };
  
    window.addEventListener(FILE_MENU_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(FILE_MENU_EVENT_NAME, handler as EventListener);
    };
  }, [
    imageArray,
    currentIndex,
    currentFile,
    currentImageURL,
    setImageArray,
    setCurrentIndex,
    setCurrentImageURL,
  ]);  
};

export default useFileEvents;
