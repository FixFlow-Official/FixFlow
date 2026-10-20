import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChartNoAxesColumn,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import DashboardShell from "../components/DashboardShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  assignComplaintRequest,
  getAssignedComplaintsRequest,
  getStaffByDepartmentRequest,
  getUnassignedComplaintsRequest,
} from "../services/api.js";

const departments = [
  "Electrical Maintenance",
  "Plumbing",
  "IT Support",
  "Civil Maintenance",
  "Housekeeping",
];

const categoryDepartments = {
  Electrical: "Electrical Maintenance",
  Plumbing: "Plumbing",
  Internet: "IT Support",
  Cleaning: "Housekeeping",
  Furniture: "Civil Maintenance",
};

const statusStyles = {
  Submitted: "bg-sky-50 text-sky-700",
  Under_Review: "bg-amber-50 text-amber-800",
  Assigned: "bg-indigo-50 text-indigo-700",
  In_Progress: "bg-violet-50 text-violet-700",
  On_Hold: "bg-orange-50 text-orange-800",
  Resolved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-rose-50 text-rose-700",
  Closed: "bg-slate-100 text-slate-700",
  Withdrawn: "bg-slate-100 text-slate-700",
};

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatStatus(status) {
  return (status || "Submitted").replaceAll("_", " ");
}

function AssignedComplaintDetails({ complaint, onClose }) {
  const status = complaint.status || "Assigned";
  const statusClass =
    statusStyles[status] || "bg-slate-100 text-slate-700";
  const history = [...(complaint.statusHistory ?? [])].sort(
    (a, b) => new Date(a.changedAt) - new Date(b.changedAt),
  );

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">Assigned complaint details</p>
          <h3 className="mt-1 break-words font-display text-xl font-bold">
            {complaint.complaintTitle}
          </h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close complaint details"
          title="Close"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-brand/10"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
        >
          {formatStatus(status)}
        </span>

        {complaint.assignedDepartment && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {complaint.assignedDepartment}
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <div>
            <h4 className="text-sm font-bold">Description</h4>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
              {complaint.complaintDescription}
            </p>
          </div>

          <dl className="grid gap-4 rounded-xl bg-canvas/60 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Category</dt>
              <dd className="mt-1 font-semibold">
                {complaint.category || "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Building</dt>
              <dd className="mt-1 font-semibold">
                {complaint.location?.building || "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Room</dt>
              <dd className="mt-1 font-semibold">
                {complaint.location?.room || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Submitted</dt>
              <dd className="mt-1 font-semibold">
                {formatDate(complaint.createdAt)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Student</dt>
              <dd className="mt-1 break-words font-semibold">
                {complaint.user?.username || "Student"}
                {complaint.user?.rollno
                  ? ` · ${complaint.user.rollno}`
                  : ""}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Assigned staff</dt>
              <dd className="mt-1 break-words font-semibold">
                {complaint.assignedStaff?.username || "Staff member"}
                {complaint.assignedStaff?.department
                  ? ` · ${complaint.assignedStaff.department}`
                  : ""}
              </dd>
            </div>
          </dl>

          {complaint.complaintPictureUrl && (
            <div>
              <h4 className="text-sm font-bold">Submitted proof</h4>
              <a
                href={complaint.complaintPictureUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block max-w-full overflow-hidden rounded-xl border border-line"
              >
                <img
                  src={complaint.complaintPictureUrl}
                  alt={`Submitted proof for ${complaint.complaintTitle}`}
                  className="max-h-72 max-w-full object-contain"
                />
              </a>
            </div>
          )}

          {status === "Resolved" && (
            <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-700" />
                <h4 className="font-bold text-emerald-900">
                  Resolution details
                </h4>
              </div>

              {complaint.resolutionNote && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-emerald-950">
                  {complaint.resolutionNote}
                </p>
              )}

              {complaint.resolvedBy && (
                <p className="mt-3 text-sm text-emerald-900">
                  Resolved by{" "}
                  <strong>
                    {complaint.resolvedBy.username || "Staff member"}
                  </strong>
                  {complaint.resolvedBy.department
                    ? ` · ${complaint.resolvedBy.department}`
                    : ""}
                </p>
              )}

              {complaint.resolvedAt && (
                <p className="mt-1 text-sm text-emerald-900">
                  {formatDate(complaint.resolvedAt)}
                </p>
              )}

              {complaint.resolutionProofUrl && (
                <a
                  href={complaint.resolutionProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block max-w-full overflow-hidden rounded-xl border border-emerald-200"
                >
                  <img
                    src={complaint.resolutionProofUrl}
                    alt={`Resolution proof for ${complaint.complaintTitle}`}
                    className="max-h-72 max-w-full object-contain"
                  />
                </a>
              )}
            </section>
          )}
        </div>

        <aside className="min-w-0 rounded-xl border border-line bg-canvas/50 p-4">
          <h4 className="font-display font-bold">Status history</h4>

          {history.length > 0 ? (
            <ol className="mt-4 space-y-4">
              {history.map((entry, index) => (
                <li
                  key={`${entry.status}-${entry.changedAt}-${index}`}
                  className="flex items-start gap-3"
                >
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">
                      {formatStatus(entry.status)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(entry.changedAt)}
                    </p>
                    {entry.note && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No status updates are available.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();

  const [activeQueue, setActiveQueue] = useState("unassigned");
  const [selectedAssignedComplaintId, setSelectedAssignedComplaintId] =
    useState(null);

  const [complaints, setComplaints] = useState([]);
  const [staffByDepartment, setStaffByDepartment] = useState({});
  const [selectedDepartments, setSelectedDepartments] = useState({});
  const [selectedStaffIds, setSelectedStaffIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [assignedComplaints, setAssignedComplaints] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [assignedError, setAssignedError] = useState("");

  const selectedAssignedComplaint = assignedComplaints.find(
    (complaint) => complaint._id === selectedAssignedComplaintId,
  );

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError("");

      try {
        const data = await getUnassignedComplaintsRequest(accessToken);
        const queue = data.complaints ?? [];

        if (!active) return;

        setComplaints(queue);

        const departmentSelections = {};
        queue.forEach((complaint) => {
          departmentSelections[complaint._id] =
            categoryDepartments[complaint.category] || "";
        });
        setSelectedDepartments(departmentSelections);

        const uniqueDepartments = [
          ...new Set(Object.values(departmentSelections).filter(Boolean)),
        ];

        const staffResults = await Promise.all(
          uniqueDepartments.map(async (department) => {
            const staffData = await getStaffByDepartmentRequest(
              department,
              accessToken,
            );
            return [department, staffData.staff ?? []];
          }),
        );

        if (active) {
          setStaffByDepartment(Object.fromEntries(staffResults));
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.message || "Could not load the complaint queue.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadQueue();

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let active = true;

    async function loadAssignedComplaints() {
      setAssignedLoading(true);
      setAssignedError("");

      try {
        const data = await getAssignedComplaintsRequest(accessToken);

        if (active) {
          setAssignedComplaints(data.complaints ?? []);
        }
      } catch (requestError) {
        if (active) {
          setAssignedError(
            requestError.message || "Could not load assigned complaints.",
          );
        }
      } finally {
        if (active) {
          setAssignedLoading(false);
        }
      }
    }

    loadAssignedComplaints();

    return () => {
      active = false;
    };
  }, [accessToken]);

  async function handleDepartmentChange(complaintId, department) {
    setSelectedDepartments((current) => ({
      ...current,
      [complaintId]: department,
    }));

    setSelectedStaffIds((current) => ({
      ...current,
      [complaintId]: "",
    }));

    if (!department || staffByDepartment[department]) return;

    try {
      const data = await getStaffByDepartmentRequest(department, accessToken);
      setStaffByDepartment((current) => ({
        ...current,
        [department]: data.staff ?? [],
      }));
    } catch (requestError) {
      setError(
        requestError.message || "Could not load staff for that department.",
      );
    }
  }

  async function handleAssign(complaintId) {
    const department = selectedDepartments[complaintId];
    const staffId = selectedStaffIds[complaintId];

    setError("");
    setSuccessMessage("");

    if (!department || !staffId) {
      setError("Choose a department and staff member first.");
      return;
    }

    setAssigningId(complaintId);

    try {
      const result = await assignComplaintRequest(
        {
          complaintId,
          staffId: Number(staffId),
          department,
        },
        accessToken,
      );

      setComplaints((current) =>
        current.filter((complaint) => complaint._id !== complaintId),
      );

      const assignedData = await getAssignedComplaintsRequest(accessToken);
      setAssignedComplaints(assignedData.complaints ?? []);
      setSuccessMessage(result.message || "Complaint assigned successfully.");
    } catch (requestError) {
      setError(requestError.message || "Could not assign this complaint.");
    } finally {
      setAssigningId("");
    }
  }

  const queueCount =
    activeQueue === "unassigned"
      ? complaints.length
      : assignedComplaints.length;

  function changeQueue(queue) {
    setActiveQueue(queue);
    setSelectedAssignedComplaintId(null);
    setError("");
    setSuccessMessage("");
  }

  return (
    <DashboardShell
      workspaceLabel="Administrator"
      activeSection="complaints"
      navItems={[
        { id: "complaints", label: "Complaints", icon: ClipboardList },
        { id: "staff", label: "Staff", icon: Users, disabled: true },
        {
          id: "reports",
          label: "Reports",
          icon: ChartNoAxesColumn,
          disabled: true,
        },
      ]}
    >
      <main className="w-full min-w-0">
        <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
          Administrator workspace
        </span>

        <h1 className="mt-3 break-words font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Welcome, {user?.username || "Administrator"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Review complaints and follow their assignment progress.
        </p>

        <section className="mt-6 min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm sm:mt-8 sm:p-7">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold">
                  {activeQueue === "unassigned"
                    ? "Unassigned complaints"
                    : selectedAssignedComplaint
                      ? "Complaint details"
                      : "Assigned complaints"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {activeQueue === "unassigned"
                    ? "Choose a department and staff member for each complaint."
                    : selectedAssignedComplaint
                      ? "Review the complaint, its assignment, and status history."
                      : "Track assigned complaints and see who is handling them."}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-canvas px-3 py-1 text-sm font-bold text-muted">
                {queueCount}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => changeQueue("unassigned")}
                aria-pressed={activeQueue === "unassigned"}
                className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${
                  activeQueue === "unassigned"
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
                }`}
              >
                Unassigned
              </button>

              <button
                type="button"
                onClick={() => changeQueue("assigned")}
                aria-pressed={activeQueue === "assigned"}
                className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${
                  activeQueue === "assigned"
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
                }`}
              >
                Assigned
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {successMessage && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
            >
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </p>
          )}

          {activeQueue === "unassigned" ? (
            loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted">
                <LoaderCircle size={21} className="animate-spin text-brand" />
                Loading complaints…
              </div>
            ) : complaints.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center">
                <h3 className="font-display font-bold">
                  No unassigned complaints
                </h3>
                <p className="mt-1 text-sm text-muted">
                  New student complaints will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => {
                  const department = selectedDepartments[complaint._id] || "";
                  const staff = staffByDepartment[department] ?? [];

                  return (
                    <article
                      key={complaint._id}
                      className="min-w-0 rounded-2xl border border-line p-4 sm:p-5"
                    >
                      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-display text-lg font-bold">
                              {complaint.complaintTitle}
                            </h3>
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                              {formatStatus(complaint.status)}
                            </span>
                          </div>

                          <p className="mt-2 break-words text-sm leading-6 text-muted">
                            {complaint.complaintDescription}
                          </p>

                          <p className="mt-2 break-words text-xs font-medium text-muted">
                            {complaint.category}
                            {" · "}
                            {complaint.location?.building}
                            {complaint.location?.room
                              ? ` · Room ${complaint.location.room}`
                              : ""}
                          </p>

                          <p className="mt-2 break-words text-xs text-muted">
                            Submitted by {complaint.user?.username || "Student"}
                            {complaint.user?.rollno
                              ? ` · Roll no. ${complaint.user.rollno}`
                              : ""}
                            {" · "}
                            {formatDate(complaint.createdAt)}
                          </p>

                          {complaint.complaintPictureUrl && (
                            <a
                              href={complaint.complaintPictureUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-block"
                            >
                              <img
                                src={complaint.complaintPictureUrl}
                                alt={`Proof for ${complaint.complaintTitle}`}
                                className="size-24 rounded-xl object-cover"
                              />
                            </a>
                          )}
                        </div>

                        <div className="grid min-w-0 gap-3 lg:w-72 lg:shrink-0">
                          <label className="block min-w-0 space-y-1.5">
                            <span className="text-sm font-semibold">
                              Department
                            </span>
                            <select
                              value={department}
                              onChange={(event) =>
                                handleDepartmentChange(
                                  complaint._id,
                                  event.target.value,
                                )
                              }
                              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                            >
                              <option value="">Choose department</option>
                              {departments.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block min-w-0 space-y-1.5">
                            <span className="text-sm font-semibold">
                              Staff member
                            </span>
                            <select
                              value={selectedStaffIds[complaint._id] || ""}
                              onChange={(event) =>
                                setSelectedStaffIds((current) => ({
                                  ...current,
                                  [complaint._id]: event.target.value,
                                }))
                              }
                              disabled={!department || staff.length === 0}
                              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                            >
                              <option value="">
                                {!department
                                  ? "Choose a department first"
                                  : staff.length === 0
                                    ? "No staff in this department"
                                    : "Choose staff member"}
                              </option>
                              {staff.map((person) => (
                                <option
                                  key={person._id || person.staffId}
                                  value={person.staffId}
                                >
                                  {person.username} · ID {person.staffId}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleAssign(complaint._id)}
                            disabled={assigningId === complaint._id}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {assigningId === complaint._id ? (
                              <LoaderCircle
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <UserCheck size={16} />
                            )}
                            Assign complaint
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : assignedLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted">
              <LoaderCircle size={21} className="animate-spin text-brand" />
              Loading assigned complaints…
            </div>
          ) : assignedError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              {assignedError}
            </p>
          ) : selectedAssignedComplaint ? (
            <AssignedComplaintDetails
              complaint={selectedAssignedComplaint}
              onClose={() => setSelectedAssignedComplaintId(null)}
            />
          ) : assignedComplaints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center">
              <h3 className="font-display font-bold">
                No assigned complaints
              </h3>
              <p className="mt-1 text-sm text-muted">
                Complaints will appear here after you assign them to staff.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedComplaints.map((complaint) => {
                const status = complaint.status || "Assigned";
                const statusClass =
                  statusStyles[status] || "bg-slate-100 text-slate-700";

                return (
                  <button
                    key={complaint._id}
                    type="button"
                    onClick={() =>
                      setSelectedAssignedComplaintId(complaint._id)
                    }
                    className="w-full rounded-2xl border border-line bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-brand/10 sm:p-5"
                  >
                    <span className="flex min-w-0 flex-col gap-4 sm:flex-row">
                      {complaint.complaintPictureUrl && (
                        <img
                          src={complaint.complaintPictureUrl}
                          alt=""
                          className="size-20 shrink-0 rounded-xl object-cover sm:size-24"
                        />
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words font-display text-lg font-bold text-ink">
                            {complaint.complaintTitle}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}
                          >
                            {formatStatus(status)}
                          </span>
                        </span>

                        <span className="mt-2 block line-clamp-2 break-words text-sm leading-6 text-muted">
                          {complaint.complaintDescription}
                        </span>

                        <span className="mt-2 block break-words text-xs text-muted">
                          {complaint.category}
                          {" · "}
                          {complaint.location?.building}
                          {complaint.location?.room
                            ? ` · Room ${complaint.location.room}`
                            : ""}
                        </span>

                        <span className="mt-2 block break-words text-xs text-muted">
                          Assigned to{" "}
                          {complaint.assignedStaff?.username || "Staff member"}
                          {complaint.assignedDepartment
                            ? ` · ${complaint.assignedDepartment}`
                            : ""}
                        </span>

                        <span className="mt-2 block text-xs text-muted">
                          Updated {formatDate(complaint.updatedAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}