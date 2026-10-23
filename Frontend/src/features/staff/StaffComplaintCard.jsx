import { CheckCircle2, Clock3 } from "lucide-react";
import ComplaintImageLink from "../../components/complaints/ComplaintImageLink.jsx";
import ExpandableComplaintCard from "../../components/complaints/ExpandableComplaintCard.jsx";
import StaffComplaintStatusForm from "./StaffComplaintStatusForm.jsx";
import { formatDate } from "../../utils/complaintConfig.js";

// Staff complaint card with student evidence, resolution history, and status controls.
export default function StaffComplaintCard({
  complaint,
  selectedStatuses,
  staffStatuses,
  setSelectedStatuses,
  notes,
  setNotes,
  resolutionProofs,
  setResolutionProofs,
  actionError,
  successMessage,
  savingId,
  expanded,
  onToggle,
  onDownloadPdf,
  onSave,
}) {
  const complaintId = complaint._id;
  const isResolved = complaint.status === "Resolved";
  const selectedStatus = selectedStatuses[complaintId] ?? complaint.status;
  const isSaving = savingId === complaintId;
  const isExpanded = expanded;
  const studentSummary = [
    complaint.user?.username ?? "Student",
    complaint.user?.rollno ? `Roll no. ${complaint.user.rollno}` : "",
  ].filter(Boolean).join(" · ");

  return (
                  <ExpandableComplaintCard
                    complaint={complaint}
                    expanded={isExpanded}
                    onToggle={onToggle}
                    onDownloadPdf={onDownloadPdf}
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
                          <ComplaintImageLink
                            src={complaint.complaintPictureUrl}
                            alt={`Proof for ${complaint.complaintTitle}`}
                            ariaLabel="Open complaint proof photo"
                            className="mt-4 inline-flex overflow-hidden rounded-xl border border-line"
                            imageClassName="h-36 w-48 object-cover"
                          />
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
                              <ComplaintImageLink
                                src={complaint.resolutionProofUrl}
                                alt={`Resolution proof for ${complaint.complaintTitle}`}
                                ariaLabel="Open resolution proof photo"
                                className="mt-4 inline-flex overflow-hidden rounded-xl border border-emerald-200"
                                imageClassName="h-40 w-56 object-cover"
                              />
                            ) : (
                              <p className="mt-3 text-sm text-emerald-800">
                                No resolution photo is available.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <StaffComplaintStatusForm
                        complaintId={complaintId}
                        isResolved={isResolved}
                        selectedStatus={selectedStatus}
                        staffStatuses={staffStatuses}
                        setSelectedStatuses={setSelectedStatuses}
                        notes={notes}
                        setNotes={setNotes}
                        resolutionProofs={resolutionProofs}
                        setResolutionProofs={setResolutionProofs}
                        actionError={actionError}
                        successMessage={successMessage}
                        isSaving={isSaving}
                        onSave={onSave}
                      />
                    </div>
                  </ExpandableComplaintCard>
  );
}
