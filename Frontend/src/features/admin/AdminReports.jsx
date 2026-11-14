import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Gauge,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  getAdminComplaintReportsRequest,
  getExecutiveReportsRequest,
  getAdminReportInsightsRequest,
} from "../../services/api.js";
import { formatStatus } from "../../utils/complaintConfig.js";
import { useAssistantContext } from "../../context/assistantContext.jsx";

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
    rose: "bg-rose-50 text-rose-700",
    purple: "bg-purple-50 text-purple-700",
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
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneStyles[tone] || toneStyles.brand}`}>
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
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "executive"
  const [period, setPeriod] = useState("90d");
  const [report, setReport] = useState(null);
  const [execReport, setExecReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [aiInsight, setAiInsight] = useState("");
  const [aiInsightSource, setAiInsightSource] = useState("");
  const [aiInsightError, setAiInsightError] = useState("");
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const requestIdRef = useRef(0);
  const { setScreenContext } = useAssistantContext();

  useEffect(() => {
    setScreenContext({
      currentSection: "admin-reports",
      pageTitle: activeTab === "executive"
        ? "Executive Facility Health, MTTR & SLA Analytics"
        : "Executive Reports, Resolution Trends & KPI Analytics",
      activeFilters: { period, tab: activeTab },
      reportSummary: (activeTab === "executive" ? execReport?.summary : report?.summary) || null,
      interactiveElements: [
        "tabSelector: overview, executive",
        "periodFilterPills: 30d, 90d, 12m, all",
        "generateAiInsightsButton",
        "metricCards",
        "mttrDepartmentBarChart",
        "slaBreachHeatmapTable",
        "technicianEfficiencyTable",
      ],
      availableActions: ["filter", "clearFilters", "navigate"],
    });
  }, [activeTab, period, report, execReport, setScreenContext]);

  useEffect(() => {
    function handleSetFilters(e) {
      const { period: targetPeriod, filter } = e.detail || {};
      const next = targetPeriod || filter;
      if (next && ["30d", "90d", "12m", "all"].includes(next)) {
        setPeriod(next);
      }
    }

    function handleClearFilters() {
      setPeriod("90d");
    }

    window.addEventListener("fixflow:set-filters", handleSetFilters);
    window.addEventListener("fixflow:clear-filters", handleClearFilters);

    return () => {
      window.removeEventListener("fixflow:set-filters", handleSetFilters);
      window.removeEventListener("fixflow:clear-filters", handleClearFilters);
    };
  }, []);

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    setError("");
    try {
      if (activeTab === "executive") {
        const data = await getExecutiveReportsRequest(period, accessToken);
        if (requestId === requestIdRef.current) setExecReport(data);
      } else {
        const data = await getAdminComplaintReportsRequest(period, accessToken);
        if (requestId === requestIdRef.current) setReport(data);
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) setError(requestError.message || "Could not load complaint reports.");
    } finally {
      if (requestId === requestIdRef.current) setRefreshing(false);
    }
  }, [accessToken, activeTab, period]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    if (activeTab === "executive") {
      getExecutiveReportsRequest(period, accessToken)
        .then((data) => {
          if (requestId === requestIdRef.current) setExecReport(data);
        })
        .catch((requestError) => {
          if (requestId === requestIdRef.current) setError(requestError.message || "Could not load executive reports.");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    } else {
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
    }
  }, [accessToken, activeTab, period]);

  const summary = report?.summary || {};
  const execSummary = execReport?.summary || {};
  const maxTrend = Math.max(1, ...(report?.trend || []).flatMap((item) => [item.submitted, item.resolved]));
  const periodLabel = periodOptions.find((option) => option.value === period)?.label.toLowerCase();

  async function generateInsights() {
    const currentReport = activeTab === "executive" ? execReport : report;
    if (!currentReport || aiInsightLoading) return;
    setAiInsightLoading(true);
    setAiInsightError("");
    setAiInsight("");
    setAiInsightSource("");
    try {
      const isExec = activeTab === "executive";
      const s = currentReport.summary || {};
      const result = await getAdminReportInsightsRequest({
        period: periodOptions.find((option) => option.value === period)?.label,
        summary: {
          total: s.total ?? 0,
          current: s.current ?? (s.total - (s.resolved ?? 0)),
          resolved: s.resolved ?? 0,
          averageResolutionHours: isExec ? (s.avgResolutionHours ?? null) : (s.averageResolutionHours ?? null),
        },
        categories: (report?.categories || []).map((entry) => ({ label: String(entry._id || "Other"), count: entry.count })),
        statuses: (report?.statuses || []).map((entry) => ({ label: formatStatus(String(entry._id || "Other")), count: entry.count })),
        departments: isExec
          ? (execReport?.mttrByDepartment || []).map((entry) => ({ label: String(entry.department || "Unassigned"), count: entry.total }))
          : (report?.departments || []).map((entry) => ({ label: String(entry._id || "Unassigned"), count: entry.count })),
      }, accessToken);
      setAiInsight(result.insights || "No insights were returned.");
      setAiInsightSource(result.source || "gemini");
    } catch (requestError) {
      setAiInsightError(requestError.message || "Could not generate report insights.");
    } finally {
      setAiInsightLoading(false);
    }
  }

  const openMetric = (title, value, description, extra) => setSelectedDetail({ title, value, description, content: extra });
  const openBreakdown = (title, entries, total) => setSelectedDetail({
    title,
    description: `Breakdown for complaints submitted ${periodLabel}.`,
    content: entries.length ? <div className="mt-4 space-y-3">{entries.map((entry) => <div key={entry._id} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-3"><span className="min-w-0 break-words text-sm font-semibold text-ink">{formatStatus(String(entry._id || "Other"))}</span><span className="shrink-0 text-sm tabular-nums text-muted">{entry.count} ({total ? Math.round(entry.count / total * 100) : 0}%)</span></div>)}</div> : <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">No data is available for this period.</p>,
  });

  // Calculate slowest technician for highlight
  const resolvedTechs = (execReport?.technicianEfficiency || []).filter((t) => t.avgResolveHours !== null);
  const maxResolveHours = resolvedTechs.length ? Math.max(...resolvedTechs.map((t) => t.avgResolveHours)) : null;

  return (
    <main className="w-full min-w-0">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">Administrator workspace</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {activeTab === "executive" ? "Executive MTTR & SLA Analytics" : "Complaint reports"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {activeTab === "executive"
              ? "High-level facility health, resolution MTTR, SLA breach heatmap, and technician efficiency."
              : "See complaint volume, outcomes, and workload across campus."}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(9rem,1fr)_auto_auto]">
          <label htmlFor="report-period" className="sr-only">Report time period</label>
          <select
            id="report-period"
            value={period}
            onChange={(event) => {
              requestIdRef.current += 1;
              setReport(null);
              setExecReport(null);
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
          <button
            type="button"
            onClick={generateInsights}
            disabled={(!report && !execReport) || loading || aiInsightLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10"
          >
            {aiInsightLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {aiInsightLoading ? "Analyzing…" : "AI insights"}
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <nav aria-label="Reports Views" className="mt-6 flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition focus-visible:outline-none ${
            activeTab === "overview"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Layers size={16} />
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("executive")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition focus-visible:outline-none ${
            activeTab === "executive"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Gauge size={16} />
          Executive
        </button>
      </nav>

      {error && (
        <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(aiInsight || aiInsightError) && (
        <section className={`mt-5 rounded-2xl border p-4 sm:p-5 ${aiInsightError ? "border-rose-200 bg-rose-50" : "border-brand/15 bg-gradient-to-br from-brand-soft/60 to-white"}`}>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink">{aiInsightSource === "fallback" ? "AI insights unavailable" : "AI report insights"}</h2>
              <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${aiInsightError ? "text-rose-800" : "text-muted"}`}>{aiInsightError || aiInsight}</p>
              <p className="mt-2 text-[11px] text-muted">Generated from aggregate metrics; verify insights against the dashboard tables.</p>
            </div>
          </div>
        </section>
      )}

      {loading && (activeTab === "overview" ? !report : !execReport) ? (
        <div className="mt-6 flex min-h-56 items-center justify-center gap-2 rounded-2xl border border-line bg-white text-sm text-muted">
          <RefreshCw size={18} className="animate-spin text-brand" /> Loading analytics…
        </div>
      ) : activeTab === "overview" ? (
        /* ================= OVERVIEW TAB ================= */
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
      ) : (
        /* ================= EXECUTIVE TAB ================= */
        <div className={`mt-6 space-y-6 transition-opacity ${loading || refreshing ? "opacity-60" : "opacity-100"}`}>
          {/* Executive Summary Metrics with Sample Sizes (n=...) */}
          <section aria-label="Executive summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Clock3}
              label="Campus MTTR"
              value={execSummary.avgResolutionHours !== null ? `MTTR ${execSummary.avgResolutionHours}h (n=${execSummary.resolved})` : "No resolved complaints in this period"}
              hint={execSummary.avgResolutionHours !== null ? `Mean Time to Resolve (${execSummary.resolved} resolved)` : "Awaiting complaint resolutions"}
              tone="amber"
            />
            <MetricCard
              icon={Activity}
              label="Avg First Response"
              value={execSummary.avgFirstResponseHours !== null ? `${execSummary.avgFirstResponseHours}h (n=${execSummary.total})` : "No resolved complaints in this period"}
              hint={execSummary.avgFirstResponseHours !== null ? `Initial staff acknowledgment time` : "No acknowledgment records"}
              tone="blue"
            />
            <MetricCard
              icon={ShieldAlert}
              label="SLA Breach Rate"
              value={execSummary.overallSlaBreachRate !== null ? `${execSummary.overallSlaBreachRate}% (n=${execSummary.total})` : "No resolved complaints in this period"}
              hint={execSummary.overallSlaBreachRate !== null ? `Complaints exceeding SLA promise` : "No active or resolved tickets"}
              tone="rose"
            />
            <MetricCard
              icon={Star}
              label="Campus CSAT"
              value={execSummary.avgCsat !== null ? `${execSummary.avgCsat} ★ (n=${execSummary.resolved})` : "No resolved complaints in this period"}
              hint={execSummary.avgCsat !== null ? `Student satisfaction score (1–5 scale)` : "No student CSAT ratings"}
              tone="green"
            />
          </section>

          {/* Section 1: MTTR by Department Bar Chart (Recharts) */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                  <BarChart3 size={18} className="text-brand" />
                  MTTR by Department (Mean Time to Resolution)
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Compares average resolution duration (MTTR) against initial acknowledgment response time.
                </p>
              </div>
            </div>

            {(!execReport?.mttrByDepartment?.length || execReport.mttrByDepartment.every((d) => d.resolved === 0 && d.total === 0)) ? (
              <p className="mt-6 rounded-xl bg-canvas px-4 py-12 text-center text-sm font-medium text-muted">
                No resolved complaints in this period
              </p>
            ) : (
              <div className="mt-6">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={execReport.mttrByDepartment.map((d) => ({
                        department: d.department,
                        mttr: d.avgResolutionHours,
                        firstResponse: d.avgFirstResponseHours,
                        resolved: d.resolved,
                        total: d.total,
                        breachRate: d.slaBreachRate,
                      }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="department" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="h" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", borderColor: "#cbd5e1" }}
                        formatter={(val, name, props) => {
                          const n = name === "MTTR (Hours)" ? props.payload.resolved : props.payload.total;
                          return [val !== null ? `${val}h (n=${n})` : "No resolved complaints in this period", name];
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="mttr" name="MTTR (Hours)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="firstResponse" name="First Response (Hours)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Sample Size Breakdown Cards for each department */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {execReport.mttrByDepartment.map((dept) => (
                    <div key={dept.department} className="rounded-xl border border-line bg-canvas/60 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-ink">{dept.department}</span>
                        <span className="text-xs font-semibold text-muted">Total: {dept.total}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="flex justify-between text-slate-700">
                          <span>MTTR:</span>
                          <span className="font-bold text-sky-800">
                            {dept.avgResolutionHours !== null ? `MTTR ${dept.avgResolutionHours}h (n=${dept.resolved})` : "No resolved complaints in this period"}
                          </span>
                        </p>
                        <p className="flex justify-between text-slate-700">
                          <span>First Response:</span>
                          <span className="font-medium text-emerald-800">
                            {dept.avgFirstResponseHours !== null ? `${dept.avgFirstResponseHours}h (n=${dept.total})` : "—"}
                          </span>
                        </p>
                        <p className="flex justify-between text-slate-700">
                          <span>SLA Breach Rate:</span>
                          <span className={`font-semibold ${dept.slaBreachRate >= 20 ? "text-rose-700" : "text-slate-800"}`}>
                            {dept.slaBreachRate !== null ? `${dept.slaBreachRate}% (n=${dept.total})` : "—"}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section 2: SLA Breach Heatmap Table */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="border-b border-line pb-4">
              <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-600" />
                SLA Breach Heatmap (Top Campus Locations)
              </h2>
              <p className="mt-1 text-xs text-muted">
                Facility locations sorted by highest SLA breach rate descending (red ≥ 30%, amber 10–29%, green &lt; 10%).
              </p>
            </div>

            {(!execReport?.slaBreachHeatmap?.length || execReport.slaBreachHeatmap.every((c) => c.total === 0)) ? (
              <p className="mt-6 rounded-xl bg-canvas px-4 py-12 text-center text-sm font-medium text-muted">
                No resolved complaints in this period
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                      <th className="py-3 px-3">Building</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-right">Breach Count</th>
                      <th className="py-3 px-3 text-right">Total Sample</th>
                      <th className="py-3 px-3 text-right">Breach Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {execReport.slaBreachHeatmap.map((cell, idx) => {
                      const rate = cell.breachRate;
                      let badgeClasses = "bg-slate-100 text-slate-700 border-slate-200";
                      if (rate !== null) {
                        if (rate >= 30) badgeClasses = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
                        else if (rate >= 10) badgeClasses = "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
                        else badgeClasses = "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium";
                      }

                      return (
                        <tr key={`${cell.building}-${cell.department}-${idx}`} className="hover:bg-canvas/50 transition">
                          <td className="py-3 px-3 font-semibold text-ink">{cell.building}</td>
                          <td className="py-3 px-3 text-slate-700">{cell.department}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-800 font-medium">{cell.breachCount}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-muted">{cell.total}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs tabular-nums ${badgeClasses}`}>
                              {rate !== null ? `${rate}% (n=${cell.total})` : "No resolved complaints in this period"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 3: Technician Efficiency Table */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="border-b border-line pb-4">
              <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                <Users size={18} className="text-brand" />
                Technician Efficiency & Response Performance
              </h2>
              <p className="mt-1 text-xs text-muted">
                Staff workload, acknowledgment time, resolution MTTR, and average student satisfaction rating.
              </p>
            </div>

            {!execReport?.technicianEfficiency?.length ? (
              <p className="mt-6 rounded-xl bg-canvas px-4 py-12 text-center text-sm font-medium text-muted">
                No resolved complaints in this period
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                      <th className="py-3 px-3">Technician</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-right">Assigned</th>
                      <th className="py-3 px-3 text-right">Resolved</th>
                      <th className="py-3 px-3 text-right">Avg Acknowledge</th>
                      <th className="py-3 px-3 text-right">Avg Resolve (MTTR)</th>
                      <th className="py-3 px-3 text-right">Avg CSAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {execReport.technicianEfficiency.map((tech) => {
                      const isSlowest = maxResolveHours !== null && tech.avgResolveHours === maxResolveHours && resolvedTechs.length > 1;

                      return (
                        <tr key={tech.staffId} className="hover:bg-canvas/50 transition">
                          <td className="py-3 px-3 font-semibold text-ink">
                            <div className="flex items-center gap-2">
                              <span>{tech.name}</span>
                              <span className="text-xs text-muted font-normal">(ID: {tech.staffId})</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">{tech.department}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-800 font-medium">
                            {tech.assigned} <span className="text-xs text-muted">(n={tech.assigned})</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-800 font-medium">
                            {tech.resolved} <span className="text-xs text-muted">(n={tech.resolved})</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                            {tech.avgAcknowledgeHours !== null
                              ? `${tech.avgAcknowledgeHours}h (n=${tech.assigned})`
                              : "—"}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            {tech.avgResolveHours !== null ? (
                              <span className="inline-flex items-center gap-1.5 font-bold text-sky-900">
                                {isSlowest && (
                                  <span className="inline-flex rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                                    Slowest MTTR
                                  </span>
                                )}
                                MTTR {tech.avgResolveHours}h (n={tech.resolved})
                              </span>
                            ) : (
                              <span className="text-xs text-muted">No resolved complaints in this period</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold text-emerald-800">
                            {tech.avgCsat !== null ? `${tech.avgCsat} ★ (n=${tech.resolved})` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 4: CSAT by Department */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="border-b border-line pb-4">
              <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                <Star size={18} className="text-amber-500 fill-amber-500" />
                CSAT Breakdown by Department
              </h2>
              <p className="mt-1 text-xs text-muted">
                Departmental student satisfaction metrics and count of low ratings (&le; 2 stars).
              </p>
            </div>

            {(!execReport?.csatByDepartment?.length || execReport.csatByDepartment.every((c) => c.ratingsCount === 0)) ? (
              <p className="mt-6 rounded-xl bg-canvas px-4 py-12 text-center text-sm font-medium text-muted">
                No resolved complaints in this period
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {execReport.csatByDepartment.map((item) => (
                  <div key={item.department} className="rounded-xl border border-line bg-canvas/40 p-4">
                    <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                      <span className="font-bold text-ink text-sm">{item.department}</span>
                      <span className="font-extrabold text-base text-amber-600 flex items-center gap-1">
                        {item.avgCsat !== null ? `${item.avgCsat} ★` : "—"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <p className="flex justify-between text-slate-700">
                        <span>Total Ratings:</span>
                        <span className="font-semibold text-slate-900">(n={item.ratingsCount})</span>
                      </p>
                      <p className="flex justify-between text-slate-700">
                        <span>Low Ratings (&le; 2 Stars):</span>
                        <span className={`font-bold ${item.lowRatingCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {item.lowRatingCount} (n={item.ratingsCount})
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-right text-xs text-muted">
            {execReport?.generatedAt ? `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(execReport.generatedAt))}` : ""}
          </p>
        </div>
      )}

      <ReportDetailsModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </main>
  );
}
