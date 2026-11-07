import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Star,
  ThumbsUp,
} from "lucide-react";
import {
  reopenComplaintRequest,
  verifyComplaintResolutionRequest,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!complaint || (complaint.status !== "Resolved" && !complaint.reopenedCount)) {
    return null;
  }

  // Already verified view
  if (complaint.resolutionVerified) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <h4 className="font-display text-sm font-bold">
              Resolution Verified by Student
            </h4>
          </div>
          <div className="flex items-center gap-1 text-amber-500">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                className={star <= (complaint.csatRating || 5) ? "fill-amber-400 text-amber-400" : "text-stone-300"}
              />
            ))}
            <span className="ml-1 text-xs font-bold text-ink">
              {complaint.csatRating || 5}/5
            </span>
          </div>
        </div>
        {complaint.csatFeedback && (
          <p className="mt-2 text-xs italic text-emerald-900 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-emerald-100">
            "{complaint.csatFeedback}"
          </p>
        )}
      </div>
    );
  }

  // Reopened status indicator banner
  if (complaint.reopenedCount > 0 && complaint.status !== "Resolved") {
    return (
      <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <h4 className="font-display text-sm font-bold">
            Reopened Ticket (Re-open #{complaint.reopenedCount})
          </h4>
        </div>
        {complaint.reopenReason && (
          <p className="mt-1.5 text-xs text-amber-900">
            Reason: <span className="font-semibold">{complaint.reopenReason}</span>
          </p>
        )}
      </div>
    );
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const res = await verifyComplaintResolutionRequest(
        complaint._id,
        { rating, feedback },
        accessToken,
      );
      setSuccess("Thank you! Your rating and verification have been recorded.");
      onUpdate?.(res.complaint || { ...complaint, resolutionVerified: true, csatRating: rating, csatFeedback: feedback });
    } catch (err) {
      setError(err.message || "Failed to verify resolution.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen(e) {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setError("Please describe why this issue is not resolved.");
      return;
    }

    setError("");
    setBusy(true);

    try {
      const res = await reopenComplaintRequest(
        complaint._id,
        { reason: reopenReason, imageFile: reopenImage },
        accessToken,
      );
      setSuccess("Issue reopened! Maintenance staff has been alerted.");
      onUpdate?.(res.complaint || { ...complaint, status: "In_Progress", reopenedCount: (complaint.reopenedCount || 0) + 1, reopenReason });
    } catch (err) {
      setError(err.message || "Failed to reopen ticket.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/20 bg-gradient-to-b from-white to-brand-soft/20 p-4 sm:p-5 shadow-sm">
      {success ? (
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      ) : reopenMode ? (
        <form onSubmit={handleReopen} className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-2 text-rose-700">
              <RotateCcw size={16} />
              <h4 className="font-display text-sm font-bold text-ink">
                Reopen Unresolved Issue
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setReopenMode(false);
                setError("");
              }}
              className="text-xs font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Explain what is still broken. The ticket will immediately return to <strong>In Progress</strong> and alert staff.
          </p>

          <div>
            <textarea
              required
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. The AC fan spins but still blows warm air; cooling is still not working."
              className="w-full rounded-xl border border-line p-3 text-xs text-ink outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
            />
          </div>

          {/* Optional Proof Photo */}
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-xs hover:bg-canvas">
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

          {error && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={13} />}
              Confirm & Reopen Issue
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <div className="flex items-center gap-2 text-brand">
            <ThumbsUp size={16} />
            <h4 className="font-display text-sm font-bold text-ink">
              Is it working now? Verify the repair
            </h4>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Campus staff marked this complaint resolved. Rate the fix quality below to close out the request.
          </p>

          {/* Interactive Star Rating */}
          <div className="flex items-center gap-1.5 py-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoverRating || rating);
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="rounded-lg p-1 text-stone-300 transition hover:scale-110 active:scale-95"
                  aria-label={`Rate ${star} star`}
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
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Leave feedback for maintenance staff (optional)"
              className="w-full rounded-xl border border-line px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95 disabled:opacity-50"
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Yes, Fix Verified ({rating}★)
            </button>

            <button
              type="button"
              onClick={() => {
                setReopenMode(true);
                setError("");
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 px-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95"
            >
              <RotateCcw size={13} />
              No, Issue Still Exists (Reopen)
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
