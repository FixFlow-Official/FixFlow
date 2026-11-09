import { useState } from "react";
import {
  CheckCheck,
  History,
  MessageCircle,
  MessageSquare,
  Radio,
  Smartphone,
} from "lucide-react";
import { formatDate, formatStatus } from "../../utils/complaintConfig.js";

export default function ComplaintLiveTimeline({
  complaint,
  history = [],
  includeActorRole = true,
}) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "sms" | "milestones"
  const smsUpdates = complaint?.smsUpdates || [];
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0),
  );

  return (
    <div className="rounded-2xl border border-line bg-canvas/40 p-4 sm:p-5">
      {/* Header and Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-brand animate-pulse" />
          <h3 className="font-display text-sm font-bold text-ink">
            Live Ticket Activity &amp; Alerts
          </h3>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-xs font-semibold shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-2.5 py-1 transition ${
              activeTab === "all"
                ? "bg-brand text-white shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            All Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sms")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
              activeTab === "sms"
                ? "bg-brand text-white shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            <MessageSquare size={12} />
            <span>WhatsApp / SMS ({smsUpdates.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("milestones")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
              activeTab === "milestones"
                ? "bg-brand text-white shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            <History size={12} />
            <span>Milestones ({sortedHistory.length})</span>
          </button>
        </div>
      </div>

      {/* WhatsApp / SMS Live Feed */}
      {(activeTab === "all" || activeTab === "sms") && smsUpdates.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Live WhatsApp &amp; SMS Dispatches
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCheck size={12} />
              98% Read Rate Active
            </span>
          </div>

          <div className="space-y-2.5">
            {smsUpdates.map((item, idx) => {
              const isWhatsApp = item.channel === "whatsapp";
              return (
                <div
                  key={`${item.sentAt}-${idx}`}
                  className={`rounded-2xl border p-3.5 shadow-xs transition ${
                    isWhatsApp
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-sky-200 bg-sky-50/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isWhatsApp
                            ? "bg-emerald-600 text-white"
                            : "bg-sky-600 text-white"
                        }`}
                      >
                        {isWhatsApp ? (
                          <MessageCircle size={10} />
                        ) : (
                          <Smartphone size={10} />
                        )}
                        <span>{isWhatsApp ? "WhatsApp" : "SMS"}</span>
                      </span>
                      <span className="text-xs font-semibold text-ink">
                        To: {item.recipientPhone || "Student Phone"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{formatDate(item.sentAt)}</span>
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-ink bg-white/80 p-2.5 rounded-xl border border-line/60">
                    "{item.message}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Official Status Milestones */}
      {(activeTab === "all" || activeTab === "milestones") && (
        <div className={activeTab === "all" ? "mt-5 border-t border-line pt-4" : "mt-4"}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Official Complaint Milestones
          </span>

          {sortedHistory.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              No milestones recorded yet.
            </p>
          ) : (
            <ol className="mt-3 space-y-3.5 border-l border-brand/20 pl-4">
              {sortedHistory.map((entry, index) => (
                <li
                  key={`${entry.status}-${entry.changedAt || "unknown"}-${index}`}
                  className="relative"
                >
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand shadow-xs" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">
                      {formatStatus(entry.status)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatDate(entry.changedAt)}
                      {includeActorRole && entry.changedByRole
                        ? ` · by ${entry.changedByRole}${
                            entry.changedBySnapshot?.name
                              ? ` (${entry.changedBySnapshot.name})`
                              : ""
                          }`
                        : ""}
                    </p>
                    {entry.note && (
                      <p className="mt-1 text-xs leading-relaxed text-muted bg-white/70 p-2 rounded-lg border border-line/50">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
