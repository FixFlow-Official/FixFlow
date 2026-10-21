import { Search } from "lucide-react";

export default function ComplaintToolbar({
  filters = [],
  activeFilter,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchLabel = "Search complaints",
  searchPlaceholder = "Search complaints",
  sortValue,
  onSortChange,
  sortOptions = [],
}) {
  return (
    <section className="mb-5 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <div
        className={`grid gap-3 ${
          sortOptions.length
            ? "sm:grid-cols-[minmax(0,1fr)_220px]"
            : "grid-cols-1"
        }`}
      >
        <label className="block min-w-0">
          <span className="sr-only">{searchLabel}</span>
          <span className="relative block">
            <Search
              size={17}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
              className="min-h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </span>
        </label>

        {sortOptions.length > 0 && (
          <label className="block min-w-0">
            <span className="sr-only">Sort complaints</span>
            <select
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              aria-label="Sort complaints"
              className="min-h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {filters.length > 0 && (
        <div
          role="group"
          aria-label="Filter complaints"
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
        >
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={activeFilter === filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`min-h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold transition ${
                activeFilter === filter.id
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
              }`}
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className="ml-1.5 opacity-80">({filter.count})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}