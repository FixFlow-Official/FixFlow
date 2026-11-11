import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import ComplaintEmptyState from "../components/complaints/ComplaintEmptyState.jsx";
import { ComplaintCardSkeleton } from "../components/common/SkeletonLoader.jsx";
import UnassignedComplaintCard from "../features/admin/UnassignedComplaintCard.jsx";
import AdminAssignedComplaintCard from "../features/admin/AdminAssignedComplaintCard.jsx";
import ProfileSettings from "../components/profile/ProfileSettings.jsx";
import ComplaintStatusBadge from "../components/complaints/ComplaintStatusBadge.jsx";
import {
  AlertCircle,
  ChartNoAxesColumn,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Star,
  Timer,
  Users,
  UserRound,
} from "lucide-react";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import ComplaintToolbar from "../components/complaints/ComplaintToolbar.jsx";
import ComplaintPagination from "../components/complaints/ComplaintPagination.jsx";
import { useAuth } from "../context/useAuth.js";
import { useAssistantContext } from "../context/assistantContext.jsx";
import {
  ASSIGNED_PAGE_SIZE,
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
  getAdminAuditQueueRequest,
  resolveAdminAuditRequest,
} from "../services/api.js";

const AdminReports = lazy(() => import("../features/admin/AdminReports.jsx"));
const AdminUserManagement = lazy(() => import("../features/admin/AdminUserManagement.jsx"));
const AdminAccountsPage = lazy(() => import("../features/admin/AdminAccountsPage.jsx"));
const AdminSlaPage = lazy(() => import("../features/admin/AdminSlaPage.jsx"));
const AdminCampusMapPage = lazy(() => import("../features/admin/AdminCampusMapPage.jsx"));

// Main admin dashboard: complaint queues, assignment actions, and reassignment.
export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();

  const [activeSection, setActiveSection] = useState("complaints");
  const [activeQueue, setActiveQueue] = useState("unassigned");
  const [expandedUnassignedId, setExpandedUnassignedId] = useState(null);
  const [selectedAssignedComplaintId, setSelectedAssignedComplaintId] =
    useState(null);

  const [assignedFilter, setAssignedFilter] = useState("current");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedSort, setAssignedSort] = useState("newest");
  const [assignedPage, setAssignedPage] = useState(1);
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [unassignedPagination, setUnassignedPagination] = useState(null);
  const [assignedPagination, setAssignedPagination] = useState(null);
  const [assignedCounts, setAssignedCounts] = useState({ current: 0, resolved: 0, closed: 0 });
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [assignedRefreshKey, setAssignedRefreshKey] = useState(0);
  const [debouncedAssignedSearch, setDebouncedAssignedSearch] = useState("");

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

  const [auditComplaints, setAuditComplaints] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [resolvingAuditId, setResolvingAuditId] = useState("");
  const [auditNotes, setAuditNotes] = useState({});

  const { setScreenContext } = useAssistantContext();

  const selectedAssignedComplaint = assignedComplaints.find(
    (complaint) => complaint._id === selectedAssignedComplaintId,
  );

  const activeComplaintList = activeQueue === "unassigned" ? complaints : assignedComplaints;

  useEffect(() => {
    setScreenContext({
      currentSection: `admin-${activeSection}-${activeQueue}`,
      pageTitle: activeQueue === "unassigned" ? "Admin Triage Queue (Unassigned Complaints)" : "Admin Assigned Complaints Management",
      activeFilters: { queue: activeQueue, filter: assignedFilter, search: assignedSearch },
      selectedComplaint: selectedAssignedComplaint ? { id: selectedAssignedComplaint._id, title: selectedAssignedComplaint.title } : null,
      visibleComplaints: (activeComplaintList || []).slice(0, 10).map((c, index) => ({
        index: index + 1,
        id: c._id,
        title: c.title,
        status: c.status,
        category: c.category,
        building: c.building,
        room: c.room,
      })),
      interactiveElements: [
        "queueTabs: unassigned (Triage), assigned (Active / In-progress)",
        "assignedStatusFilter: all, Assigned, In_Progress, Under_Review, Resolved",
        "searchTicketsInput",
        "departmentDropdown",
        "assignStaffButton",
        "reassignStaffModal",
      ],
      availableActions: [
        "filter",
        "clearFilters",
        "navigate",
        "openComplaint",
        "switchQueue",
        "switchTab",
      ],
    });
  }, [
    activeSection,
    activeQueue,
    assignedFilter,
    assignedSearch,
    selectedAssignedComplaint,
    activeComplaintList,
    setScreenContext,
  ]);

  useEffect(() => {
    function handleSetFilters(e) {
      const { status, search, queue } = e.detail || {};
      if (queue === "unassigned" || queue === "assigned") setActiveQueue(queue);
      if (status) setAssignedFilter(status);
      if (search !== undefined) setAssignedSearch(search);
    }

    function handleClearFilters() {
      setAssignedSearch("");
      setAssignedFilter("all");
    }

    function handleOpenComplaint(e) {
      const { id, index, title: targetTitle } = e.detail || {};
      const targetList = activeQueue === "unassigned" ? complaints : assignedComplaints;
      let targetId = id;
      if (!targetId && index !== undefined) {
        const idx = parseInt(index, 10) - 1;
        if (idx >= 0 && idx < targetList.length) {
          targetId = targetList[idx]._id;
        }
      } else if (!targetId && targetTitle) {
        const found = targetList.find((c) =>
          c.title?.toLowerCase().includes(targetTitle.toLowerCase()),
        );
        if (found) targetId = found._id;
      }
      if (targetId) setSelectedAssignedComplaintId(targetId);
    }

    function handleSwitchTab(e) {
      const { queue, tab } = e.detail || {};
      const target = queue || tab;
      if (target === "unassigned" || target === "assigned") {
        setActiveQueue(target);
      }
    }

    window.addEventListener("fixflow:set-filters", handleSetFilters);
    window.addEventListener("fixflow:clear-filters", handleClearFilters);
    window.addEventListener("fixflow:open-complaint", handleOpenComplaint);
    window.addEventListener("fixflow:switch-tab", handleSwitchTab);

    return () => {
      window.removeEventListener("fixflow:set-filters", handleSetFilters);
      window.removeEventListener("fixflow:clear-filters", handleClearFilters);
      window.removeEventListener("fixflow:open-complaint", handleOpenComplaint);
      window.removeEventListener("fixflow:switch-tab", handleSwitchTab);
    };
  }, [activeQueue, complaints, assignedComplaints]);

  const filteredAssignedComplaints = assignedComplaints;
  const visibleAssignedComplaints = assignedComplaints;

  const queueCount =
    activeQueue === "unassigned"
      ? unassignedPagination?.total ?? 0
      : activeQueue === "assigned"
        ? assignedPagination?.total ?? 0
        : auditComplaints.length;

  const loadAuditQueue = useCallback(async () => {
    if (!accessToken) return;
    setAuditLoading(true);
    setAuditError("");
    try {
      const data = await getAdminAuditQueueRequest(accessToken);
      setAuditComplaints(data.complaints || []);
    } catch (err) {
      setAuditError(err.message || "Failed to load audit queue.");
    } finally {
      setAuditLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAuditQueue();
  }, [loadAuditQueue, queueRefreshKey, assignedRefreshKey]);

  async function handleResolveAudit(complaintId) {
    setResolvingAuditId(complaintId);
    setError("");
    try {
      const note = auditNotes[complaintId] || "Admin audit completed and approved.";
      await resolveAdminAuditRequest(complaintId, note, accessToken);
      setSuccessMessage("Complaint audit resolved successfully.");
      setAuditComplaints((prev) => prev.filter((c) => c._id !== complaintId));
    } catch (err) {
      setError(err.message || "Could not resolve complaint audit.");
    } finally {
      setResolvingAuditId("");
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedAssignedSearch(assignedSearch.trim());
      setAssignedPage(1);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [assignedSearch]);

  // Load the unassigned queue and staff options for suggested departments.
  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError("");

      try {
        const data = await getUnassignedComplaintsRequest(accessToken, {
          page: unassignedPage,
          limit: ASSIGNED_PAGE_SIZE,
        });
        const queue = data.complaints ?? [];

        if (!active) return;

        setComplaints(queue);
        setUnassignedPagination(data.pagination ?? null);
        if (data.pagination && unassignedPage > Math.max(1, data.pagination.totalPages)) {
          setUnassignedPage(Math.max(1, data.pagination.totalPages));
        }

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
  }, [accessToken, unassignedPage, queueRefreshKey]);

  // Load assigned complaints for the filters, search, sort, and detail cards.
  useEffect(() => {
    let active = true;

    async function loadAssignedComplaints() {
      setAssignedLoading(true);
      setAssignedError("");

      try {
        const sortOptions = assignedSort === "updated"
          ? { sort: "updated", order: "desc" }
          : { sort: "created", order: assignedSort === "oldest" ? "asc" : "desc" };
        const data = await getAssignedComplaintsRequest(accessToken, {
          view: assignedFilter,
          search: debouncedAssignedSearch,
          page: assignedPage,
          limit: ASSIGNED_PAGE_SIZE,
          ...sortOptions,
        });

        if (active) {
          setAssignedComplaints(data.complaints ?? []);
          setAssignedPagination(data.pagination ?? null);
          setAssignedCounts(data.counts ?? { current: 0, resolved: 0, closed: 0 });
          if (data.pagination && assignedPage > Math.max(1, data.pagination.totalPages)) {
            setAssignedPage(Math.max(1, data.pagination.totalPages));
          }
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
  }, [accessToken, assignedFilter, debouncedAssignedSearch, assignedSort, assignedPage, assignedRefreshKey]);

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
      setQueueRefreshKey((key) => key + 1);
      setAssignedRefreshKey((key) => key + 1);
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

      setAssignedRefreshKey((key) => key + 1);
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
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      assistantNavItems={[
        { id: "campusMap", label: "Campus Map & GIS" },
        { id: "sla", label: "SLA tracking" },
        { id: "reports", label: "Reports" },
        { id: "users", label: "User access" },
        { id: "accounts", label: "Accounts" },
        { id: "complaints", label: "Complaints" },
        { id: "profile", label: "Profile" },
      ]}
      onAssistantNavigate={(item) => {
        setActiveSection(item.id);
      }}
      navItems={[
        { id: "complaints", label: "Complaints", icon: ClipboardList },
        { id: "campusMap", label: "Campus Map & GIS", icon: MapPin },
        { id: "users", label: "User access", icon: Users },
        { id: "accounts", label: "Accounts", icon: Users },
        { id: "profile", label: "Profile", icon: UserRound },
        { id: "sla", label: "SLA tracking", icon: Timer },
        {
          id: "reports",
          label: "Reports",
          icon: ChartNoAxesColumn,
        },
      ]}
    >
      {activeSection === "profile" ? (
        <ProfileSettings />
      ) : activeSection === "campusMap" ? (
        <Suspense fallback={<div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin text-brand" /> Loading campus map…</div>}>
          <AdminCampusMapPage accessToken={accessToken} />
        </Suspense>
      ) : activeSection === "users" ? (
        <Suspense fallback={<div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin text-brand" /> Loading user access…</div>}>
          <AdminUserManagement accessToken={accessToken} />
        </Suspense>
      ) : activeSection === "accounts" ? (
        <Suspense fallback={<div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin text-brand" /> Loading accounts…</div>}>
          <AdminAccountsPage accessToken={accessToken} />
        </Suspense>
      ) : activeSection === "reports" ? (
        <Suspense fallback={<div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin text-brand" /> Loading reports…</div>}>
          <AdminReports accessToken={accessToken} />
        </Suspense>
      ) : activeSection === "sla" ? (
        <Suspense fallback={<div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle size={18} className="animate-spin text-brand" /> Loading SLA tracking…</div>}>
          <AdminSlaPage accessToken={accessToken} />
        </Suspense>
      ) : (
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
                    : activeQueue === "assigned"
                      ? "Assigned complaints"
                      : "Needs audit (low ratings & reopened)"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {activeQueue === "unassigned"
                    ? "Choose a department and staff member for each complaint."
                    : activeQueue === "assigned"
                      ? "Track assigned complaints and see who is handling them."
                      : "Review resolved complaints flagged with low ratings (1-2★) or reopened by students."}
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

              <button
                type="button"
                onClick={() => changeQueue("audit")}
                aria-pressed={activeQueue === "audit"}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition ${
                  activeQueue === "audit"
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
                }`}
              >
                <ShieldAlert size={15} />
                <span>Needs audit</span>
                {auditComplaints.length > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeQueue === "audit" ? "bg-white text-brand" : "bg-rose-100 text-rose-700"
                  }`}>
                    {auditComplaints.length}
                  </span>
                )}
              </button>
            </div>

            {activeQueue === "assigned" && (
              <ComplaintToolbar
                filters={assignedFilters.map((filter) => ({
                  ...filter,
                  count: assignedCounts[filter.id] ?? 0,
                }))}
                activeFilter={assignedFilter}
                onFilterChange={(value) => {
                  setAssignedFilter(value);
                  setAssignedPage(1);
                  setSelectedAssignedComplaintId(null);
                }}
                searchValue={assignedSearch}
                onSearchChange={(value) => {
                  setAssignedSearch(value);
                  setAssignedPage(1);
                  setSelectedAssignedComplaintId(null);
                }}
                searchLabel="Search assigned complaints"
                searchPlaceholder="Search title, student, roll number, category, or location"
                sortValue={assignedSort}
                onSortChange={(value) => {
                  setAssignedSort(value);
                  setAssignedPage(1);
                  setSelectedAssignedComplaintId(null);
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

          {/* Complaint queues: audit, unassigned, or assigned */}
          {activeQueue === "audit" ? (
            auditLoading ? (
              <div className="py-2">
                <ComplaintCardSkeleton count={2} />
              </div>
            ) : auditError ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
              >
                {auditError}
              </p>
            ) : auditComplaints.length === 0 ? (
              <ComplaintEmptyState
                title="No complaints need audit"
                description="Complaints flagged with low CSAT ratings (1-2★) or reopened by students will appear here."
                className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center"
                titleClassName="font-display font-bold"
                descriptionClassName="mt-1 text-sm text-muted"
              />
            ) : (
              <div className="space-y-4">
                {auditComplaints.map((item) => (
                  <div
                    key={item._id}
                    className="overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ComplaintStatusBadge status={item.status} />
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                            {item.category}
                          </span>
                          {item.ticketNumber && (
                            <span className="text-xs font-mono font-bold text-muted">
                              #{item.ticketNumber}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 text-base font-bold text-ink">
                          {item.complaintTitle}
                        </h3>

                        <p className="mt-1 text-xs text-muted">
                          {item.location?.building} {item.location?.room ? `· Room ${item.location.room}` : ""} · Student: <span className="font-semibold text-ink">{item.userSnapshot?.name || item.user?.username || "Student"}</span>
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            <span>CSAT Rating: {item.csatRating ?? "—"}/5</span>
                          </div>
                          {item.status === "Reopened" && (
                            <div className="flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800 border border-purple-200">
                              <RotateCcw size={13} />
                              <span>Reopened (x{item.reopenedCount || 1})</span>
                            </div>
                          )}
                        </div>

                        {item.csatFeedback && (
                          <p className="mt-2 text-xs italic text-slate-700 bg-stone-50 p-2.5 rounded-xl border border-line">
                            Student feedback: "{item.csatFeedback}"
                          </p>
                        )}

                        {item.reopenReason && (
                          <p className="mt-2 text-xs text-purple-950 bg-purple-50/70 p-2.5 rounded-xl border border-purple-100">
                            Reopen reason: <span className="font-semibold">{item.reopenReason}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0 w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="Audit resolution note (optional)"
                          value={auditNotes[item._id] || ""}
                          onChange={(e) => setAuditNotes((prev) => ({ ...prev, [item._id]: e.target.value }))}
                          className="min-h-9 rounded-xl border border-line px-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={resolvingAuditId === item._id}
                          onClick={() => handleResolveAudit(item._id)}
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {resolvingAuditId === item._id ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          <span>Resolve audit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeQueue === "unassigned" ? (
            loading ? (
              <div className="py-2">
                <ComplaintCardSkeleton count={3} />
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
            <div className="py-2">
              <ComplaintCardSkeleton count={3} />
            </div>
          ) : assignedError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              {assignedError}
            </p>
          ) : (assignedPagination?.total ?? 0) === 0 ? (
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

          {activeQueue === "assigned" ? (
            <ComplaintPagination
              pagination={assignedPagination}
              onPageChange={setAssignedPage}
            />
          ) : activeQueue === "unassigned" ? (
            <ComplaintPagination
              pagination={unassignedPagination}
              onPageChange={setUnassignedPage}
            />
          ) : null}
        </section>
      </main>
      )}
    </DashboardShell>
  );
}
