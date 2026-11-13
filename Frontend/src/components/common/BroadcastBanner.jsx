import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Clock,
  Droplet,
  MapPin,
  Sparkles,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/useAuth.js";
import { getActiveBroadcastsRequest } from "../../services/api.js";

const DISMISSED_STORAGE_KEY = "fixflow_dismissed_broadcasts";

function getDismissedBroadcasts() {
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissedBroadcast(id) {
  try {
    const current = getDismissedBroadcasts();
    if (!current.includes(id)) {
      sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    // Session storage unavailable
  }
}

function formatEndsAt(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const isSameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isSameDay) {
    return `Until ${timeStr}`;
  }

  const dateFormatted = d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return `Until ${dateFormatted}, ${timeStr}`;
}

function getCategoryIcon(category) {
  switch (category) {
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

function getCategoryColor(category) {
  switch (category) {
    case "Electrical":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "Plumbing":
      return "bg-cyan-100 text-cyan-900 border-cyan-300";
    case "Internet":
      return "bg-indigo-100 text-indigo-900 border-indigo-300";
    case "Cleaning":
      return "bg-teal-100 text-teal-900 border-teal-300";
    default:
      return "bg-orange-100 text-orange-900 border-orange-300";
  }
}

export default function BroadcastBanner() {
  const { accessToken } = useAuth();
  const [broadcasts, setBroadcasts] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(getDismissedBroadcasts);

  const fetchActive = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await getActiveBroadcastsRequest(accessToken);
      if (res?.broadcasts && Array.isArray(res.broadcasts)) {
        setBroadcasts(res.broadcasts);
      }
    } catch {
      // Silently fail without interrupting user layout
    }
  }, [accessToken]);

  useEffect(() => {
    fetchActive();
    // Poll every 3 minutes for new campus outage alerts
    const interval = setInterval(fetchActive, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchActive]);

  const visibleBroadcasts = broadcasts
    .filter((b) => !dismissedIds.includes(b._id))
    .slice(0, 3);

  function handleDismiss(id) {
    saveDismissedBroadcast(id);
    setDismissedIds((prev) => [...prev, id]);
  }

  if (visibleBroadcasts.length === 0) {
    return null;
  }

  return (
    <section
      role="region"
      aria-label="Campus outage broadcasts"
      className="sticky top-[68px] z-20 flex w-full flex-col gap-1.5 px-4 py-2 sm:px-6 lg:px-8"
    >
      {visibleBroadcasts.map((broadcast) => {
        const Icon = getCategoryIcon(broadcast.category);
        const categoryClasses = getCategoryColor(broadcast.category);
        const locationText =
          broadcast.buildings && broadcast.buildings.length > 0
            ? broadcast.buildings.join(", ")
            : "Campus-wide";

        return (
          <div
            key={broadcast._id}
            className="flex items-start justify-between gap-3 rounded-xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 p-3 shadow-xs ring-1 ring-amber-400/20 transition-all duration-200"
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-lg border ${categoryClasses}`}
                aria-hidden="true"
              >
                <Icon size={15} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xs font-bold text-ink sm:text-sm">
                    {broadcast.title}
                  </span>

                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${categoryClasses}`}
                  >
                    {broadcast.category}
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900">
                    <Clock size={12} className="text-amber-700" />
                    <span>{formatEndsAt(broadcast.endsAt)}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <MapPin size={11} className="text-muted/70" />
                    <span>{locationText}</span>
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-amber-950/90 leading-relaxed break-words">
                    {broadcast.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("fixflow:open-broadcasts"))}
                    className="text-xs font-bold text-amber-900 hover:text-amber-950 underline decoration-amber-400 shrink-0"
                  >
                    View details →
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDismiss(broadcast._id)}
              aria-label={`Dismiss notice: ${broadcast.title}`}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-amber-200/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </section>
  );
}
