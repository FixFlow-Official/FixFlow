import { AlertTriangle, Bot, Info } from "lucide-react";

const priorityStyle = {
  P1: "bg-rose-100 text-rose-800",
  P2: "bg-amber-100 text-amber-900",
  P3: "bg-sky-100 text-sky-800",
  P4: "bg-stone-100 text-stone-700",
};

const reviewLabels = {
  actionable: "Ready for staff review",
  needs_details: "Could use more detail",
  check_relevance: "Please confirm campus relevance",
};

export default function ComplaintAiTriage({ triage, compact = false }) {
  if (!triage?.summary) return null;
  return (
    <section className={`rounded-2xl border ${triage.safetyConcern ? "border-rose-200 bg-rose-50/80" : "border-brand/15 bg-gradient-to-br from-brand-soft/70 to-white"} ${compact ? "p-3" : "p-4"}`} aria-label="AI complaint triage recommendation">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${triage.safetyConcern ? "bg-rose-100 text-rose-700" : "bg-white text-brand shadow-sm"}`}>
          {triage.safetyConcern ? <AlertTriangle size={18} /> : <Bot size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-ink">{triage.provider === "gemini" ? "AI triage recommendation" : "Automated triage fallback"}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyle[triage.priority] || priorityStyle.P3}`}>{triage.priority || "P3"} · {triage.urgency || "Normal"}</span>
            {triage.reviewSignal && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${triage.reviewSignal === "check_relevance" ? "bg-amber-100 text-amber-900" : triage.reviewSignal === "needs_details" ? "bg-violet-100 text-violet-900" : "bg-emerald-100 text-emerald-900"}`}>{reviewLabels[triage.reviewSignal] || "AI review"}</span>}
            {triage.safetyConcern && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">Safety review</span>}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">{triage.summary}</p>
          <p className="mt-2 text-xs text-muted">Suggested category: <span className="font-semibold text-ink">{triage.suggestedCategory}</span> · Current category: <span className="font-semibold text-ink">{triage.currentCategory || triage.suggestedCategory}</span></p>
          {triage.reviewSignal === "check_relevance" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{triage.reviewSignalReason} AI cannot determine whether an event is true. Add details or confirm it is an actual campus issue so staff can review it.</p>}
          {triage.reviewSignal === "needs_details" && triage.reviewSignalReason && <p className="mt-2 text-xs leading-5 text-violet-800">{triage.reviewSignalReason}</p>}
          {!compact && triage.missingInformation?.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/80 p-3 text-xs leading-5 text-ink"><Info size={15} className="mt-0.5 shrink-0 text-brand" /><div><p className="font-semibold">Details that may help staff</p><ul className="mt-1 list-inside list-disc text-muted">{triage.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
          )}
          {triage.relatedOpenReports > 0 && <p className="mt-2 text-xs font-medium text-amber-800">{triage.relatedOpenReports} recent open report{triage.relatedOpenReports === 1 ? "" : "s"} with this title and building may be related. Staff should verify before treating them as duplicates.</p>}
          {!compact && <p className="mt-2 text-xs leading-5 text-muted">{triage.rationale} AI suggestions can be wrong; campus staff review and decide.</p>}
        </div>
      </div>
    </section>
  );
}
