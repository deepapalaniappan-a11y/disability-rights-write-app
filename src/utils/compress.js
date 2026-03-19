/**
 * Image Compression
 * Compresses images before upload to save bandwidth on slow connections
 * Uses canvas API — works on all modern mobile browsers
 */

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const QUALITY = 0.8;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — compress anything larger

/**
 * Check if a file is an image
 */
export function isImage(file) {
  return file.type.startsWith('image/');
}

/**
 * Check if a file is a video
 */
export function isVideo(file) {
  return file.type.startsWith('video/');
}

/**
 * Compress an image file using canvas
 * Returns a new compressed File object, or the original if compression isn't needed
 */
export async function compressImage(file) {
  // Don't compress non-images or very small files
  if (!isImage(file)) return file;
  if (file.size < 200 * 1024) return file; // Under 200KB, skip

  // GIF and SVG don't compress well with canvas
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else if (file.size < MAX_FILE_SIZE) {
        // Image is small enough and dimensions are fine
        resolve(file);
        return;
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help, use original
            resolve(file);
            return;
          }
          // Create new file with same name
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressed);
        },
        'image/jpeg',
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // On error, use original
    };

    img.src = url;
  });
}

/**
 * Compress multiple image files
 * Returns array of compressed File objects
 */
export async function compressImages(files) {
  return Promise.all(files.map(f => compressImage(f)));
}
