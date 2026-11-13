import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Download, LoaderCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import ComplaintConversation from "../components/complaints/ComplaintConversation.jsx";
import ComplaintImageLink from "../components/complaints/ComplaintImageLink.jsx";
import ComplaintStatusBadge from "../components/complaints/ComplaintStatusBadge.jsx";
import ComplaintLiveTimeline from "../components/complaints/ComplaintLiveTimeline.jsx";
import ComplaintResolutionVerification from "../components/complaints/ComplaintResolutionVerification.jsx";
import { useAuth } from "../context/useAuth.js";
import { useAssistantContext } from "../context/assistantContext.jsx";
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
  return <ComplaintDetailsContent key={complaintId} complaintId={complaintId} />;
}

function ComplaintDetailsContent({ complaintId }) {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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
  const { setScreenContext } = useAssistantContext();

  useEffect(() => {
    setScreenContext({
      currentSection: "complaint-details",
      pageTitle: `Ticket #${complaint?.ticketNumber || complaintId} - ${complaint?.title || "Complaint Details"}`,
      selectedComplaint: complaint
        ? {
            id: complaint._id,
            ticketNumber: complaint.ticketNumber,
            title: complaint.title,
            status: complaint.status,
            category: complaint.category,
            building: complaint.building,
            floor: complaint.floor,
            room: complaint.room,
            description: complaint.description,
          }
        : null,
      interactiveElements: [
        "backButton",
        "exportPdfButton",
        "statusTimeline",
        "commentsAndConversation",
      ],
      availableActions: ["exportReport", "navigate"],
    });
  }, [complaint, complaintId, setScreenContext]);

  useEffect(() => {
    function handleExportReport() {
      if (complaint) {
        downloadComplaintPdf(complaint);
      }
    }

    window.addEventListener("fixflow:export-report", handleExportReport);
    return () => window.removeEventListener("fixflow:export-report", handleExportReport);
  }, [complaint]);

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

                {complaint.resolutionProofUrl && complaint.complaintPictureUrl ? (
                  <section className="rounded-2xl border border-line bg-canvas/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div>
                        <h2 className="text-sm font-bold text-ink">
                          Visual Resolution Audit (Before & After)
                        </h2>
                        <p className="text-xs text-muted">
                          Side-by-side inspection of reported issue and technician fix
                        </p>
                      </div>
                      {(() => {
                        const v = complaint.aiResolutionVerification;
                        const verdict = v?.verdict || (complaint.resolutionVerified ? "VERIFIED" : "INCONCLUSIVE");
                        const score = v?.confidenceScore != null ? v.confidenceScore : (verdict === "VERIFIED" ? 85 : 50);

                        if (verdict === "VERIFIED") {
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              VERIFIED · AI confidence {score}%
                            </span>
                          );
                        }
                        if (verdict === "MISMATCH") {
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                              <AlertTriangle size={13} className="text-rose-600" />
                              MISMATCH · AI confidence {score}%
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            <AlertTriangle size={13} className="text-amber-600" />
                            INCONCLUSIVE (Needs manual check) · AI confidence {score}%
                          </span>
                        );
                      })()}
                    </div>

                    {complaint.aiResolutionVerification?.reasons?.length > 0 && (
                      <div className="mt-3 rounded-xl bg-stone-100/80 p-2.5 text-xs text-stone-700">
                        <p className="font-semibold text-stone-800">AI Audit Assessment:</p>
                        <ul className="mt-1 list-disc pl-4 space-y-0.5">
                          {complaint.aiResolutionVerification.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                          BEFORE · Reported Issue
                        </span>
                        <ComplaintImageLink
                          src={complaint.complaintPictureUrl}
                          alt={`Reported photo for ${complaint.complaintTitle}`}
                          ariaLabel="Open submitted proof photo"
                          className="mt-2 inline-flex max-w-full overflow-hidden rounded-xl border border-line bg-white"
                          imageClassName="max-h-72 max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                          AFTER · Resolution Proof
                        </span>
                        <ComplaintImageLink
                          src={complaint.resolutionProofUrl}
                          alt={`Resolution photo for ${complaint.complaintTitle}`}
                          ariaLabel="Open resolution proof photo"
                          className="mt-2 inline-flex max-w-full overflow-hidden rounded-xl border border-emerald-300 bg-white"
                          imageClassName="max-h-72 max-w-full object-contain"
                        />
                      </div>
                    </div>
                  </section>
                ) : complaint.complaintPictureUrl ? (
                  <section>
                    <h2 className="text-sm font-bold">Submitted proof</h2>
                    <ComplaintImageLink
                      src={complaint.complaintPictureUrl}
                      alt={`Proof for ${complaint.complaintTitle}`}
                      ariaLabel="Open submitted proof photo"
                      className="mt-2 inline-flex max-w-full overflow-hidden rounded-xl border border-line"
                      imageClassName="max-h-80 max-w-full object-contain"
                    />
                  </section>
                ) : null}

                {complaint.status === "Resolved" && complaint.resolutionNote && (
                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <h2 className="font-bold text-emerald-900">Resolution details</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                      {complaint.resolutionNote}
                    </p>
                  </section>
                )}

                {user?.role === "student" && (
                  <ComplaintResolutionVerification
                    complaint={complaint}
                    accessToken={accessToken}
                    onUpdate={(updated) => setComplaint((prev) => ({ ...prev, ...updated }))}
                  />
                )}
              </div>

              <ComplaintLiveTimeline complaint={complaint} history={complaint.statusHistory} includeActorRole />
            </div>

            <ComplaintConversation complaint={complaint} />
          </article>
        ) : null}
      </div>
    </DashboardShell>
  );
}
