import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ComplaintPagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1 || pagination.total === 0) {
    return null;
  }

  const { page, limit, total, totalPages } = pagination;
  const firstItem = (page - 1) * limit + 1;
  const lastItem = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Complaint pages"
      className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row"
    >
      <p className="text-sm text-muted">
        Showing {firstItem}–{lastItem} of {total} complaints
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPreviousPage}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span aria-live="polite" className="min-w-20 text-center text-sm font-medium text-muted">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNextPage}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
