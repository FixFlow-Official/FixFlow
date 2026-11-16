import { getOptimizedImageUrl } from "../../utils/imageUrl.js";

export default function ComplaintImageLink({
  src,
  alt,
  ariaLabel,
  className,
  imageClassName,
  variant = "detail",
  width,
  height,
}) {
  if (!src) return null;

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className={className}
      aria-label={ariaLabel}
    >
      <img
        src={getOptimizedImageUrl(src, variant)}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={imageClassName}
      />
    </a>
  );
}
