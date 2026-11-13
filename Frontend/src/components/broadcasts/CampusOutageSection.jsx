import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Droplet,
  LoaderCircle,
  Radio,
  RefreshCw,
  Sparkles,
  Wifi,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { getActiveBroadcastsRequest } from "../../services/api.js";

function getCategoryIcon(cat) {
  switch (cat) {
    case "Electrical":
      return Zap;
    case "Plumbing":
      return Droplet;
    case "Internet":
      return Wifi;
    case "Cleaning":
      return Sparkles;
    default:
      return AlertTriangle;
  }
}

function getCategoryStyle(cat) {
  switch (cat) {
    case "Electrical":
      return {
        badge: "bg-amber-100 text-amber-900 border-amber-300",
        border: "border-amber-300",
        bg: "bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white",
        iconBg: "bg-amber-500 text-white",
      };
    case "Plumbing":
      return {
        badge: "bg-cyan-100 text-cyan-900 border-cyan-300",
        border: "border-cyan-300",
        bg: "bg-gradient-to-br from-cyan-50/80 via-sky-50/40 to-white",
        iconBg: "bg-cyan-600 text-white",
      };
    case "Internet":
      return {
        badge: "bg-indigo-100 text-indigo-900 border-indigo-300",
        border: "border-indigo-300",
        bg: "bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white",
        iconBg: "bg-indigo-600 text-white",
      };
    case "Cleaning":
      return {
        badge: "bg-teal-100 text-teal-900 border-teal-300",
        border: "border-teal-300",
        bg: "bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-white",
        iconBg: "bg-teal-600 text-white",
      };
    default:
      return {
        badge: "bg-stone-100 text-stone-800 border-stone-300",
        border: "border-stone-300",
        bg: "bg-gradient-to-br from-stone-50 via-white to-stone-50",
        iconBg: "bg-stone-600 text-white",
      };
  }
}

function formatOutageTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isSameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isSameDay) return `Today at ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

export default function CampusOutageSection({
  accessToken,
  onBack,
  userRole = "student",
}) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActiveBroadcasts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await getActiveBroadcastsRequest(accessToken);
      if (res?.broadcasts && Array.isArray(res.broadcasts)) {
        setBroadcasts(res.broadcasts);
      }
    } catch (err) {
      setError(err.message || "Failed to load active broadcasts.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadActiveBroadcasts();
  }, [loadActiveBroadcasts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mr-1 inline-flex size-9 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:border-brand hover:text-brand"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Radio size={19} className="animate-pulse" />
            </span>
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
              Campus Outage Broadcasts & Maintenance
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Live official announcements regarding ongoing facility, electrical, plumbing, or network repairs across campus.
          </p>
        </div>

        <button
          type="button"
          onClick={loadActiveBroadcasts}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Broadcast Cards */}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted">
          <LoaderCircle size={20} className="animate-spin text-brand" />
          <span>Checking campus outage network…</span>
        </div>
      ) : broadcasts.length === 0 ? (
        /* Operational Green State */
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/30 p-8 text-center shadow-xs">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
            <ShieldCheck size={26} />
          </span>
          <h2 className="mt-3.5 font-display text-base font-bold text-emerald-950 sm:text-lg">
            All Campus Facilities Operating Normally
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-emerald-800/90 sm:text-sm leading-relaxed">
            There are currently no scheduled outages or active facility disruptions reported by administration.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Power · Water · Internet · Sanitation all online</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
              {broadcasts.length} Active Notice{broadcasts.length > 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted">
              Please check these known disruptions before submitting a new maintenance request.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {broadcasts.map((b) => {
              const Icon = getCategoryIcon(b.category);
              const style = getCategoryStyle(b.category);
              const locationText =
                b.buildings && b.buildings.length > 0
                  ? b.buildings.join(", ")
                  : "Campus-wide (All Buildings)";

              return (
                <article
                  key={b._id}
                  className={`flex flex-col justify-between rounded-3xl border p-5 shadow-sm transition hover:shadow-md ${style.border} ${style.bg}`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Icon, Category Badge, Live Outage Indicator */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-xl ${style.iconBg} shadow-xs`}
                        >
                          <Icon size={18} />
                        </span>
                        <div>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
                          >
                            {b.category}
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-2xs">
                        <span className="size-2 rounded-full bg-amber-600 animate-pulse" />
                        <span>Ongoing Outage</span>
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="font-display text-base font-bold text-ink sm:text-lg leading-snug">
                      {b.title}
                    </h2>

                    {/* Message */}
                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed break-words">
                      {b.message}
                    </p>

                    {/* Details: Timings & Location */}
                    <div className="rounded-2xl border border-black/5 bg-white/80 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-ink">
                        <Clock size={14} className="text-muted shrink-0" />
                        <span>
                          Estimated Resolution:{" "}
                          <strong className="text-amber-950 font-bold">
                            {formatOutageTime(b.endsAt)}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-ink">
                        <Building2 size={14} className="text-muted shrink-0" />
                        <span>
                          Affected Area: <strong>{locationText}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {userRole === "student" && (
                    <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between text-xs text-muted">
                      <span>Have more details or an emergency?</span>
                      {onBack && (
                        <button
                          type="button"
                          onClick={onBack}
                          className="font-semibold text-brand hover:underline"
                        >
                          File complaint →
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
