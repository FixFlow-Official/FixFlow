export default function ComplaintImageLink({
  src,
  alt,
  ariaLabel,
  className,
  imageClassName,
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
      <img src={src} alt={alt} className={imageClassName} />
    </a>
  );
}