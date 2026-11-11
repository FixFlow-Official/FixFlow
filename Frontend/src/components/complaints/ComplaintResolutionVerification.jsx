import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Star,
  ThumbsUp,
} from "lucide-react";
import {
  rateComplaintRequest,
  reopenComplaintRequest,
} from "../../services/api.js";

const STAR_LABELS = {
  1: "Poor - Still broken",
  2: "Subpar - Partial fix",
  3: "Acceptable - Works okay",
  4: "Good - Well repaired",
  5: "Excellent - Fully functional",
};

export default function ComplaintResolutionVerification({
  complaint,
  accessToken,
  onUpdate,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [reopenMode, setReopenMode] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenImage, setReopenImage] = useState(null);
  const [busyRating, setBusyRating] = useState(false);
  const [busyReopen, setBusyReopen] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!complaint || (complaint.status !== "Resolved" && complaint.status !== "Reopened" && !complaint.reopenedCount)) {
    return null;
  }

  // Reopened state view
  if (complaint.status === "Reopened" || (complaint.reopenedCount > 0 && complaint.status !== "Resolved")) {
    return (
      <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/80 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-purple-900">
            <RotateCcw size={18} className="text-purple-600 shrink-0" />
            <h4 className="font-display text-sm font-bold">
              Ticket Reopened {complaint.reopenedCount ? `(Re-open #${complaint.reopenedCount})` : ""}
            </h4>
          </div>
          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200">
            Reopened
          </span>
        </div>
        {complaint.reopenReason && (
          <div className="mt-2.5 rounded-xl border border-purple-100 bg-white/80 p-3 text-xs leading-relaxed text-purple-950">
            <span className="font-bold text-purple-900">Reason: </span>
            {complaint.reopenReason}
          </div>
        )}
      </div>
    );
  }

  // Calculate 48h reopen window
  const resolvedAtTime = complaint.resolvedAt
    ? new Date(complaint.resolvedAt).getTime()
    : (complaint.updatedAt ? new Date(complaint.updatedAt).getTime() : now);
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const reopenDeadline = resolvedAtTime + FORTY_EIGHT_HOURS_MS;
  const remainingMs = reopenDeadline - now;
  const isReopenExpired = remainingMs <= 0;

  const hoursRemaining = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));
  const countdownText = isReopenExpired
    ? "Reopen window expired."
    : `Reopen available for ${hoursRemaining}h ${minutesRemaining}m`;

  const hasRated = complaint.csatRating != null || Boolean(submittedMessage);
  const currentRatingValue = complaint.csatRating ?? rating;
  const showAuditNotice = (complaint.csatRating != null && complaint.csatRating <= 2) || (hasRated && rating <= 2) || complaint.adminAuditRequired;

  async function handleRatingSubmit(e) {
    e.preventDefault();
    setRatingError("");
    setBusyRating(true);

    try {
      const res = await rateComplaintRequest(
        complaint._id,
        { rating, feedback },
        accessToken,
      );
      setSubmittedMessage("Thanks — your rating was recorded.");
      onUpdate?.(res.complaint || {
        ...complaint,
        csatRating: rating,
        csatFeedback: feedback,
        adminAuditRequired: rating <= 2,
        resolutionVerified: true,
      });
    } catch (err) {
      setRatingError(err.message || "Could not record your rating.");
    } finally {
      setBusyRating(false);
    }
  }

  async function handleReopenSubmit(e) {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setReopenError("Please describe why this issue is not resolved.");
      return;
    }

    setReopenError("");
    setBusyReopen(true);

    try {
      const res = await reopenComplaintRequest(
        complaint._id,
        { reason: reopenReason, imageFile: reopenImage },
        accessToken,
      );
      onUpdate?.(res.complaint || {
        ...complaint,
        status: "Reopened",
        reopenedCount: (complaint.reopenedCount || 0) + 1,
        reopenReason,
        csatRating: null,
        resolutionVerified: false,
      });
      setReopenMode(false);
    } catch (err) {
      setReopenError(err.message || "Failed to reopen ticket.");
    } finally {
      setBusyReopen(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      {/* 1. CSAT Rating Card */}
      <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-b from-white to-brand-soft/20 p-4 sm:p-5 shadow-xs">
        {hasRated ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <h4 className="font-display text-sm font-bold">
                  {submittedMessage || "Thanks — your rating was recorded."}
                </h4>
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    className={star <= currentRatingValue ? "fill-amber-400 text-amber-400" : "text-stone-300"}
                  />
                ))}
                <span className="ml-1 text-xs font-bold text-ink">
                  {currentRatingValue}/5
                </span>
              </div>
            </div>

            {(complaint.csatFeedback || feedback) && (
              <p className="mt-2.5 text-xs italic text-slate-700 bg-white/80 p-2.5 rounded-xl border border-line">
                "{complaint.csatFeedback || feedback}"
              </p>
            )}

            {showAuditNotice && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span>Flagged for admin audit.</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleRatingSubmit} className="space-y-3">
            <div className="flex items-center gap-2 text-brand">
              <ThumbsUp size={16} />
              <h4 className="font-display text-sm font-bold text-ink">
                Rate Resolution Satisfaction
              </h4>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Campus staff marked this complaint resolved. Rate the fix quality below to close out the request.
            </p>

            {/* Accessible 5-star rating control */}
            <div
              className="flex items-center gap-1.5 py-1"
              role="radiogroup"
              aria-label="Resolution satisfaction rating from 1 to 5 stars"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onFocus={() => setHoverRating(star)}
                    onBlur={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="rounded-lg p-1 text-stone-300 transition hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <Star
                      size={24}
                      className={active ? "fill-amber-400 text-amber-400" : "text-stone-300"}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-xs font-bold text-ink">
                {STAR_LABELS[hoverRating || rating]}
              </span>
            </div>

            <div>
              <input
                type="text"
                maxLength={1000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Leave feedback for maintenance staff (optional)"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </div>

            {ratingError && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle size={14} />
                <span>{ratingError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busyRating}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {busyRating ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Submit rating
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. 48-Hour Reopen Card */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
        {reopenMode ? (
          <form onSubmit={handleReopenSubmit} className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2 text-rose-700">
                <RotateCcw size={16} />
                <h4 className="font-display text-sm font-bold text-ink">
                  Reopen Unresolved Ticket
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReopenMode(false);
                  setReopenError("");
                }}
                className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Explain why this issue is not resolved. The ticket will change to <strong>Reopened</strong> and alert maintenance staff and administrators.
            </p>

            <div>
              <textarea
                required
                rows={3}
                maxLength={1000}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. The AC fan spins but still blows warm air; cooling is still not working."
                className="w-full rounded-xl border border-line p-3 text-xs text-ink outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
              />
            </div>

            {/* Optional Proof Photo */}
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs hover:bg-canvas">
                <Camera size={13} className="text-muted" />
                {reopenImage ? "Photo attached" : "Attach Proof Photo (Optional)"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReopenImage(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
              {reopenImage && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  ✓ {reopenImage.name}
                </span>
              )}
            </div>

            {reopenError && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle size={14} />
                <span>{reopenError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busyReopen}
                className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {busyReopen ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={13} />}
                Confirm reopen
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Clock3 size={15} className={isReopenExpired ? "text-stone-400" : "text-amber-600"} />
              <span className={isReopenExpired ? "text-stone-500 font-semibold" : "text-amber-800 font-semibold"}>
                {countdownText}
              </span>
            </div>

            {!isReopenExpired && (
              <button
                type="button"
                onClick={() => {
                  setReopenMode(true);
                  setReopenError("");
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95 cursor-pointer"
              >
                <RotateCcw size={13} />
                Reopen ticket
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
