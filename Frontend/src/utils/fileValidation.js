export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
