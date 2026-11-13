import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  Flame,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import {
  getTrendingComplaintsRequest,
  upvoteComplaintRequest,
} from "../../services/api.js";
import ComplaintStatusBadge from "../../components/complaints/ComplaintStatusBadge.jsx";
import { formatDate } from "../../utils/complaintConfig.js";

const CATEGORIES = [
  "All",
  "Electrical",
  "Plumbing",
  "Internet",
  "Cleaning",
  "Furniture",
  "Other",
];

export default function CampusTrendingFeed({ accessToken, onSelectComplaint }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [upvotingIds, setUpvotingIds] = useState(new Set());
  const [upvoteMessage, setUpvoteMessage] = useState("");

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (category !== "All") params.category = category;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await getTrendingComplaintsRequest(params, accessToken);
      setComplaints(res.complaints || []);
    } catch (err) {
      setError(err.message || "Failed to load trending campus complaints.");
    } finally {
      setLoading(false);
    }
  }, [category, searchTerm, accessToken]);

  useEffect(() => {
    let active = true;
    getTrendingComplaintsRequest(
      {
        ...(category !== "All" ? { category } : {}),
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      },
      accessToken,
    )
      .then((res) => {
        if (active) {
          setComplaints(res.complaints || []);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load trending campus complaints.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, searchTerm, accessToken]);

  async function handleToggleUpvote(complaintId, e) {
    e.stopPropagation();
    if (upvotingIds.has(complaintId)) return;

    setUpvotingIds((prev) => new Set(prev).add(complaintId));
    setUpvoteMessage("");

    // Optimistic UI update
    setComplaints((prev) =>
      prev.map((c) => {
        if (c._id !== complaintId) return c;
        const nextUpvoted = !c.hasUpvoted;
        return {
          ...c,
          hasUpvoted: nextUpvoted,
          upvoteCount: nextUpvoted
            ? (c.upvoteCount || 0) + 1
            : Math.max(0, (c.upvoteCount || 1) - 1),
        };
      }),
    );

    try {
      const res = await upvoteComplaintRequest(complaintId, accessToken);
      setUpvoteMessage(res.message || "Upvote recorded!");
    } catch (err) {
      // Revert optimistic update on failure
      setComplaints((prev) =>
        prev.map((c) => {
          if (c._id !== complaintId) return c;
          const revertedUpvoted = !c.hasUpvoted;
          return {
            ...c,
            hasUpvoted: revertedUpvoted,
            upvoteCount: revertedUpvoted
              ? (c.upvoteCount || 0) + 1
              : Math.max(0, (c.upvoteCount || 1) - 1),
          };
        }),
      );
      setError(err.message || "Could not update vote.");
    } finally {
      setUpvotingIds((prev) => {
        const next = new Set(prev);
        next.delete(complaintId);
        return next;
      });
    }
  }

  return (
    <section className="w-full space-y-5">
      {/* Feed Header */}
      <div className="flex flex-col gap-3 rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Flame size={20} className="animate-pulse" />
            </span>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Campus Trending Issues
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted leading-relaxed sm:text-sm">
            Top campus issues affecting students. Tap{" "}
            <span className="font-bold text-amber-800">+1 Me Too</span> to boost
            urgency and eliminate duplicate tickets.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTrending}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 text-xs font-semibold text-ink shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pills */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                category === cat
                  ? "bg-brand text-white shadow-xs"
                  : "border border-line bg-white text-muted hover:bg-slate-50 hover:text-ink"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-auto sm:min-w-[240px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search trending issues…"
            className="min-h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-xs text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
      </div>

      {upvoteMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
          ✓ {upvoteMessage}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Issues List */}
      {loading ? (
        <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted">
          <LoaderCircle size={20} className="animate-spin text-brand" />
          <span>Loading trending campus complaints…</span>
        </div>
      ) : complaints.length === 0 ? (
        <div className="rounded-3xl border border-line/80 bg-white p-8 text-center shadow-xs">
          <TrendingUp size={32} className="mx-auto text-muted/60" />
          <h3 className="mt-3 font-display text-base font-bold text-ink">
            No trending issues right now
          </h3>
          <p className="mt-1 text-xs text-muted">
            All campus issues matching this filter are resolved or quiet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {complaints.map((item) => {
            const isUpvoting = upvotingIds.has(item._id);
            const locationStr = [
              item.location?.building,
              item.location?.room ? `Room ${item.location.room}` : "",
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <article
                key={item._id}
                onClick={() => onSelectComplaint?.(item)}
                className="group relative flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-xs transition hover:border-brand/40 hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ComplaintStatusBadge status={item.status} />
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {item.category}
                      </span>
                      {item.aiTriage?.priority && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.aiTriage.priority === "P1"
                              ? "bg-rose-100 text-rose-800"
                              : item.aiTriage.priority === "P2"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {item.aiTriage.priority} · {item.aiTriage.urgency}
                        </span>
                      )}
                    </div>

                    {/* Upvote Pill */}
                    <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs">
                      <Flame size={13} className="text-amber-500 fill-amber-500" />
                      <span>{item.upvoteCount || 0}</span>
                      <span className="hidden sm:inline">votes</span>
                    </div>
                  </div>

                  <h3 className="mt-3 font-display text-base font-bold text-ink transition group-hover:text-brand">
                    {item.complaintTitle}
                  </h3>

                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {item.complaintDescription}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin size={13} className="text-brand shrink-0" />
                    <span className="truncate">{locationStr || "Campus"}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-[11px] text-muted">
                  <span>Reported {formatDate(item.createdAt)}</span>

                  {/* +1 / I have this issue too button */}
                  {item.isOwner ? (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      <Building2 size={13} />
                      Your ticket
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpvoting}
                      onClick={(e) => handleToggleUpvote(item._id, e)}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
                        item.hasUpvoted
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100 shadow-2xs"
                      }`}
                    >
                      {isUpvoting ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : item.hasUpvoted ? (
                        <Check size={13} className="text-emerald-600" />
                      ) : (
                        <ThumbsUp size={13} className="text-amber-600" />
                      )}
                      <span>
                        {item.hasUpvoted ? "You +1'd this" : "+1 I have this too"}
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
