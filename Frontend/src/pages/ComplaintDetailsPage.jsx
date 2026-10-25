import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Download, LoaderCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import ComplaintConversation from "../components/complaints/ComplaintConversation.jsx";
import ComplaintImageLink from "../components/complaints/ComplaintImageLink.jsx";
import ComplaintStatusBadge from "../components/complaints/ComplaintStatusBadge.jsx";
import ComplaintStatusTimeline from "../components/complaints/ComplaintStatusTimeline.jsx";
import { useAuth } from "../context/useAuth.js";
import { getComplaintDetailsRequest } from "../services/api.js";
import { downloadComplaintPdf } from "../utils/complaintPdf.js";
import { formatDate } from "../utils/complaintConfig.js";

const dashboardPaths = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
};

export default function ComplaintDetailsPage() {
  const { complaintId } = useParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getComplaintDetailsRequest(complaintId, accessToken)
      .then((data) => {
        if (active) setComplaint(data.complaint);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load this complaint.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [complaintId, accessToken]);

  const dashboardPath = dashboardPaths[user?.role] || "/login";
  const navItems = [{ id: "complaints", label: "Complaints", icon: ClipboardList }];

  return (
    <DashboardShell
      workspaceLabel={user?.role === "admin" ? "Administrator" : user?.role === "staff" ? "Staff" : "Student"}
      navItems={navItems}
      activeSection="complaints"
      onSectionChange={() => navigate(dashboardPath)}
    >
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted">
            <LoaderCircle size={19} className="animate-spin text-brand" />
            Loading complaint…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            {error}
          </div>
        ) : complaint ? (
          <article className="rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div className="min-w-0">
                <ComplaintStatusBadge status={complaint.status} />
                <h1 className="mt-3 break-words font-display text-2xl font-bold text-ink">
                  {complaint.complaintTitle}
                </h1>
                <p className="mt-1 text-sm text-muted">Submitted {formatDate(complaint.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadComplaintPdf(complaint)}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-soft"
              >
                <Download size={16} />
                Download PDF
              </button>
            </header>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0 space-y-5">
                <section>
                  <h2 className="text-sm font-bold">Description</h2>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{complaint.complaintDescription || "No description provided."}</p>
                </section>

                <dl className="grid gap-4 rounded-2xl bg-canvas/70 p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Category</dt><dd className="mt-1 font-semibold">{complaint.category || "Not available"}</dd></div>
                  <div><dt className="text-muted">Location</dt><dd className="mt-1 font-semibold">{complaint.location?.building || "Building unavailable"}{complaint.location?.room ? ` · Room ${complaint.location.room}` : ""}</dd></div>
                  <div><dt className="text-muted">Student</dt><dd className="mt-1 font-semibold">{complaint.user?.username || complaint.userSnapshot?.name || "Student"}{complaint.user?.rollno || complaint.userSnapshot?.campusId ? ` · ${complaint.user?.rollno || complaint.userSnapshot?.campusId}` : ""}</dd></div>
                  <div><dt className="text-muted">Assigned staff</dt><dd className="mt-1 font-semibold">{complaint.assignedStaff?.username || complaint.assignedStaffSnapshot?.name || "Not assigned"}</dd></div>
                  <div><dt className="text-muted">Department</dt><dd className="mt-1 font-semibold">{complaint.assignedDepartment || complaint.assignedStaffSnapshot?.department || "Not assigned"}</dd></div>
                  {complaint.status === "Resolved" && <div><dt className="text-muted">Resolved</dt><dd className="mt-1 font-semibold">{formatDate(complaint.resolvedAt)}</dd></div>}
                </dl>

                {complaint.complaintPictureUrl && (
                  <section>
                    <h2 className="text-sm font-bold">Submitted proof</h2>
                    <ComplaintImageLink src={complaint.complaintPictureUrl} alt={`Proof for ${complaint.complaintTitle}`} ariaLabel="Open submitted proof photo" className="mt-2 inline-flex max-w-full overflow-hidden rounded-xl border border-line" imageClassName="max-h-80 max-w-full object-contain" />
                  </section>
                )}

                {complaint.status === "Resolved" && (complaint.resolutionNote || complaint.resolutionProofUrl) && (
                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <h2 className="font-bold text-emerald-900">Resolution details</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">{complaint.resolutionNote || "No resolution note was recorded."}</p>
                    {complaint.resolutionProofUrl && <ComplaintImageLink src={complaint.resolutionProofUrl} alt={`Resolution proof for ${complaint.complaintTitle}`} ariaLabel="Open resolution proof photo" className="mt-3 inline-flex max-w-full overflow-hidden rounded-xl border border-emerald-200" imageClassName="max-h-72 max-w-full object-contain" />}
                  </section>
                )}
              </div>

              <ComplaintStatusTimeline history={complaint.statusHistory} title="Status history" includeActorRole emptyMessage="No status updates are available yet." />
            </div>

            <ComplaintConversation complaint={complaint} />
          </article>
        ) : null}
      </div>
    </DashboardShell>
  );
}
