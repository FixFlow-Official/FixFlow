import { LoaderCircle, UserCheck } from "lucide-react";
import ComplaintImageLink from "../../components/complaints/ComplaintImageLink.jsx";
import ComplaintStatusTimeline from "../../components/complaints/ComplaintStatusTimeline.jsx";
import ExpandableComplaintCard from "../../components/complaints/ExpandableComplaintCard.jsx";
import { departments, formatDate } from "../../utils/complaintConfig.js";

// Assigned complaint details and reassignment controls for the administrator queue.
export default function AdminAssignedComplaintCard({
  complaint,
  expanded,
  onToggle,
  onDownloadPdf,
  reassignDepartment,
  reassignStaffId,
  reassignStaffList,
  loadingReassignStaff,
  reassigning,
  onDepartmentChange,
  onStaffChange,
  onReassign,
}) {
  const studentName = complaint.user?.username || complaint.userSnapshot?.name || "Student";
  const studentId = complaint.user?.rollno || complaint.userSnapshot?.campusId;
  const staffName = complaint.assignedStaff?.username || complaint.assignedStaffSnapshot?.name;
  const studentSummary = [
    `Submitted by ${studentName}`,
    studentId ? `Roll no. ${studentId}` : "",
    staffName ? `Assigned to ${staffName}` : "",
    complaint.assignedDepartment || "",
  ].filter(Boolean).join(" · ");

  const isExpanded = expanded;

  return (
                  <ExpandableComplaintCard
                    complaint={complaint}
                    expanded={isExpanded}
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
                              {studentName}
                              {studentId
                                ? ` · ${studentId}`
                                : ""}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-muted">
                              Assigned staff
                            </dt>
                            <dd className="mt-1 font-semibold">
                              {staffName ||
                                "Staff member"}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-muted">Department</dt>
                            <dd className="mt-1 font-semibold">
                              {complaint.assignedDepartment || "Not provided"}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-muted">Location</dt>
                            <dd className="mt-1 font-semibold">
                              {complaint.location?.building ||
                                "Building unavailable"}
                              {complaint.location?.room
                                ? ` · Room ${complaint.location.room}`
                                : ""}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-muted">Submitted</dt>
                            <dd className="mt-1 font-semibold">
                              {formatDate(complaint.createdAt)}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-muted">Last updated</dt>
                            <dd className="mt-1 font-semibold">
                              {formatDate(complaint.updatedAt)}
                            </dd>
                          </div>
                        </dl>

                        {complaint.complaintPictureUrl && (
                          <div className="mt-5">
                            <h3 className="text-sm font-semibold">
                              Submitted proof
                            </h3>
                            <ComplaintImageLink
                              src={complaint.complaintPictureUrl}
                              alt={`Proof for ${complaint.complaintTitle}`}
                              ariaLabel="Open complaint proof photo"
                              className="mt-2 inline-flex overflow-hidden rounded-xl border border-line"
                              imageClassName="h-36 w-48 object-cover"
                            />
                          </div>
                        )}

                        <ComplaintStatusTimeline
                          history={complaint.statusHistory}
                          title="Status history"
                          variant="compact"
                          includeActorRole
                        />
                      </div>

                      <div className="rounded-2xl bg-stone-50 p-4">
                        <h3 className="font-semibold">Reassign complaint</h3>
                        <p className="mt-1 text-sm leading-5 text-muted">
                          Choose the department and staff member who should
                          handle this complaint.
                        </p>

                        <label className="mt-4 block space-y-1.5">
                          <span className="text-sm font-semibold">
                            Department
                          </span>
                          <select
                            value={
                              isExpanded
                                ? reassignDepartment
                                : complaint.assignedDepartment || ""
                            }
                            onChange={(event) =>
                              onDepartmentChange(event.target.value)
                            }
                            disabled={!isExpanded || reassigning}
                            className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            <option value="">Choose department</option>
                            {departments.map((department) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="mt-4 block space-y-1.5">
                          <span className="text-sm font-semibold">
                            Staff member
                          </span>
                          <select
                            value={isExpanded ? reassignStaffId : ""}
                            onChange={(event) =>
                              onStaffChange(event.target.value)
                            }
                            disabled={
                              !isExpanded ||
                              loadingReassignStaff ||
                              !reassignDepartment ||
                              reassignStaffList.length === 0 ||
                              reassigning
                            }
                            className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                            {reassignStaffList.map((person) => (
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
                          onClick={onReassign}
                          disabled={
                            !isExpanded ||
                            reassigning ||
                            loadingReassignStaff ||
                            !reassignDepartment ||
                            !reassignStaffId
                          }
                          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reassigning ? (
                            <LoaderCircle size={16} className="animate-spin" />
                          ) : (
                            <UserCheck size={16} />
                          )}
                          Reassign complaint
                        </button>
                      </div>
                    </div>
                  </ExpandableComplaintCard>
  );
}
