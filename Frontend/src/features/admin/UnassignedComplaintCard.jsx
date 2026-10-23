import { LoaderCircle, UserCheck } from "lucide-react";
import ExpandableComplaintCard from "../../components/complaints/ExpandableComplaintCard.jsx";
import { departments, formatDate } from "../../utils/complaintConfig.js";

// Complete unassigned complaint row, including department/staff selection and assignment action.
export default function UnassignedComplaintCard({
  complaint,
  department,
  staff,
  selectedStaffId,
  assigning,
  expanded,
  onToggle,
  onDepartmentChange,
  onStaffChange,
  onAssign,
  onDownloadPdf,
}) {
  const studentSummary = [
    `Submitted by ${complaint.user?.username || "Student"}`,
    complaint.user?.rollno ? `Roll no. ${complaint.user.rollno}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <ExpandableComplaintCard
      complaint={complaint}
      expanded={expanded}
      onToggle={onToggle}
      onDownloadPdf={onDownloadPdf}
      summary={studentSummary}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Student</dt>
              <dd className="mt-1 font-semibold">
                {complaint.user?.username || "Student"}
                {complaint.user?.rollno ? ` · ${complaint.user.rollno}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Location</dt>
              <dd className="mt-1 font-semibold">
                {complaint.location?.building || "Building unavailable"}
                {complaint.location?.room ? ` · Room ${complaint.location.room}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Submitted</dt>
              <dd className="mt-1 font-semibold">{formatDate(complaint.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Category</dt>
              <dd className="mt-1 font-semibold">{complaint.category || "Not provided"}</dd>
            </div>
          </dl>
        </div>

        <div className="grid min-w-0 gap-3">
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm font-semibold">Department</span>
            <select
              value={department}
              onChange={(event) => onDepartmentChange(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            >
              <option value="">Choose department</option>
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm font-semibold">Staff member</span>
            <select
              value={selectedStaffId}
              onChange={(event) => onStaffChange(event.target.value)}
              disabled={!department || staff.length === 0}
              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {!department ? "Choose a department first" : staff.length === 0 ? "No staff in this department" : "Choose staff member"}
              </option>
              {staff.map((person) => (
                <option key={person._id || person.staffId} value={person.staffId}>
                  {person.username} · ID {person.staffId}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onAssign}
            disabled={assigning}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {assigning ? <LoaderCircle size={16} className="animate-spin" /> : <UserCheck size={16} />}
            Assign complaint
          </button>
        </div>
      </div>
    </ExpandableComplaintCard>
  );
}
