export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

/**
 * Validates an uploaded proof image against allowed MIME types and max byte size.
 * @param {File|null|undefined} file - Browser File instance
 * @param {number} [maxBytes=MAX_IMAGE_SIZE] - Maximum allowed size in bytes
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateImageFile(file, maxBytes = MAX_IMAGE_SIZE) {
  if (!file) {
    return { valid: false, error: "Please select an image file." };
  }

  if (typeof file !== "object" || typeof file.size !== "number") {
    return { valid: false, error: "Invalid file object provided." };
  }

  const mime = file.type ? file.type.toLowerCase().trim() : "";
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    return {
      valid: false,
      error: "Choose a JPG, PNG, or WebP image. Other formats are not supported.",
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: "The selected file is empty." };
  }

  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `The image exceeds the ${maxMb} MB size limit. Choose a smaller file.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Downscales and compresses large images (e.g. from mobile cameras) using HTML5 Canvas.
 * Prevents mobile browser memory exhaustion crashes and ensures image is within size limits.
 * @param {File} file
 * @param {number} [maxDimension=1920]
 * @param {number} [quality=0.85]
 * @returns {Promise<File>}
 */
export async function compressImageIfNeeded(file, maxDimension = 1920, quality = 0.85) {
  if (!file || typeof window === "undefined" || !window.document) return file;
  if (!file.type || !file.type.startsWith("image/")) return file;

  // If already under 1.5 MB and a standard web image, no resize needed
  if (file.size <= 1.5 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);
          let { width, height } = img;

          if (width <= maxDimension && height <= maxDimension && file.size <= MAX_IMAGE_SIZE) {
            resolve(file);
            return;
          }

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const newName = (file.name || "photo.jpg").replace(/\.[^.]+$/, ".jpg");
              const compressedFile = new File([blob], newName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/jpeg",
            quality,
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
        resolve(file);
      };

      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}
