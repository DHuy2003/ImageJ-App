import * as exifr from 'exifr';

const getImageInfo = async (file: File) =>  {
  try {
    const exifImage = await exifr.parse(file);

    return {
      width: exifImage.ImageWidth || exifImage.ExifImageWidth,
      height: exifImage.ImageHeight || exifImage.ExifImageHeight,
      bitDepth: exifImage.BitDepth || 'Unknown',
    };
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

export default getImageInfo;
