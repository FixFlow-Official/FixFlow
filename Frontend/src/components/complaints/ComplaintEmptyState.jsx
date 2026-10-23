/** Shared empty and no-results presentation for complaint views. */
export default function ComplaintEmptyState({
  title,
  description,
  className = "rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center",
  titleClassName = "mt-4 font-display font-bold",
  descriptionClassName = "mt-1 text-sm leading-6 text-muted",
  icon: Icon,
  iconClassName = "mx-auto grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-sm",
}) {
  return (
    <section className={className}>
      {Icon && (
        <span className={iconClassName}>
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <h3 className={titleClassName}>{title}</h3>
      <p className={descriptionClassName}>{description}</p>
    </section>
  );
}
