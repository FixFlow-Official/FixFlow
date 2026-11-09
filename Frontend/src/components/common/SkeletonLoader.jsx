import { SKELETON_DEFAULTS, getSkeletonAriaAttributes } from "../../utils/skeletonConfig.js";

/**
 * Standardized skeleton loaders for FixFlow complaint cards, tables, and panels.
 * Respects prefers-reduced-motion with motion-reduce:animate-none.
 */

export function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-stone-200/80 motion-reduce:animate-none ${className}`}
    />
  );
}

export function ComplaintCardSkeleton({ count = SKELETON_DEFAULTS.cardCount }) {
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <div
      {...getSkeletonAriaAttributes("Loading complaints")}
      className="space-y-4"
    >
      {items.map((key) => (
        <article
          key={key}
          className="rounded-3xl border border-line/70 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-6 w-3/4 rounded-lg" />
              <Skeleton className="mt-2 h-4 w-full max-w-md rounded-md" />
            </div>
            <Skeleton className="size-16 shrink-0 rounded-2xl" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line/50 pt-4">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="ml-auto h-8 w-24 rounded-xl" />
          </div>
        </article>
      ))}
      <span className="sr-only">Loading content…</span>
    </div>
  );
}

export function TableRowSkeleton({
  rows = SKELETON_DEFAULTS.tableRows,
  cols = SKELETON_DEFAULTS.tableCols,
}) {
  const rowList = Array.from({ length: rows }, (_, index) => index);
  const colList = Array.from({ length: cols }, (_, index) => index);

  return (
    <tbody {...getSkeletonAriaAttributes("Loading table rows")}>
      {rowList.map((rowKey) => (
        <tr key={rowKey} className="border-b border-line/60">
          {colList.map((colKey) => (
            <td key={colKey} className="p-4">
              <Skeleton
                className={`h-4 rounded-md ${
                  colKey === 0
                    ? "w-36"
                    : colKey === cols - 1
                      ? "w-20"
                      : "w-24"
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
