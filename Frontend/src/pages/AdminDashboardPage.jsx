import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  assignComplaintRequest,
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

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function AdminDashboardPage() {
  const { user, accessToken } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [staffByDepartment, setStaffByDepartment] = useState({});
  const [selectedDepartments, setSelectedDepartments] = useState({});
  const [selectedStaffIds, setSelectedStaffIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
          setError(requestError.message || "Could not load the complaint queue.");
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
      setError(requestError.message || "Could not load staff for that department.");
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
      setSuccessMessage(result.message || "Complaint assigned successfully.");
    } catch (requestError) {
      setError(requestError.message || "Could not assign this complaint.");
    } finally {
      setAssigningId("");
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
        Administrator workspace
      </span>

      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Welcome, {user?.username || "Administrator"}
      </h1>

      <p className="mt-2 text-muted">
        Review new student complaints and assign them to the right campus team.
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">
              Unassigned complaints
            </h2>
            <p className="mt-1 text-sm text-muted">
              Choose a department and staff member for each complaint.
            </p>
          </div>

          {!loading && (
            <span className="rounded-full bg-canvas px-3 py-1 text-sm font-bold text-muted">
              {complaints.length}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {successMessage && (
          <p
            role="status"
            className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
          >
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            {successMessage}
          </p>
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted">
            <LoaderCircle size={21} className="animate-spin text-brand" />
            Loading complaints…
          </div>
        ) : complaints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center">
            <h3 className="font-display font-bold">No unassigned complaints</h3>
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
                  className="rounded-2xl border border-line p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold">
                          {complaint.complaintTitle}
                        </h3>
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                          {complaint.status?.replaceAll("_", " ") || "Submitted"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-muted">
                        {complaint.complaintDescription}
                      </p>

                      <p className="mt-2 text-xs font-medium text-muted">
                        {complaint.category}
                        {" · "}
                        {complaint.location?.building}
                        {complaint.location?.room
                          ? ` · Room ${complaint.location.room}`
                          : ""}
                      </p>

                      <p className="mt-2 text-xs text-muted">
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

                    <div className="grid gap-3 lg:w-72 lg:shrink-0">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold">Department</span>
                        <select
                          value={department}
                          onChange={(event) =>
                            handleDepartmentChange(
                              complaint._id,
                              event.target.value,
                            )
                          }
                          className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                        >
                          <option value="">Choose department</option>
                          {departments.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold">Staff member</span>
                        <select
                          value={selectedStaffIds[complaint._id] || ""}
                          onChange={(event) =>
                            setSelectedStaffIds((current) => ({
                              ...current,
                              [complaint._id]: event.target.value,
                            }))
                          }
                          disabled={!department || staff.length === 0}
                          className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                          <LoaderCircle size={16} className="animate-spin" />
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
        )}
      </section>
    </main>
  );
}