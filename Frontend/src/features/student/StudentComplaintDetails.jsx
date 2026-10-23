import { CheckCircle2 } from "lucide-react";
import ComplaintImageLink from "../../components/complaints/ComplaintImageLink.jsx";
import ComplaintStatusTimeline from "../../components/complaints/ComplaintStatusTimeline.jsx";
import { formatDate } from "../../utils/complaintConfig.js";

export default function StudentComplaintDetails({ complaint }) {
    const status = complaint.status || "Submitted";
    const history = [...(complaint.statusHistory ?? [])].sort(
      (a, b) => new Date(a.changedAt) - new Date(b.changedAt),
    );

    return (
      <div className="min-w-0">
        <div className="mb-5 flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted">Complaint details</p>
          <h2 className="break-words font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {complaint.complaintTitle}
          </h2>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            <div>
              <h3 className="text-sm font-bold">Description</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                {complaint.complaintDescription}
              </p>
            </div>

            <dl className="grid min-w-0 gap-4 rounded-2xl bg-canvas/70 p-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-muted">Category</dt>
                <dd className="mt-1 break-words font-semibold">
                  {complaint.category || "Not available"}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-muted">Building</dt>
                <dd className="mt-1 break-words font-semibold">
                  {complaint.location?.building || "Not available"}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-muted">Room</dt>
                <dd className="mt-1 break-words font-semibold">
                  {complaint.location?.room || "Not provided"}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-muted">Submitted</dt>
                <dd className="mt-1 break-words font-semibold">
                  {formatDate(complaint.createdAt)}
                </dd>
              </div>

              {complaint.assignedDepartment && (
                <div className="min-w-0">
                  <dt className="text-muted">Assigned department</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {complaint.assignedDepartment}
                  </dd>
                </div>
              )}

              {complaint.assignedStaff && (
                <div className="min-w-0">
                  <dt className="text-muted">Assigned staff</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {complaint.assignedStaff.username || "Staff member"}
                  </dd>
                </div>
              )}
            </dl>

            {complaint.complaintPictureUrl && (
              <div>
                <h3 className="text-sm font-bold">Submitted proof</h3>
                <ComplaintImageLink
                  src={complaint.complaintPictureUrl}
                  alt={`Submitted proof for ${complaint.complaintTitle}`}
                  ariaLabel="Open submitted proof photo"
                  className="mt-2 inline-block max-w-full overflow-hidden rounded-2xl border border-line"
                  imageClassName="max-h-72 max-w-full object-contain"
                />
              </div>
            )}

            {status === "Resolved" && (
              <section className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={18}
                    className="shrink-0 text-emerald-700"
                  />
                  <h3 className="font-bold text-emerald-900">
                    Resolution details
                  </h3>
                </div>

                {complaint.resolutionNote && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-emerald-950">
                    {complaint.resolutionNote}
                  </p>
                )}

                <dl className="mt-3 space-y-2 text-sm text-emerald-900">
                  {complaint.resolvedAt && (
                    <div>
                      <dt className="inline font-semibold">Resolved: </dt>
                      <dd className="inline">
                        {formatDate(complaint.resolvedAt)}
                      </dd>
                    </div>
                  )}

                  {complaint.resolvedBy && (
                    <div>
                      <dt className="inline font-semibold">Resolved by: </dt>
                      <dd className="inline">
                        {complaint.resolvedBy.username || "Staff member"}
                        {complaint.resolvedBy.department
                          ? ` · ${complaint.resolvedBy.department}`
                          : ""}
                      </dd>
                    </div>
                  )}
                </dl>

                {complaint.resolutionProofUrl && (
                  <div className="mt-4">
                    <h4 className="text-sm font-bold text-emerald-900">
                      Resolution proof
                    </h4>
                    <ComplaintImageLink
                      src={complaint.resolutionProofUrl}
                      alt={`Resolution proof for ${complaint.complaintTitle}`}
                      ariaLabel="Open resolution proof photo"
                      className="mt-2 inline-block max-w-full overflow-hidden rounded-xl border border-emerald-200"
                      imageClassName="max-h-72 max-w-full object-contain"
                    />
                  </div>
                )}
              </section>
            )}

            {(complaint.rejectedReason || complaint.onHoldReason) && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-900">
                  {complaint.rejectedReason ? "Reason" : "On hold"}
                </h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-amber-900">
                  {complaint.rejectedReason || complaint.onHoldReason}
                </p>
              </section>
            )}
          </div>

          <aside className="min-w-0 rounded-2xl border border-line bg-canvas/50 p-4">
            <ComplaintStatusTimeline
              history={history}
              title="Status history"
              emptyMessage="No status updates are available yet."
            />
          </aside>
        </div>
      </div>
    );
  }
