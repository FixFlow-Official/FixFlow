import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
  X,
} from "lucide-react";
import { getAdminComplaintReportsRequest } from "../../services/api.js";
import { formatStatus } from "../../utils/complaintConfig.js";

const periodOptions = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

function formatResolutionTime(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(Number(hours))) return "—";
  const duration = Number(hours);
  if (duration >= 48) return `${(duration / 24).toFixed(1)} days`;
  return `${duration.toFixed(1)} hours`;
}

function formatTrendLabel(value, period) {
  if (period === "30d") {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  }
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

function MetricCard({ icon: Icon, label, value, hint, tone = "brand", onClick }) {
  const toneStyles = {
    brand: "bg-brand-soft text-brand",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open details for ${label}`}
      className="w-full rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneStyles[tone]}`}>
          <Icon size={19} />
        </span>
      </div>
    </button>
  );
}

function Breakdown({ title, entries, total, emptyText, onClick }) {
  const max = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <button type="button" onClick={onClick} aria-label={`Open details for ${title}`} className="min-w-0 w-full rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 sm:p-5">
      <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-6 rounded-xl bg-canvas px-3 py-5 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {entries.map((entry) => {
            const label = formatStatus(String(entry._id || "Other"));
            const share = total ? Math.round((entry.count / total) * 100) : 0;
            return (
              <div key={entry._id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-ink" title={label}>{label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{entry.count} · {share}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${label}: ${entry.count} complaints, ${share}%`}>
                  <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(entry.count ? 3 : 0, (entry.count / max) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}

function ReportDetailsModal({ detail, onClose }) {
  useEffect(() => {
    if (!detail) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detail, onClose]);

  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-md sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="report-detail-title" className="flex max-h-[min(88dvh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-line p-4 sm:p-6">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">Report details</span>
            <h2 id="report-detail-title" className="mt-2 break-words font-display text-xl font-bold text-ink sm:text-2xl">{detail.title}</h2>
            {detail.description && <p className="mt-1 text-sm leading-5 text-muted">{detail.description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close report details" className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"><X size={18} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {detail.value !== undefined && <p className="font-display text-4xl font-extrabold tracking-tight text-brand">{detail.value}</p>}
          {detail.content}
        </div>
      </section>
    </div>
  );
}

export default function AdminReports({ accessToken }) {
  const [period, setPeriod] = useState("90d");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const requestIdRef = useRef(0);

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    setError("");
    try {
      const data = await getAdminComplaintReportsRequest(period, accessToken);
      if (requestId === requestIdRef.current) setReport(data);
    } catch (requestError) {
      if (requestId === requestIdRef.current) setError(requestError.message || "Could not load complaint reports.");
    } finally {
      if (requestId === requestIdRef.current) setRefreshing(false);
    }
  }, [accessToken, period]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    getAdminComplaintReportsRequest(period, accessToken)
      .then((data) => {
        if (requestId === requestIdRef.current) setReport(data);
      })
      .catch((requestError) => {
        if (requestId === requestIdRef.current) setError(requestError.message || "Could not load complaint reports.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [accessToken, period]);

  const summary = report?.summary || {};
  const maxTrend = Math.max(1, ...(report?.trend || []).flatMap((item) => [item.submitted, item.resolved]));
  const periodLabel = periodOptions.find((option) => option.value === period)?.label.toLowerCase();
  const openMetric = (title, value, description, extra) => setSelectedDetail({ title, value, description, content: extra });
  const openBreakdown = (title, entries, total) => setSelectedDetail({
    title,
    description: `Breakdown for complaints submitted ${periodLabel}.`,
    content: entries.length ? <div className="mt-4 space-y-3">{entries.map((entry) => <div key={entry._id} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-3"><span className="min-w-0 break-words text-sm font-semibold text-ink">{formatStatus(String(entry._id || "Other"))}</span><span className="shrink-0 text-sm tabular-nums text-muted">{entry.count} ({total ? Math.round(entry.count / total * 100) : 0}%)</span></div>)}</div> : <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">No data is available for this period.</p>,
  });

  return (
    <main className="w-full min-w-0">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">Administrator workspace</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Complaint reports</h1>
          <p className="mt-2 text-sm leading-6 text-muted">See complaint volume, outcomes, and workload across campus.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(9rem,1fr)_auto]">
          <label htmlFor="report-period" className="sr-only">Report time period</label>
          <select
            id="report-period"
            value={period}
            onChange={(event) => {
              requestIdRef.current += 1;
              setReport(null);
              setLoading(true);
              setError("");
              setPeriod(event.target.value);
            }}
            className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 sm:min-h-10 sm:min-w-36"
          >
            {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button
            type="button"
            onClick={loadReport}
            disabled={loading || refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60 sm:min-h-10"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !report ? (
        <div className="mt-6 flex min-h-56 items-center justify-center gap-2 rounded-2xl border border-line bg-white text-sm text-muted">
          <RefreshCw size={18} className="animate-spin text-brand" /> Loading reports…
        </div>
      ) : (
        <div className={`mt-6 space-y-5 transition-opacity ${loading || refreshing ? "opacity-60" : "opacity-100"}`}>
          <section aria-label="Complaint summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={ClipboardList} label="Total complaints" value={summary.total ?? 0} hint={`Submitted ${periodLabel}`} tone="blue" onClick={() => openMetric("Total complaints", summary.total ?? 0, `Complaints submitted ${periodLabel}.`)} />
            <MetricCard icon={Activity} label="Currently active" value={summary.current ?? 0} hint="Submitted, assigned, or being handled" tone="brand" onClick={() => openMetric("Currently active", summary.current ?? 0, "Complaints that are not yet resolved.")} />
            <MetricCard icon={CheckCircle2} label="Resolved" value={summary.resolved ?? 0} hint={`Resolved from complaints submitted ${periodLabel}`} tone="green" onClick={() => openMetric("Resolved complaints", summary.resolved ?? 0, `Complaints submitted ${periodLabel} that have been resolved.`)} />
            <MetricCard icon={Clock3} label="Average resolution" value={formatResolutionTime(summary.averageResolutionHours)} hint="Time from submission to resolution" tone="amber" onClick={() => openMetric("Average resolution time", formatResolutionTime(summary.averageResolutionHours), "Average elapsed time between complaint submission and resolution.")} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
            <button
              type="button"
              onClick={() => {
                const activity = report?.trend || [];
                const submittedTotal = activity.reduce((sum, item) => sum + item.submitted, 0);
                const resolvedTotal = activity.reduce((sum, item) => sum + item.resolved, 0);
                setSelectedDetail({
                  title: "Complaint activity details",
                  description: `Submitted and resolved complaint counts for ${periodLabel}.`,
                  content: activity.length ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-medium text-sky-800">Submitted in shown intervals</p><p className="mt-1 font-display text-2xl font-bold text-sky-900">{submittedTotal}</p></div>
                        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-medium text-emerald-800">Resolved in shown intervals</p><p className="mt-1 font-display text-2xl font-bold text-emerald-900">{resolvedTotal}</p></div>
                      </div>
                      <div className="space-y-2">
                        {activity.map((item) => (
                          <div key={item._id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-line px-3 py-3 text-sm">
                            <span className="min-w-0 truncate font-semibold text-ink">{formatTrendLabel(item._id, period)}</span>
                            <span className="whitespace-nowrap text-xs font-medium text-brand">{item.submitted} submitted</span>
                            <span className="whitespace-nowrap text-xs font-medium text-emerald-700">{item.resolved} resolved</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">No complaint activity is available for this period.</p>,
                });
              }}
              aria-label="Open complaint activity details"
              className="min-w-0 w-full rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-ink">Complaint activity</h2>
                  <p className="mt-1 text-xs text-muted">Submitted complaints and the subset resolved in each period.</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand" /> Submitted</span>
                  <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-emerald-500" /> Resolved</span>
                </div>
              </div>
              {report?.trend?.length ? (
                <div className="mt-5 overflow-x-auto pb-2">
                  <div className="flex h-52 min-w-max items-end gap-2 border-b border-line px-1 sm:gap-3">
                    {report.trend.map((item) => (
                      <div key={item._id} className="flex h-full w-9 flex-col items-center justify-end sm:w-11" title={`${formatTrendLabel(item._id, period)}: ${item.submitted} submitted, ${item.resolved} resolved`}>
                        <div className="flex h-40 w-full items-end justify-center gap-1">
                          <div className="w-3 rounded-t bg-brand sm:w-4" style={{ height: `${item.submitted ? Math.max(4, (item.submitted / maxTrend) * 100) : 0}%` }} />
                          <div className="w-3 rounded-t bg-emerald-500 sm:w-4" style={{ height: `${item.resolved ? Math.max(4, (item.resolved / maxTrend) * 100) : 0}%` }} />
                        </div>
                        <span className="mt-2 w-full truncate text-center text-[10px] text-muted">{formatTrendLabel(item._id, period)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-canvas px-3 py-10 text-center text-sm text-muted">No complaints were submitted in this period.</p>
              )}
            </button>

            <button type="button" onClick={() => openBreakdown("Status breakdown", report?.statuses || [], summary.total || 0)} aria-label="Open status breakdown details" className="rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 sm:p-5">
              <h2 className="font-display text-base font-bold text-ink">Status breakdown</h2>
              <p className="mt-1 text-xs text-muted">How complaints submitted {periodLabel} are currently classified.</p>
              {report?.statuses?.length ? (
                <div className="mt-4 space-y-3">
                  {report.statuses.map((item) => {
                    const share = summary.total ? Math.round((item.count / summary.total) * 100) : 0;
                    return <div key={item._id} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{formatStatus(item._id)}</span><div className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} /></div><span className="w-8 text-right text-xs tabular-nums text-muted">{item.count}</span></div>;
                  })}
                </div>
              ) : <p className="mt-6 text-sm text-muted">No status data is available.</p>}
            </button>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <Breakdown title="Complaints by category" entries={report?.categories || []} total={summary.total || 0} emptyText="No category data is available for this period." onClick={() => openBreakdown("Complaints by category", report?.categories || [], summary.total || 0)} />
            <Breakdown title="Complaints by department" entries={report?.departments || []} total={summary.total || 0} emptyText="No department data is available for this period." onClick={() => openBreakdown("Complaints by department", report?.departments || [], summary.total || 0)} />
          </section>

          <p className="text-right text-xs text-muted">
            {report?.generatedAt ? `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt))}` : ""}
          </p>
        </div>
      )}
      <ReportDetailsModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </main>
  );
}
