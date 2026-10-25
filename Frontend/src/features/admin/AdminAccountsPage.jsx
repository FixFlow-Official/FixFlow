import { useEffect, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { getRegisteredAccountsRequest } from "../../services/api.js";

const PAGE_SIZE = 50;

function AccountCard({ account, type, onSelect }) {
  const DetailIcon = type === "student" ? GraduationCap : BriefcaseBusiness;
  const initials = (account.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(account)}
      className="group flex min-h-16 w-full items-center gap-3 rounded-xl border border-brand/10 bg-gradient-to-r from-brand-soft/70 via-white to-emerald-50/60 px-3 py-2.5 text-left shadow-sm transition duration-200 hover:border-brand/30 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-brand/15 sm:gap-4 sm:px-4 sm:py-2.5"
      aria-label={`Open details for ${account.name}, ${type} ID ${account.campusId}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white font-display text-xs font-extrabold text-brand-dark shadow-sm ring-1 ring-brand/10 sm:size-10">
        {initials || <DetailIcon size={21} aria-hidden="true" />}
      </span>
      <span className="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-5 gap-y-0.5 sm:grid-cols-[minmax(140px,1.4fr)_minmax(130px,0.8fr)_minmax(150px,1fr)] sm:gap-y-0">
        <span className="truncate font-display font-bold text-ink group-hover:text-brand-dark">
          {account.name || "Name unavailable"}
        </span>
        <span className="truncate text-sm text-muted">
          <span className="font-medium text-ink">{type === "student" ? "Roll no." : "Staff ID"}:</span> {account.campusId}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm text-muted" title={account.detail}>
          <DetailIcon size={14} className="shrink-0 text-brand" aria-hidden="true" />
          <span className="truncate">{account.detail || "Not provided"}</span>
        </span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold capitalize text-white sm:inline-flex">
        {type}
      </span>
      <ChevronRight size={18} className="shrink-0 text-brand/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

// Admin-only list of registered accounts. Directory-only entries are excluded.
export default function AdminAccountsPage({ accessToken }) {
  const [type, setType] = useState("student");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    if (!selectedAccount) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event) {
      if (event.key === "Escape") setSelectedAccount(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedAccount]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      setLoading(true);
      setError("");
      try {
        const result = await getRegisteredAccountsRequest(accessToken, {
          type,
          search: debouncedSearch,
          page,
          limit: PAGE_SIZE,
        });
        if (!active) return;
        setAccounts(result.accounts ?? []);
        setPagination(result.pagination ?? null);
        if (result.pagination && page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages));
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Could not load registered accounts.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccounts();
    return () => {
      active = false;
    };
  }, [accessToken, type, debouncedSearch, page, refreshKey]);

  const typeLabel = type === "student" ? "students" : "staff members";
  const total = pagination?.total ?? 0;

  return (
    <main className="w-full min-w-0">
      <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
        Administrator workspace
      </span>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Registered accounts
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
            View students and staff who have completed FixFlow registration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-canvas disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:mt-8 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-1 sm:inline-grid sm:min-w-80">
            <button
              type="button"
              aria-pressed={type === "student"}
              onClick={() => { setType("student"); setPage(1); setSelectedAccount(null); }}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${type === "student" ? "bg-white text-brand-dark shadow-sm" : "text-muted hover:text-ink"}`}
            >
              <GraduationCap size={17} aria-hidden="true" /> Students
            </button>
            <button
              type="button"
              aria-pressed={type === "staff"}
              onClick={() => { setType("staff"); setPage(1); setSelectedAccount(null); }}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${type === "staff" ? "bg-white text-brand-dark shadow-sm" : "text-muted hover:text-ink"}`}
            >
              <Users size={17} aria-hidden="true" /> Staff
            </button>
          </div>

          <label className="relative block w-full lg:max-w-md">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${typeLabel} by name, ID, email, or ${type === "student" ? "course" : "department"}`}
              aria-label={`Search registered ${typeLabel}`}
              className="min-h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-muted/80 focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold capitalize">{typeLabel}</h2>
          <span className="rounded-full bg-canvas px-3 py-1 text-sm font-bold text-muted" aria-live="polite">
            {loading ? "…" : total}
          </span>
        </div>

        {error ? (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted">
            <LoaderCircle size={21} className="animate-spin text-brand" aria-hidden="true" />
            Loading registered {typeLabel}…
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/50 px-5 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-dark">
              <Users size={22} aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-display font-bold">
              {debouncedSearch ? "No matching accounts" : `No registered ${typeLabel} yet`}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {debouncedSearch ? "Try another name, campus ID, email, or course/department." : "Accounts appear here after the user completes registration."}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                type={type}
                onSelect={setSelectedAccount}
              />
            ))}
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-muted">
              Page {pagination?.page ?? page} of {Math.max(1, pagination?.totalPages ?? 1)} · {total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!pagination?.hasPreviousPage}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={17} aria-hidden="true" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!pagination?.hasNextPage}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      {selectedAccount && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedAccount(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-detail-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl motion-safe:animate-[account-pop_180ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-soft via-white to-emerald-50 px-5 py-6 sm:px-7 sm:py-8">
              <div className="absolute -right-8 -top-12 size-40 rounded-full bg-brand/10 blur-2xl" aria-hidden="true" />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedAccount(null);
                }}
                aria-label="Close account details"
                className="absolute right-4 top-4 z-20 inline-flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-xl border border-line bg-white text-muted shadow-sm transition hover:bg-white hover:text-ink focus:outline-none focus:ring-4 focus:ring-brand/15"
              >
                <X size={19} aria-hidden="true" />
              </button>
              <div className="relative flex items-center gap-4 pr-10">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand font-display text-lg font-extrabold text-white shadow-md shadow-brand/20">
                  {(selectedAccount.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"}
                </span>
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-dark ring-1 ring-brand/10">
                    Registered {type}
                  </span>
                  <h2 id="account-detail-title" className="mt-2 break-words font-display text-xl font-extrabold text-ink sm:text-2xl">
                    {selectedAccount.name || "Name unavailable"}
                  </h2>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
              <div className="rounded-2xl border border-brand/10 bg-brand-soft/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{type === "student" ? "Roll number" : "Staff ID"}</p>
                <p className="mt-2 break-all font-semibold text-ink">{selectedAccount.campusId}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{type === "student" ? "Course" : "Department"}</p>
                <p className="mt-2 break-words font-semibold text-ink">{selectedAccount.detail || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email address</p>
                <p className="mt-2 break-all font-semibold text-ink">{selectedAccount.email || "Not provided"}</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
