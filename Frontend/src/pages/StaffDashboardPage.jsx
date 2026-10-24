import { useCallback, useEffect, useRef, useState } from "react";
import StaffComplaintCard from "../features/staff/StaffComplaintCard.jsx";
import ComplaintEmptyState from "../components/complaints/ComplaintEmptyState.jsx";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  UserRound,
  Wrench,
} from "lucide-react";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import ComplaintToolbar from "../components/complaints/ComplaintToolbar.jsx";
import ComplaintPagination from "../components/complaints/ComplaintPagination.jsx";
import { useAuth } from "../context/useAuth.js";
import {
  getStaffAssignedComplaintsRequest,
  updateComplaintStatusRequest,
} from "../services/api.js";
import { downloadComplaintPdf } from "../utils/complaintPdf.js";

const staffStatuses = [
  { value: "Under_Review", label: "Under review" },
  { value: "In_Progress", label: "In progress" },
  { value: "On_Hold", label: "On hold" },
  { value: "Resolved", label: "Resolved" },
];

const staffComplaintFilters = [
  { id: "all", label: "All" },
  { id: "Assigned", label: "Assigned" },
  { id: "Under_Review", label: "Under review" },
  { id: "In_Progress", label: "In progress" },
  { id: "On_Hold", label: "On hold" },
];

const staffNavItems = [
  {
    id: "complaints",
    label: "Complaints",
    icon: Wrench,
  },
  {
    id: "profile",
    label: "Profile",
    icon: UserRound,
    disabled: true,
  },
];

export default function StaffDashboardPage() {
  const { user, accessToken } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState({ current: 0, resolved: 0, statuses: {} });
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [complaintView, setComplaintView] = useState("current");
  const [complaintFilter, setComplaintFilter] = useState("all");
  const [complaintSearch, setComplaintSearch] = useState("");
  const [expandedComplaintId, setExpandedComplaintId] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [resolutionProofs, setResolutionProofs] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState({});
  const [successMessage, setSuccessMessage] = useState({});
  const [savingId, setSavingId] = useState("");
  const latestRequestId = useRef(0);

  const loadComplaints = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setLoadError("");

    try {
      const data = await getStaffAssignedComplaintsRequest(accessToken, {
        view: complaintView,
        ...(complaintView === "current" && complaintFilter !== "all"
          ? { status: complaintFilter }
          : {}),
        search: debouncedSearch,
        page,
        limit: 8,
      });
      if (requestId !== latestRequestId.current) return;
      const assignedComplaints = data.complaints ?? [];

      setComplaints(assignedComplaints);
      setPagination(data.pagination ?? null);
      setCounts(data.counts ?? { current: 0, resolved: 0, statuses: {} });
      if (data.pagination && page > Math.max(1, data.pagination.totalPages)) {
        setPage(Math.max(1, data.pagination.totalPages));
      }
      setSelectedStatuses(
        Object.fromEntries(
          assignedComplaints.map((complaint) => [
            complaint._id,
            complaint.status,
          ]),
        ),
      );
    } catch (error) {
      if (requestId === latestRequestId.current) {
        setLoadError(error.message || "Could not load assigned complaints.");
      }
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [accessToken, complaintView, complaintFilter, debouncedSearch, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(complaintSearch.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [complaintSearch]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // Filter by view, status, and search query.
  const complaintsForView = complaints;
  const filteredComplaints = complaints;

  function handleViewChange(view) {
    setComplaintView(view);
    setComplaintFilter("all");
    setComplaintSearch("");
    setExpandedComplaintId(null);
    setPage(1);
  }

  function toggleComplaint(complaintId) {
    setExpandedComplaintId((currentId) =>
      currentId === complaintId ? null : complaintId,
    );
  }

  // Validate and save a staff member's status update.
  async function handleStatusUpdate(complaint) {
    const complaintId = complaint._id;
    const status = selectedStatuses[complaintId] ?? complaint.status;
    const note = notes[complaintId] ?? "";
    const resolutionProof = resolutionProofs[complaintId] ?? null;

    setActionError((current) => ({ ...current, [complaintId]: "" }));
    setSuccessMessage((current) => ({ ...current, [complaintId]: "" }));

    if (status === "On_Hold" && !note.trim()) {
      setActionError((current) => ({
        ...current,
        [complaintId]: "Add a note explaining why this complaint is on hold.",
      }));
      return;
    }

    if (status === "Resolved" && !note.trim()) {
      setActionError((current) => ({
        ...current,
        [complaintId]: "Add a resolution note before resolving this complaint.",
      }));
      return;
    }

    if (status === "Resolved" && !resolutionProof) {
      setActionError((current) => ({
        ...current,
        [complaintId]:
          "Attach a photo as proof that the complaint is resolved.",
      }));
      return;
    }

    setSavingId(complaintId);

    try {
      const data = await updateComplaintStatusRequest(
        { complaintId, status, note, resolutionProof },
        accessToken,
      );

      // Keep the updated complaint in state so it appears in the Resolved view.
      setComplaints((current) =>
        current.map((item) =>
          item._id === complaintId
            ? { ...item, ...data.complaint, user: item.user }
            : item,
        ),
      );

      setSelectedStatuses((current) => ({
        ...current,
        [complaintId]: data.complaint.status,
      }));

      setNotes((current) => ({ ...current, [complaintId]: "" }));
      setResolutionProofs((current) => ({
        ...current,
        [complaintId]: null,
      }));

      if (status === "Resolved") {
        setComplaintView("resolved");
        setComplaintFilter("all");
        setComplaintSearch("");
        setExpandedComplaintId(complaintId);
      }

      setSuccessMessage((current) => ({
        ...current,
        [complaintId]:
          data.message ||
          (status === "Resolved"
            ? "Complaint resolved and moved to your resolved list."
            : "Complaint status updated."),
      }));
    } catch (error) {
      setActionError((current) => ({
        ...current,
        [complaintId]: error.message || "Could not update the complaint.",
      }));
    } finally {
      setSavingId("");
    }
  }

  return (
    <DashboardShell
      workspaceLabel="Staff"
      activeSection="complaints"
      navItems={staffNavItems}
    >
      <main className="w-full min-w-0">
        {/* Staff dashboard welcome panel */}
        <section className="mb-7 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark">
            Staff workspace
          </span>

          <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Welcome, {user?.username ?? "Staff member"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
                Review assigned complaints, keep students informed, and check
                your completed work.
              </p>
            </div>

            <button
              type="button"
              onClick={loadComplaints}
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
            >
              {loading ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh
            </button>
          </div>
        </section>

        {/* Current and resolved complaint views */}
        <section className="rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Wrench size={19} />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">
                  {complaintView === "current"
                    ? "Current complaints"
                    : "Resolved complaints"}
                </h2>
                <p className="text-sm text-muted">
                  {complaintView === "current"
                    ? `${counts.current} active ${
                        counts.current === 1
                          ? "complaint"
                          : "complaints"
                      }`
                    : `${counts.resolved} resolved ${
                        counts.resolved === 1
                          ? "complaint"
                          : "complaints"
                      }`}
                </p>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Complaint views"
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={complaintView === "current"}
                onClick={() => handleViewChange("current")}
                className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${
                  complaintView === "current"
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
                }`}
              >
                Current ({counts.current})
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={complaintView === "resolved"}
                onClick={() => handleViewChange("resolved")}
                className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${
                  complaintView === "resolved"
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
                }`}
              >
                Resolved ({counts.resolved})
              </button>
            </div>
          </div>

          {/* Search and status filters for the selected view */}
          {!loading && (counts.current > 0 || counts.resolved > 0) && (
            <div className="mt-5">
              <ComplaintToolbar
                filters={
                  complaintView === "current"
                    ? staffComplaintFilters.map((filter) => ({
                        ...filter,
                        count:
                          filter.id === "all"
                          ? counts.current
                          : counts.statuses?.[filter.id] ?? 0,
                      }))
                    : [
                        {
                          id: "all",
                          label: "All",
                          count: counts.resolved,
                        },
                      ]
                }
                activeFilter={
                  complaintView === "current" ? complaintFilter : "all"
                }
                onFilterChange={(value) => {
                  setComplaintFilter(value);
                  setPage(1);
                  setExpandedComplaintId(null);
                }}
                searchValue={complaintSearch}
                onSearchChange={setComplaintSearch}
                searchLabel={`Search ${complaintView} complaints`}
                searchPlaceholder="Search title, student, roll number, category, or location"
              />
            </div>
          )}

          {/* Load error feedback */}
          {loadError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Loading, empty, filtered-empty, and complaint list states */}
          {loading ? (
            <div className="mt-5 flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-line bg-white text-sm text-muted">
              <LoaderCircle size={20} className="animate-spin text-brand" />
              Loading complaints…
            </div>
          ) : complaintsForView.length === 0 ? (
            <ComplaintEmptyState
              className="mt-5 rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center"
              iconClassName="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"
              titleClassName="mt-4 font-display text-lg font-bold"
              descriptionClassName="mx-auto mt-1 max-w-md text-sm leading-6 text-muted"
              icon={CheckCircle2}
              title={
                complaintView === "current"
                  ? "No complaints to resolve"
                  : "No resolved complaints yet"
              }
              description={
                complaintView === "current"
                  ? "Complaints assigned to your account will appear here."
                  : "Complaints you resolve will be available here for reference."
              }
            />
          ) : filteredComplaints.length === 0 ? (
            <ComplaintEmptyState
              className="mt-5 rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center"
              titleClassName="font-display text-lg font-bold"
              descriptionClassName="mt-1 text-sm leading-6 text-muted"
              title="No matching complaints"
              description="Try another search term or status filter."
            />
          ) : (
            <div className="mt-5 space-y-5">
              {filteredComplaints.map((complaint) => (
                <StaffComplaintCard
                  key={complaint._id}
                  complaint={complaint}
                  selectedStatuses={selectedStatuses}
                  staffStatuses={staffStatuses}
                  setSelectedStatuses={setSelectedStatuses}
                  notes={notes}
                  setNotes={setNotes}
                  resolutionProofs={resolutionProofs}
                  setResolutionProofs={setResolutionProofs}
                  actionError={actionError}
                  successMessage={successMessage}
                  savingId={savingId}
                  expanded={expandedComplaintId === complaint._id}
                  onToggle={() => toggleComplaint(complaint._id)}
                  onDownloadPdf={downloadComplaintPdf}
                  onSave={() => handleStatusUpdate(complaint)}
                />
              ))}
            </div>
          )}
          {!loading && !loadError && (
            <ComplaintPagination pagination={pagination} onPageChange={setPage} />
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
