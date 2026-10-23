import { formatDate, formatStatus } from "../../utils/complaintConfig.js";

export default function ComplaintStatusTimeline({
  history = [],
  title = "Status history",
  emptyMessage = "",
  variant = "standard",
  includeActorRole = false,
}) {
  const isCompact = variant === "compact";

  if (history.length === 0 && !emptyMessage) {
    return null;
  }

  const sortedHistory = [...history].sort(
    (first, second) =>
      new Date(first.changedAt || 0) - new Date(second.changedAt || 0),
  );

  return (
    <div className={isCompact ? "mt-5" : ""}>
      <h3
        className={
          isCompact ? "text-sm font-semibold" : "font-display font-bold"
        }
      >
        {title}
      </h3>

      {sortedHistory.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ol
          className={
            isCompact
              ? "mt-3 space-y-3 border-l border-line pl-4"
              : "mt-4 space-y-4"
          }
        >
          {sortedHistory.map((entry, index) => (
            <li
              key={`${entry.status}-${entry.changedAt || "unknown"}-${index}`}
              className={isCompact ? "relative" : ""}
            >
              {isCompact ? (
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-brand" />
              ) : null}

              <div className={isCompact ? "" : "flex items-start gap-3"}>
                {!isCompact && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                )}

                <div className="min-w-0">
                  <p
                    className={
                      isCompact
                        ? "text-sm font-semibold"
                        : "break-words text-sm font-semibold"
                    }
                  >
                    {formatStatus(entry.status)}
                  </p>

                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(entry.changedAt)}
                    {includeActorRole && entry.changedByRole
                      ? ` · ${entry.changedByRole}`
                      : ""}
                  </p>

                  {entry.note && (
                    <p
                      className={
                        isCompact
                          ? "mt-1 whitespace-pre-wrap text-sm leading-5 text-muted"
                          : "mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted"
                      }
                    >
                      {entry.note}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}