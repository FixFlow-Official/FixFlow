import {
  CheckCircle2,
  Download,
  LoaderCircle,
  UserCheck,
  X,
} from "lucide-react";
import { closedStatuses, formatDate, formatStatus, statusStyles } from "../../../utils/complaintConfig.js";

export default function AssignedComplaintDetails({
  complaint,
  onClose,
  departments,
  reassignDepartment,
  reassignStaffId,
  reassignStaffList,
  loadingReassignStaff,
  reassigning,
  onDepartmentChange,
  onStaffChange,
  onReassign,
  onDownloadPdf,
}) {
  const status = complaint.status || "Assigned";
  const statusClass = statusStyles[status] || "bg-slate-100 text-slate-700";
  const canReassign = !closedStatuses.includes(status);

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

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDownloadPdf(complaint)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-ink transition hover:border-brand/40 hover:bg-brand-soft focus:outline-none focus:ring-4 focus:ring-brand/10"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close complaint details"
            title="Close"
            className="grid size-10 place-items-center rounded-xl border border-line text-muted transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-brand/10"
          >
            <X size={18} />
          </button>
        </div>
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
                {complaint.user?.rollno ? ` · ${complaint.user.rollno}` : ""}
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

          {canReassign && (
            <section className="rounded-xl border border-line bg-canvas/50 p-4">
              <h4 className="font-display font-bold">Reassign complaint</h4>
              <p className="mt-1 text-sm text-muted">
                Choose a department and staff member to transfer this complaint.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0 space-y-1.5">
                  <span className="text-sm font-semibold">Department</span>
                  <select
                    value={reassignDepartment}
                    onChange={(event) => onDepartmentChange(event.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  >
                    <option value="">Choose department</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block min-w-0 space-y-1.5">
                  <span className="text-sm font-semibold">Staff member</span>
                  <select
                    value={reassignStaffId}
                    onChange={(event) => onStaffChange(event.target.value)}
                    disabled={!reassignDepartment || loadingReassignStaff}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">
                      {loadingReassignStaff
                        ? "Loading staff…"
                        : !reassignDepartment
                          ? "Choose a department first"
                          : reassignStaffList.length === 0
                            ? "No staff in this department"
                            : "Choose staff member"}
                    </option>
                    {reassignStaffList.map((staff) => (
                      <option
                        key={staff._id || staff.staffId}
                        value={staff.staffId}
                      >
                        {staff.username} · ID {staff.staffId}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={onReassign}
                disabled={
                  reassigning ||
                  loadingReassignStaff ||
                  !reassignDepartment ||
                  !reassignStaffId
                }
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {reassigning ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <UserCheck size={16} />
                )}
                {reassigning ? "Reassigning…" : "Reassign complaint"}
              </button>
            </section>
          )}

          {closedStatuses.includes(status) && (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
              This complaint is closed and can no longer be reassigned.
            </p>
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
