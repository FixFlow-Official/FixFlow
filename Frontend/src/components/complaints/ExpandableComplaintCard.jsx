import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import ComplaintStatusBadge from "./ComplaintStatusBadge.jsx";
import ComplaintConversation from "./ComplaintConversation.jsx";

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

export default function ExpandableComplaintCard({
  complaint,
  expanded,
  onToggle,
  onDownloadPdf,
  summary,
  children,
}) {
  const status = complaint.status || "Submitted";

  const location = [
    complaint.location?.building,
    complaint.location?.room ? `Room ${complaint.location.room}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Close the dialog with Escape and prevent background scrolling.
  useEffect(() => {
    if (!expanded) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onToggle();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded, onToggle]);

  return (
    <>
      {/* Hide scrollbars visually while keeping content scrollable. */}
      <style>
        {`
          .complaint-dialog-scrollbar {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .complaint-dialog-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>

      {/* Complaint summary card in the dashboard list */}
      <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={expanded}
            onClick={onToggle}
            className="min-w-0 flex-1 p-4 text-left transition hover:bg-stone-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand/10 sm:p-5"
          >
            <span className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              {complaint.complaintPictureUrl && (
                <img
                  src={complaint.complaintPictureUrl}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  className="size-16 shrink-0 rounded-xl bg-stone-100 object-cover sm:size-20"
                />
              )}

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-display text-lg font-bold text-ink">
                    {complaint.complaintTitle || "Untitled complaint"}
                  </span>

                  <ComplaintStatusBadge status={status} />
                </span>

                <span className="mt-1 block break-words text-sm text-muted">
                  {complaint.complaintDescription ||
                    "No description provided."}
                </span>

                <span className="mt-2 block break-words text-xs text-muted">
                  {[complaint.category, location].filter(Boolean).join(" · ") ||
                    "Complaint details unavailable"}
                </span>

                {summary && (
                  <span className="mt-2 block break-words text-xs text-muted">
                    {summary}
                  </span>
                )}

                <span className="mt-2 block text-xs text-muted">
                  Submitted {formatDate(complaint.createdAt)}
                </span>

                <span className="mt-2 block text-sm font-semibold text-brand">
                  View details
                </span>
              </span>
            </span>
          </button>

          {onDownloadPdf && (
            <div className="px-4 pb-4 sm:flex sm:items-start sm:px-3 sm:py-5">
              <button
                type="button"
                onClick={() => onDownloadPdf(complaint)}
                aria-label={`Download PDF for ${complaint.complaintTitle || "complaint"}`}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-soft sm:w-auto"
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          )}
        </div>
      </article>

      {/* Dialog is portaled above dashboard headers and stacking contexts. */}
      {expanded &&
        createPortal(
          <div
            className="complaint-dialog-scrollbar fixed inset-0 z-[99999] flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] backdrop-blur-sm sm:items-center sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onToggle();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby={`complaint-dialog-title-${complaint._id}`}
              className="complaint-dialog-scrollbar max-h-[calc(100dvh-5.25rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/50 bg-white shadow-2xl sm:max-h-[92dvh]"
            >
              {/* Dialog heading and action buttons */}
              <header className="sticky top-0 z-20 flex items-start justify-between gap-2 border-b border-line bg-white/95 p-3 backdrop-blur sm:gap-4 sm:p-6">
                <div className="min-w-0 flex-1">
                  <ComplaintStatusBadge status={status} />

                  <h2
                    id={`complaint-dialog-title-${complaint._id}`}
                    className="mt-2 break-words font-display text-xl font-bold text-ink sm:text-2xl"
                  >
                    {complaint.complaintTitle || "Untitled complaint"}
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    Submitted {formatDate(complaint.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {onDownloadPdf && (
                    <button
                      type="button"
                      onClick={() => onDownloadPdf(complaint)}
                      aria-label="Download complaint PDF"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-soft"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline">Download PDF</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Close complaint details"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:border-brand hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <div className="p-4 sm:p-6">
                {/* Submitted proof photo */}
                {complaint.complaintPictureUrl && (
                  <a
                    href={complaint.complaintPictureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-5 block overflow-hidden rounded-xl border border-line bg-stone-50"
                    aria-label="Open submitted proof photo"
                  >
                    <img
                      src={complaint.complaintPictureUrl}
                      alt={`Submitted proof for ${complaint.complaintTitle || "complaint"}`}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      className="max-h-[420px] w-full object-contain sm:max-h-[240px]"
                    />
                  </a>
                )}

                {/* Complaint description and summary */}
                <div className="mb-5 rounded-xl bg-stone-50 p-4">
                  <h3 className="text-sm font-semibold text-ink">
                    Description
                  </h3>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink">
                    {complaint.complaintDescription ||
                      "No description provided."}
                  </p>

                  <p className="mt-3 break-words text-xs text-muted">
                    {[complaint.category, location].filter(Boolean).join(" · ") ||
                      "Category or location unavailable"}
                  </p>

                  {summary && (
                    <p className="mt-2 break-words text-xs text-muted">
                      {summary}
                    </p>
                  )}
                </div>

                {/* Dashboard-specific details and controls */}
                {children}

                {/* Shared conversation for student, staff, and admin complaint views. */}
                <ComplaintConversation complaint={complaint} />
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
