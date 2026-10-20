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
import ComplaintToolbar from "../components/ComplaintToolbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getAssignedComplaintsRequest,
  updateComplaintStatusRequest,
} from "../services/api.js";

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

const statusStyles = {
  Submitted: "bg-sky-50 text-sky-700",
  Under_Review: "bg-amber-50 text-amber-800",
  Assigned: "bg-indigo-50 text-indigo-700",
  In_Progress: "bg-blue-50 text-blue-700",
  On_Hold: "bg-orange-50 text-orange-800",
  Resolved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-rose-50 text-rose-700",
  Closed: "bg-slate-100 text-slate-700",
  Withdrawn: "bg-slate-100 text-slate-700",
};

function formatStatus(status = "") {
  return status.replaceAll("_", " ");
}

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function StaffDashboardPage() {
  const { user, accessToken } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [complaintFilter, setComplaintFilter] = useState("all");
  const [complaintSearch, setComplaintSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [resolutionProofs, setResolutionProofs] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState({});
  const [successMessage, setSuccessMessage] = useState({});
  const [savingId, setSavingId] = useState("");

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const data = await getAssignedComplaintsRequest(accessToken);
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

  // Apply the selected status and search query to the active complaint list.
  const searchTerm = complaintSearch.trim().toLowerCase();

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesStatus =
      complaintFilter === "all" || complaint.status === complaintFilter;

    const searchableText = [
      complaint.complaintTitle,
      complaint.complaintDescription,
      complaint.category,
      complaint.user?.username,
      complaint.user?.rollno,
      complaint.location?.building,
      complaint.location?.room,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesStatus && searchableText.includes(searchTerm);
  });

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

      if (status === "Resolved") {
        setComplaints((current) =>
          current.filter((item) => item._id !== complaintId),
        );
        setSelectedStatuses((current) => {
          const next = { ...current };
          delete next[complaintId];
          return next;
        });
      } else {
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
      }

      setNotes((current) => ({ ...current, [complaintId]: "" }));
      setResolutionProofs((current) => ({
        ...current,
        [complaintId]: null,
      }));
      setSuccessMessage((current) => ({
        ...current,
        [complaintId]:
          data.message ||
          (status === "Resolved"
            ? "Complaint resolved and removed from your active list."
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
      <main className="w-full">
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
                Review and resolve the campus complaints assigned to you. Keep
                students informed as work progresses.
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

        {/* Assigned complaint count */}
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Wrench size={19} />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">
              Complaints to resolve
            </h2>
            <p className="text-sm text-muted">
              {complaints.length}{" "}
              {complaints.length === 1 ? "complaint" : "complaints"}
            </p>
          </div>
        </div>

        {/* Shared search and status filter component */}
        {!loading && complaints.length > 0 && (
          <ComplaintToolbar
            filters={staffComplaintFilters.map((filter) => ({
              ...filter,
              count:
                filter.id === "all"
                  ? complaints.length
                  : complaints.filter(
                      (complaint) => complaint.status === filter.id,
                    ).length,
            }))}
            activeFilter={complaintFilter}
            onFilterChange={setComplaintFilter}
            searchValue={complaintSearch}
            onSearchChange={setComplaintSearch}
            searchLabel="Search assigned complaints"
            searchPlaceholder="Search title, student, roll number, category, or location"
          />
        )}

        {/* Load error feedback */}
        {loadError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Loading, empty, filtered-empty, and complaint list states */}
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-line bg-white text-sm text-muted">
            <LoaderCircle size={20} className="animate-spin text-brand" />
            Loading complaints…
          </div>
        ) : complaints.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
              <CheckCircle2 size={22} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold">
              No complaints to resolve
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Complaints assigned to your account will appear here.
            </p>
          </section>
        ) : filteredComplaints.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
            <h3 className="font-display text-lg font-bold">
              No matching complaints
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Try another search term or status filter.
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            {filteredComplaints.map((complaint) => {
              const complaintId = complaint._id;
              const selectedStatus =
                selectedStatuses[complaintId] ?? complaint.status;
              const isSaving = savingId === complaintId;

              return (
                <article
                  key={complaintId}
                  className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
                >
                  <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[complaint.status] ??
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {formatStatus(complaint.status)}
                        </span>
                        <span className="text-xs text-muted">
                          {complaint.category}
                        </span>
                      </div>

                      <h3 className="mt-3 font-display text-xl font-bold">
                        {complaint.complaintTitle}
                      </h3>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                        {complaint.complaintDescription}
                      </p>

                      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
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
                    </div>

                    {/* Status, update note, and resolution proof form */}
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
                        <p role="alert" className="mt-2 text-sm text-rose-700">
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
                          <LoaderCircle size={16} className="animate-spin" />
                        )}
                        {selectedStatus === "Resolved"
                          ? "Resolve complaint"
                          : "Save update"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}