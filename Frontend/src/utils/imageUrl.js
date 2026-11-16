/**
 * ImageKit URL optimization helper for FixFlow.
 * Applies width and quality transformations to reduce payload sizes and improve LCP.
 */

export const IMAGE_VARIANTS = {
  card: "w-800,q-80",
  detail: "w-1600,q-85",
  thumbnail: "w-200,q-80",
};

/**
 * Returns an ImageKit optimized URL with transformation parameters.
 * If the URL is not from ImageKit, is a blob/data URI, or invalid, returns the original URL.
 *
 * @param {string} url - Original image URL
 * @param {'card' | 'detail' | 'thumbnail' | string} [variant='card'] - Preset variant or raw transform string
 * @returns {string} - Transformed image URL
 */
export function getOptimizedImageUrl(url, variant = "card") {
  if (!url || typeof url !== "string") return url;

  // Preserve local object URLs and data URIs untouched
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }

  // Only apply transformations to ImageKit domains
  if (!url.includes("imagekit.io")) {
    return url;
  }

  const transform = IMAGE_VARIANTS[variant] || variant;
  if (!transform) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("tr");
    const base = parsed.toString().split("?")[0];
    const existingSearch = parsed.search;
    const connector = existingSearch ? `${existingSearch}&` : "?";
    return `${base}${connector}tr=${transform}`;
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}tr=${transform}`;
  }
}
