import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChartNoAxesColumn,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  UserCheck,
  Users,
} from "lucide-react";
import DashboardShell from "../components/DashboardShell.jsx";
import ComplaintToolbar from "../components/ComplaintToolbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AssignedComplaintDetails from "../components/admin/complaints/AssignedComplaintDetails.jsx";
import {
  ASSIGNED_PAGE_SIZE,
  assignedFilterStatuses,
  assignedFilters,
  categoryDepartments,
  departments,
  formatDate,
  formatStatus,
  statusStyles,
} from "../utils/complaintConfig.js";
import { downloadComplaintPdf } from "../utils/complaintPdf.js";
import {
  assignComplaintRequest,
  getAssignedComplaintsRequest,
  getStaffByDepartmentRequest,
  getUnassignedComplaintsRequest,
  reassignComplaintRequest,
} from "../services/api.js";

// Main admin dashboard: state, data loading, queue actions, and page layout.
export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();

  const [activeQueue, setActiveQueue] = useState("unassigned");
  const [selectedAssignedComplaintId, setSelectedAssignedComplaintId] =
    useState(null);
  const [assignedFilter, setAssignedFilter] = useState("current");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedSort, setAssignedSort] = useState("newest");
  const [assignedPage, setAssignedPage] = useState(1);

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

  const [reassignDepartment, setReassignDepartment] = useState("");
  const [reassignStaffId, setReassignStaffId] = useState("");
  const [reassignStaffList, setReassignStaffList] = useState([]);
  const [loadingReassignStaff, setLoadingReassignStaff] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const selectedAssignedComplaint = assignedComplaints.find(
    (complaint) => complaint._id === selectedAssignedComplaintId,
  );

  const filteredAssignedComplaints = assignedComplaints
    .filter((complaint) =>
      assignedFilterStatuses[assignedFilter].includes(
        complaint.status || "Assigned",
      ),
    )
    .filter((complaint) => {
      const query = assignedSearch.trim().toLowerCase();
      if (!query) return true;

      const searchableText = [
        complaint.complaintTitle,
        complaint.complaintDescription,
        complaint.user?.username,
        complaint.user?.rollno,
        complaint.category,
        complaint.location?.building,
        complaint.location?.room,
        complaint.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    })
    .sort((first, second) => {
      const firstDate = new Date(
        assignedSort === "updated" ? first.updatedAt : first.createdAt,
      ).getTime();
      const secondDate = new Date(
        assignedSort === "updated" ? second.updatedAt : second.createdAt,
      ).getTime();

      if (assignedSort === "oldest") return firstDate - secondDate;
      return secondDate - firstDate;
    });

  const assignedPageCount = Math.max(
    1,
    Math.ceil(filteredAssignedComplaints.length / ASSIGNED_PAGE_SIZE),
  );
  const currentAssignedPage = Math.min(assignedPage, assignedPageCount);
  const firstVisibleComplaintIndex =
    (currentAssignedPage - 1) * ASSIGNED_PAGE_SIZE;
  const visibleAssignedComplaints = filteredAssignedComplaints.slice(
    firstVisibleComplaintIndex,
    firstVisibleComplaintIndex + ASSIGNED_PAGE_SIZE,
  );

  // Load unassigned complaints and staff options by department.
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

  // Load assigned complaints used by the filters, search, and sort controls.
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

  // Assignment and reassignment handlers.
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

  async function openAssignedComplaint(complaint) {
    setSelectedAssignedComplaintId(complaint._id);
    setReassignDepartment(complaint.assignedDepartment || "");
    setReassignStaffId(String(complaint.assignedStaff?.staffId || ""));
    setReassignStaffList([]);
    setError("");
    setSuccessMessage("");

    if (!complaint.assignedDepartment) return;

    setLoadingReassignStaff(true);

    try {
      const data = await getStaffByDepartmentRequest(
        complaint.assignedDepartment,
        accessToken,
      );
      setReassignStaffList(data.staff ?? []);
    } catch (requestError) {
      setError(
        requestError.message || "Could not load staff for this department.",
      );
    } finally {
      setLoadingReassignStaff(false);
    }
  }

  async function handleReassignDepartmentChange(department) {
    setReassignDepartment(department);
    setReassignStaffId("");
    setReassignStaffList([]);
    setError("");

    if (!department) return;

    setLoadingReassignStaff(true);

    try {
      const data = await getStaffByDepartmentRequest(department, accessToken);
      setReassignStaffList(data.staff ?? []);
    } catch (requestError) {
      setError(
        requestError.message || "Could not load staff for this department.",
      );
    } finally {
      setLoadingReassignStaff(false);
    }
  }

  async function handleReassign() {
    if (!selectedAssignedComplaint) return;

    if (!reassignDepartment || !reassignStaffId) {
      setError("Choose a department and staff member first.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setReassigning(true);

    try {
      const result = await reassignComplaintRequest(
        {
          complaintId: selectedAssignedComplaint._id,
          department: reassignDepartment,
          staffId: Number(reassignStaffId),
        },
        accessToken,
      );

      const data = await getAssignedComplaintsRequest(accessToken);
      setAssignedComplaints(data.complaints ?? []);
      setSuccessMessage(result.message || "Complaint reassigned successfully.");
    } catch (requestError) {
      setError(requestError.message || "Could not reassign the complaint.");
    } finally {
      setReassigning(false);
    }
  }

  // Queue selection and dashboard rendering.
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

            {activeQueue === "assigned" && !selectedAssignedComplaint && (
              <ComplaintToolbar
                filters={assignedFilters.map((filter) => ({
                  ...filter,
                  count: assignedComplaints.filter((complaint) =>
                    assignedFilterStatuses[filter.id].includes(
                      complaint.status || "Assigned",
                    ),
                  ).length,
                }))}
                activeFilter={assignedFilter}
                onFilterChange={(value) => {
                  setAssignedFilter(value);
                  setAssignedPage(1);
                }}
                searchValue={assignedSearch}
                onSearchChange={(value) => {
                  setAssignedSearch(value);
                  setAssignedPage(1);
                }}
                searchLabel="Search assigned complaints"
                searchPlaceholder="Search title, student, roll number, category, or location"
                sortValue={assignedSort}
                onSortChange={(value) => {
                  setAssignedSort(value);
                  setAssignedPage(1);
                }}
                sortOptions={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                  { value: "updated", label: "Recently updated" },
                ]}
              />
            )}
          </div>

          {/* Shared request feedback. */}
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

          {/* Main queue content: unassigned list, assigned details, or filtered assigned list. */}
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
              departments={departments}
              reassignDepartment={reassignDepartment}
              reassignStaffId={reassignStaffId}
              reassignStaffList={reassignStaffList}
              loadingReassignStaff={loadingReassignStaff}
              reassigning={reassigning}
              onClose={() => setSelectedAssignedComplaintId(null)}
              onDepartmentChange={handleReassignDepartmentChange}
              onStaffChange={setReassignStaffId}
              onReassign={handleReassign}
              onDownloadPdf={downloadComplaintPdf}
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
          ) : filteredAssignedComplaints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center">
              <h3 className="font-display font-bold">
                {assignedSearch.trim()
                  ? "No complaints match your search"
                  : `No ${assignedFilter} complaints`}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {assignedSearch.trim()
                  ? "Try a different title, student, roll number, category, or location."
                  : `There are no complaints in the ${assignedFilter} filter.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleAssignedComplaints.map((complaint) => {
                const status = complaint.status || "Assigned";
                const statusClass =
                  statusStyles[status] || "bg-slate-100 text-slate-700";

                return (
                  <button
                    key={complaint._id}
                    type="button"
                    onClick={() => openAssignedComplaint(complaint)}
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

          {activeQueue === "assigned" &&
            !selectedAssignedComplaint &&
            filteredAssignedComplaints.length > 0 &&
            assignedPageCount > 1 && (
              <nav
                aria-label="Assigned complaint pages"
                className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row"
              >
                <p className="text-sm text-muted">
                  Showing {firstVisibleComplaintIndex + 1}–
                  {Math.min(
                    firstVisibleComplaintIndex + ASSIGNED_PAGE_SIZE,
                    filteredAssignedComplaints.length,
                  )}{" "}
                  of {filteredAssignedComplaints.length} complaints
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAssignedPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentAssignedPage === 1}
                    className="min-h-10 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-20 text-center text-sm font-medium text-muted"
                  >
                    Page {currentAssignedPage} of {assignedPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAssignedPage((page) =>
                        Math.min(assignedPageCount, page + 1),
                      )
                    }
                    disabled={currentAssignedPage === assignedPageCount}
                    className="min-h-10 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
        </section>
      </main>
    </DashboardShell>
  );
}