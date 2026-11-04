import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BellRing, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Save, ShieldAlert, X } from "lucide-react";
import ComplaintPagination from "../../components/complaints/ComplaintPagination.jsx";
import {
  getAdminComplaintSlaHistoryRequest,
  getAdminSlaOverviewRequest,
  updateAdminSlaPoliciesRequest,
} from "../../services/api.js";

const policyFields = [
  { key: "responseHours", label: "First response (hours)" },
  { key: "resolutionHours", label: "Resolution target (hours)" },
  { key: "reminderBeforeHours", label: "Reminder before due (hours)" },
];

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function eventLabel(type) {
  return String(type || "SLA event").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminSlaPage({ accessToken }) {
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState(null);
  const [historyLoadingId, setHistoryLoadingId] = useState("");

  const loadOverview = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    setError("");
    try {
      const data = await getAdminSlaOverviewRequest({ page, limit: 20, view }, accessToken);
      setOverview(data);
      setPolicies(data.policies || []);
    } catch (requestError) {
      setError(requestError.message || "Could not load SLA tracking.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, page, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOverview(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    if (!history) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setHistory(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [history]);

  function updatePolicy(category, key, value) {
    setPolicies((current) => current.map((policy) => policy.category === category
      ? { ...policy, [key]: value === "" ? "" : Number(value) }
      : policy));
  }

  async function savePolicies(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await updateAdminSlaPoliciesRequest(policies, accessToken);
      setPolicies(result.policies || policies);
      setSuccess(result.message || "SLA targets saved.");
      await loadOverview(false);
    } catch (requestError) {
      setError(requestError.message || "Could not save SLA targets.");
    } finally {
      setSaving(false);
    }
  }

  async function showHistory(complaint) {
    setHistoryLoadingId(complaint._id);
    try {
      const result = await getAdminComplaintSlaHistoryRequest(complaint._id, accessToken);
      setHistory({ complaint, events: result.events || [] });
    } catch (requestError) {
      setError(requestError.message || "Could not load this complaint’s SLA history.");
    } finally {
      setHistoryLoadingId("");
    }
  }

  const counts = overview?.counts || { responseOverdue: 0, resolutionOverdue: 0 };
  const complaints = overview?.complaints || [];
  const recentEvents = overview?.recentEvents || [];

  return (
    <main className="w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">Administrator workspace</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">SLA tracking</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Set response and resolution targets, watch overdue complaints, and review escalations.</p>
        </div>
        <button type="button" onClick={() => loadOverview()} disabled={refreshing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink hover:border-brand disabled:opacity-60">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}
      {success && <p role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{success}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Clock3 size={17} />Response overdue</p><p className="mt-2 font-display text-3xl font-extrabold text-amber-950">{counts.responseOverdue}</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-rose-900"><ShieldAlert size={17} />Resolution overdue</p><p className="mt-2 font-display text-3xl font-extrabold text-rose-950">{counts.resolutionOverdue}</p></div>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Clock3 size={19} /></span><div><h2 className="font-display text-lg font-bold text-ink">Category targets</h2><p className="mt-1 text-sm text-muted">Targets start when a complaint is submitted. Saving changes updates currently open complaints too.</p></div></div>
        <form onSubmit={savePolicies} className="mt-5">
          {loading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" /> Loading targets…</div> : (
            <>
              <div className="space-y-3">
                {policies.map((policy) => (
                  <div key={policy.category} className="grid gap-3 rounded-xl border border-line bg-canvas/50 p-3 sm:grid-cols-[minmax(8rem,1fr)_repeat(3,minmax(8rem,1fr))] sm:items-end">
                    <h3 className="pb-1 text-sm font-bold text-ink">{policy.category}</h3>
                    {policyFields.map((field) => (
                      <label key={field.key} className="block text-xs font-semibold text-muted">
                        <span>{field.label}</span>
                        <input type="number" step="1" min={field.key === "reminderBeforeHours" ? 0 : 1} max={field.key === "resolutionHours" ? 2160 : field.key === "responseHours" ? 720 : 168} required value={policy[field.key] ?? ""} onChange={(event) => updatePolicy(policy.category, field.key, event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3"><button type="submit" disabled={saving || loading || policies.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save targets</button><p className="text-xs text-muted">Reminder hours must not exceed either SLA target.</p></div>
            </>
          )}
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="font-display text-lg font-bold text-ink">Overdue queue</h2><p className="mt-1 text-sm text-muted">Active complaints past their response or resolution target.</p></div>
          <label className="text-xs font-semibold text-muted">Show queue<select value={view} onChange={(event) => { setView(event.target.value); setPage(1); }} className="mt-1 block min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink sm:min-w-48"><option value="all">All overdue targets</option><option value="response">Response overdue</option><option value="resolution">Resolution overdue</option></select></label>
        </div>
        {loading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" /> Loading overdue complaints…</div> : complaints.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-line bg-canvas/60 px-4 py-8 text-center text-sm text-muted">No complaints are currently overdue for this queue.</p> : (
          <div className="mt-4 space-y-3">
            {complaints.map((complaint) => <article key={complaint._id} className="rounded-xl border border-line p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><h3 className="break-words font-semibold text-ink">{complaint.complaintTitle}</h3><p className="mt-1 text-xs text-muted">{complaint.category} · {complaint.assignedStaff?.username || "Unassigned"} · {complaint.status?.replaceAll("_", " ")}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"><span className={complaint.slaFirstRespondedAt ? "text-emerald-700" : new Date(complaint.slaResponseDueAt) < new Date() ? "font-semibold text-rose-700" : "text-muted"}>Response due {formatDate(complaint.slaResponseDueAt)}</span><span className={new Date(complaint.slaResolutionDueAt) < new Date() ? "font-semibold text-rose-700" : "text-muted"}>Resolution due {formatDate(complaint.slaResolutionDueAt)}</span></div></div>
                <button type="button" onClick={() => showHistory(complaint)} disabled={historyLoadingId === complaint._id} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-60">{historyLoadingId === complaint._id ? <LoaderCircle size={14} className="animate-spin" /> : <BellRing size={14} />} SLA history</button>
              </div>
            </article>)}
          </div>
        )}
        <ComplaintPagination pagination={overview?.pagination} onPageChange={setPage} />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <div><h2 className="font-display text-lg font-bold text-ink">Reminder and escalation history</h2><p className="mt-1 text-sm text-muted">Automated reminders and target breaches recorded by FixFlow.</p></div>
        {recentEvents.length === 0 ? <p className="mt-4 rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">No SLA reminders or escalations have been recorded yet.</p> : <div className="mt-4 divide-y divide-line">{recentEvents.map((event) => <div key={event._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0"><p className="text-sm font-semibold text-ink">{eventLabel(event.type)} · {event.complaintTitle}</p><p className="mt-1 text-xs leading-5 text-muted">{event.description}</p></div><time className="shrink-0 text-xs text-muted" dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></div>)}</div>}
      </section>

      {history && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistory(null); }}><section role="dialog" aria-modal="true" aria-label={`SLA history for ${history.complaint.complaintTitle}`} className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">SLA event history</p><h2 className="mt-1 font-display text-xl font-bold text-ink">{history.complaint.complaintTitle}</h2></div><button type="button" onClick={() => setHistory(null)} aria-label="Close SLA history" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:bg-canvas hover:text-ink"><X size={17} /></button></div>{history.events.length ? <div className="mt-4 divide-y divide-line">{history.events.map((event) => <div key={event._id} className="py-3"><p className="text-sm font-semibold text-ink">{eventLabel(event.type)}</p><p className="mt-1 text-sm text-muted">{event.description}</p><p className="mt-1 text-xs text-muted">Due {formatDate(event.dueAt)} · Recorded {formatDate(event.createdAt)}</p></div>)}</div> : <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">No SLA events have been recorded for this complaint.</p>}</section></div>}
    </main>
  );
}
