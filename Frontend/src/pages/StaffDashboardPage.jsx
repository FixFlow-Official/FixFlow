import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  UserRound,
  Wrench,
} from "lucide-react";
import DashboardShell from "../components/DashboardShell.jsx";
import ComplaintToolbar from "../components/complaints/ComplaintToolbar.jsx";
import ExpandableComplaintCard from "../components/complaints/ExpandableComplaintCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
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

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

export default function StaffDashboardPage() {
  const { user, accessToken } = useAuth();

  const [complaints, setComplaints] = useState([]);
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

  const currentComplaints = complaints.filter(
    (complaint) => complaint.status !== "Resolved",
  );

  const resolvedComplaints = complaints.filter(
    (complaint) => complaint.status === "Resolved",
  );

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      // This request must return both current and resolved complaints.
      const data = await getStaffAssignedComplaintsRequest(accessToken);
      const assignedComplaints = data.complaints ?? [];

      setComplaints(assignedComplaints);
      setSelectedStatuses(
        Object.fromEntries(
          assignedComplaints.map((complaint) => [
            complaint._id,
            complaint.status,
          ]),
        ),
      );
    } catch (error) {
      setLoadError(error.message || "Could not load assigned complaints.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // Filter by view, status, and search query.
  const complaintsForView =
    complaintView === "resolved" ? resolvedComplaints : currentComplaints;
  const searchTerm = complaintSearch.trim().toLowerCase();

  const filteredComplaints = complaintsForView.filter((complaint) => {
    const matchesStatus =
      complaintView === "resolved" ||
      complaintFilter === "all" ||
      complaint.status === complaintFilter;

    const searchableText = [
      complaint.complaintTitle,
      complaint.complaintDescription,
      complaint.category,
      complaint.user?.username,
      complaint.user?.rollno,
      complaint.location?.building,
      complaint.location?.room,
      complaint.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesStatus && searchableText.includes(searchTerm);
  });

  function handleViewChange(view) {
    setComplaintView(view);
    setComplaintFilter("all");
    setComplaintSearch("");
    setExpandedComplaintId(null);
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
        [complaintId]: "Attach a photo as proof that the complaint is resolved.",
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
                    ? `${currentComplaints.length} active ${
                        currentComplaints.length === 1
                          ? "complaint"
                          : "complaints"
                      }`
                    : `${resolvedComplaints.length} resolved ${
                        resolvedComplaints.length === 1
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
                Current ({currentComplaints.length})
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
                Resolved ({resolvedComplaints.length})
              </button>
            </div>
          </div>

          {/* Search and status filters for the selected view */}
          {!loading && complaintsForView.length > 0 && (
            <div className="mt-5">
              <ComplaintToolbar
                filters={
                  complaintView === "current"
                    ? staffComplaintFilters.map((filter) => ({
                        ...filter,
                        count:
                          filter.id === "all"
                            ? currentComplaints.length
                            : currentComplaints.filter(
                                (complaint) => complaint.status === filter.id,
                              ).length,
                      }))
                    : [
                        {
                          id: "all",
                          label: "All",
                          count: resolvedComplaints.length,
                        },
                      ]
                }
                activeFilter={
                  complaintView === "current" ? complaintFilter : "all"
                }
                onFilterChange={setComplaintFilter}
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
            <section className="mt-5 rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
                <CheckCircle2 size={22} />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">
                {complaintView === "current"
                  ? "No complaints to resolve"
                  : "No resolved complaints yet"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
                {complaintView === "current"
                  ? "Complaints assigned to your account will appear here."
                  : "Complaints you resolve will be available here for reference."}
              </p>
            </section>
          ) : filteredComplaints.length === 0 ? (
            <section className="mt-5 rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
              <h3 className="font-display text-lg font-bold">
                No matching complaints
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                Try another search term or status filter.
              </p>
            </section>
          ) : (
            <div className="mt-5 space-y-5">
              {filteredComplaints.map((complaint) => {
                const complaintId = complaint._id;
                const isResolved = complaint.status === "Resolved";
                const selectedStatus =
                  selectedStatuses[complaintId] ?? complaint.status;
                const isSaving = savingId === complaintId;
                const isExpanded = expandedComplaintId === complaintId;

                const studentSummary = [
                  complaint.user?.username ?? "Student",
                  complaint.user?.rollno
                    ? `Roll no. ${complaint.user.rollno}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <ExpandableComplaintCard
                    key={complaintId}
                    complaint={complaint}
                    expanded={isExpanded}
                    onToggle={() => toggleComplaint(complaintId)}
                    onDownloadPdf={downloadComplaintPdf}
                    summary={studentSummary}
                  >
                    <div
                      className={`grid gap-5 ${
                        isResolved ? "" : "lg:grid-cols-[minmax(0,1fr)_300px]"
                      }`}
                    >
                      <div className="min-w-0">
                        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="inline text-muted">Student: </dt>
                            <dd className="inline font-semibold">
                              {complaint.user?.username ?? "Student"}
                              {complaint.user?.rollno
                                ? ` · ${complaint.user.rollno}`
                                : ""}
                            </dd>
                          </div>

                          <div>
                            <dt className="inline text-muted">Location: </dt>
                            <dd className="inline font-semibold">
                              {complaint.location?.building ??
                                "Building unavailable"}
                              {complaint.location?.room
                                ? `, Room ${complaint.location.room}`
                                : ""}
                            </dd>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <Clock3 size={14} />
                            Submitted {formatDate(complaint.createdAt)}
                          </div>

                          {isResolved && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                              <CheckCircle2 size={14} />
                              Resolved{" "}
                              {formatDate(
                                complaint.resolvedAt ?? complaint.updatedAt,
                              )}
                            </div>
                          )}
                        </dl>

                        {complaint.complaintPictureUrl && (
                          <a
                            href={complaint.complaintPictureUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex overflow-hidden rounded-xl border border-line"
                            aria-label="Open complaint proof photo"
                          >
                            <img
                              src={complaint.complaintPictureUrl}
                              alt={`Proof for ${complaint.complaintTitle}`}
                              className="h-36 w-48 object-cover"
                            />
                          </a>
                        )}

                        {/* Resolved complaint evidence and resolution details */}
                        {isResolved && (
                          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                            <h4 className="font-semibold text-emerald-900">
                              Resolution details
                            </h4>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                              {complaint.resolutionNote ||
                                "No resolution note was recorded."}
                            </p>

                            {complaint.resolutionProofUrl ? (
                              <a
                                href={complaint.resolutionProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex overflow-hidden rounded-xl border border-emerald-200"
                                aria-label="Open resolution proof photo"
                              >
                                <img
                                  src={complaint.resolutionProofUrl}
                                  alt={`Resolution proof for ${complaint.complaintTitle}`}
                                  className="h-40 w-56 object-cover"
                                />
                              </a>
                            ) : (
                              <p className="mt-3 text-sm text-emerald-800">
                                No resolution photo is available.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Current complaints can be updated; resolved ones are read-only. */}
                      {!isResolved && (
                        <div className="rounded-2xl bg-stone-50 p-4">
                          <label
                            htmlFor={`status-${complaintId}`}
                            className="text-sm font-semibold"
                          >
                            Update status
                          </label>

                          <select
                            id={`status-${complaintId}`}
                            value={selectedStatus}
                            onChange={(event) =>
                              setSelectedStatuses((current) => ({
                                ...current,
                                [complaintId]: event.target.value,
                              }))
                            }
                            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                          >
                            {staffStatuses.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>

                          <label
                            htmlFor={`note-${complaintId}`}
                            className="mt-4 block text-sm font-semibold"
                          >
                            {selectedStatus === "Resolved"
                              ? "Resolution note (required)"
                              : selectedStatus === "On_Hold"
                                ? "Note (required)"
                                : "Note (optional)"}
                          </label>

                          <textarea
                            id={`note-${complaintId}`}
                            rows={3}
                            maxLength={1000}
                            value={notes[complaintId] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [complaintId]: event.target.value,
                              }))
                            }
                            placeholder={
                              selectedStatus === "Resolved"
                                ? "Describe the work completed"
                                : selectedStatus === "On_Hold"
                                  ? "Explain why work is on hold"
                                  : "Add an update for the complaint history"
                            }
                            className="mt-2 w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                          />

                          {selectedStatus === "Resolved" && (
                            <div className="mt-4">
                              <label
                                htmlFor={`resolution-proof-${complaintId}`}
                                className="block text-sm font-semibold"
                              >
                                Resolution photo (required)
                              </label>

                              <label
                                htmlFor={`resolution-proof-${complaintId}`}
                                className="mt-2 flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-white p-3 transition hover:border-brand hover:bg-brand-soft/30"
                              >
                                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                                  <ImagePlus size={19} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold">
                                    {resolutionProofs[complaintId]?.name ??
                                      "Choose a resolution photo"}
                                  </span>
                                  <span className="mt-1 block text-xs text-muted">
                                    Add a photo showing the completed repair
                                  </span>
                                </span>
                              </label>

                              <input
                                id={`resolution-proof-${complaintId}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  setResolutionProofs((current) => ({
                                    ...current,
                                    [complaintId]: file,
                                  }));
                                }}
                              />
                            </div>
                          )}

                          {actionError[complaintId] && (
                            <p
                              role="alert"
                              className="mt-2 text-sm text-rose-700"
                            >
                              {actionError[complaintId]}
                            </p>
                          )}

                          {successMessage[complaintId] && (
                            <p
                              role="status"
                              className="mt-2 text-sm text-emerald-700"
                            >
                              {successMessage[complaintId]}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(complaint)}
                            disabled={isSaving}
                            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving && (
                              <LoaderCircle
                                size={16}
                                className="animate-spin"
                              />
                            )}
                            {selectedStatus === "Resolved"
                              ? "Resolve complaint"
                              : "Save update"}
                          </button>
                        </div>
                      )}
                    </div>
                  </ExpandableComplaintCard>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}