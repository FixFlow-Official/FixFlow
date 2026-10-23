import { useEffect, useState } from "react";
import ComplaintEmptyState from "../components/complaints/ComplaintEmptyState.jsx";
import UnassignedComplaintCard from "../features/admin/UnassignedComplaintCard.jsx";
import AdminAssignedComplaintCard from "../features/admin/AdminAssignedComplaintCard.jsx";
import {
  AlertCircle,
  ChartNoAxesColumn,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Users,
} from "lucide-react";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import ComplaintToolbar from "../components/complaints/ComplaintToolbar.jsx";
import { useAuth } from "../context/useAuth.js";
import {
  ASSIGNED_PAGE_SIZE,
  assignedFilterStatuses,
  assignedFilters,
  categoryDepartments,
} from "../utils/complaintConfig.js";
import { downloadComplaintPdf } from "../utils/complaintPdf.js";
import {
  assignComplaintRequest,
  getAssignedComplaintsRequest,
  getStaffByDepartmentRequest,
  getUnassignedComplaintsRequest,
  reassignComplaintRequest,
} from "../services/api.js";

// Main admin dashboard: complaint queues, assignment actions, and reassignment.
export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();

  const [activeQueue, setActiveQueue] = useState("unassigned");
  const [expandedUnassignedId, setExpandedUnassignedId] = useState(null);
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

  const queueCount =
    activeQueue === "unassigned"
      ? complaints.length
      : assignedComplaints.length;

  // Load the unassigned queue and staff options for suggested departments.
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
        if (active) setLoading(false);
      }
    }

    loadQueue();

    return () => {
      active = false;
    };
  }, [accessToken]);

  // Load assigned complaints for the filters, search, sort, and detail cards.
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
        if (active) setAssignedLoading(false);
      }
    }

    loadAssignedComplaints();

    return () => {
      active = false;
    };
  }, [accessToken]);

  // Load staff when an unassigned complaint's department is changed.
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

  // Assign an unassigned complaint to a department and staff member.
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
      setExpandedUnassignedId(null);

      const assignedData = await getAssignedComplaintsRequest(accessToken);
      setAssignedComplaints(assignedData.complaints ?? []);
      setSuccessMessage(result.message || "Complaint assigned successfully.");
    } catch (requestError) {
      setError(requestError.message || "Could not assign this complaint.");
    } finally {
      setAssigningId("");
    }
  }

  // Expand an assigned complaint and load its department's staff options.
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

  // Close an assigned complaint, or expand another one.
  function toggleAssignedComplaint(complaint) {
    if (selectedAssignedComplaintId === complaint._id) {
      setSelectedAssignedComplaintId(null);
      setError("");
      setSuccessMessage("");
      return;
    }

    openAssignedComplaint(complaint);
  }

  // Load staff when the reassignment department changes.
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

  // Reassign the currently expanded complaint.
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

  // Switch queues and close any expanded complaint card.
  function changeQueue(queue) {
    setActiveQueue(queue);
    setExpandedUnassignedId(null);
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
                    : "Assigned complaints"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {activeQueue === "unassigned"
                    ? "Choose a department and staff member for each complaint."
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

            {activeQueue === "assigned" && (
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

          {/* Shared request feedback */}
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

          {/* Unassigned complaint queue */}
          {activeQueue === "unassigned" ? (
            loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted">
                <LoaderCircle size={21} className="animate-spin text-brand" />
                Loading complaints…
              </div>
            ) : complaints.length === 0 ? (
              <ComplaintEmptyState
                title="No unassigned complaints"
                description="New student complaints will appear here."
                className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center"
                titleClassName="font-display font-bold"
                descriptionClassName="mt-1 text-sm text-muted"
              />
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => {
                  const department = selectedDepartments[complaint._id] || "";
                  const staff = staffByDepartment[department] ?? [];
                  const isExpanded = expandedUnassignedId === complaint._id;

                  return (
                    <UnassignedComplaintCard
                      key={complaint._id}
                      complaint={complaint}
                      department={department}
                      staff={staff}
                      selectedStaffId={selectedStaffIds[complaint._id] || ""}
                      assigning={assigningId === complaint._id}
                      expanded={isExpanded}
                      onToggle={() => setExpandedUnassignedId((currentId) => currentId === complaint._id ? null : complaint._id)}
                      onDepartmentChange={(value) => handleDepartmentChange(complaint._id, value)}
                      onStaffChange={(value) => setSelectedStaffIds((current) => ({ ...current, [complaint._id]: value }))}
                      onAssign={() => handleAssign(complaint._id)}
                      onDownloadPdf={downloadComplaintPdf}
                    />
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
          ) : assignedComplaints.length === 0 ? (
            <ComplaintEmptyState
              title="No assigned complaints"
              description="Complaints will appear here after you assign them to staff."
              className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center"
              titleClassName="font-display font-bold"
              descriptionClassName="mt-1 text-sm text-muted"
            />
          ) : filteredAssignedComplaints.length === 0 ? (
            <ComplaintEmptyState
              title={
                assignedSearch.trim()
                  ? "No complaints match your search"
                  : `No ${assignedFilter} complaints`
              }
              description={
                assignedSearch.trim()
                  ? "Try a different title, student, roll number, category, or location."
                  : `There are no complaints in the ${assignedFilter} filter.`
              }
              className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center"
              titleClassName="font-display font-bold"
              descriptionClassName="mt-1 text-sm text-muted"
            />
          ) : (
            <div className="space-y-4">
              {visibleAssignedComplaints.map((complaint) => (
                <AdminAssignedComplaintCard
                  key={complaint._id}
                  complaint={complaint}
                  expanded={selectedAssignedComplaintId === complaint._id}
                  onToggle={() => toggleAssignedComplaint(complaint)}
                  onDownloadPdf={downloadComplaintPdf}
                  reassignDepartment={reassignDepartment}
                  reassignStaffId={reassignStaffId}
                  reassignStaffList={reassignStaffList}
                  loadingReassignStaff={loadingReassignStaff}
                  reassigning={reassigning}
                  onDepartmentChange={handleReassignDepartmentChange}
                  onStaffChange={setReassignStaffId}
                  onReassign={handleReassign}
                />
              ))}
            </div>
          )}

          {/* Assigned complaint pagination */}
          {activeQueue === "assigned" &&
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