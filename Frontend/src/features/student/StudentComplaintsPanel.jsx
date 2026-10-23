import { ArrowLeft, Inbox, LoaderCircle, Plus } from "lucide-react";
import ComplaintEmptyState from "../../components/complaints/ComplaintEmptyState.jsx";
import ComplaintToolbar from "../../components/complaints/ComplaintToolbar.jsx";
import StudentComplaintCard from "./StudentComplaintCard.jsx";

// Student complaint history screen; data loading and filtering remain in DashboardPage.
export default function StudentComplaintsPanel({
  openCreateComplaint,
  currentComplaints,
  resolvedComplaints,
  complaintFilter,
  setComplaintFilter,
  complaintSearch,
  setComplaintSearch,
  loadingComplaints,
  complaintError,
  filteredComplaints,
  openComplaintDetails,
  downloadComplaintPdf,
}) {
  return (
          <section className="w-full rounded-3xl border border-white/90 bg-white/95 p-4 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 sm:rounded-[1.75rem] sm:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={openCreateComplaint}
                  className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft"
                >
                  <ArrowLeft size={16} />
                  Back to Create complaint
                </button>
                <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  My complaints
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Select a complaint to view its complete details.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateComplaint}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-dark sm:w-auto"
              >
                <Plus size={16} />
                Create complaint
              </button>
            </div>

            <ComplaintToolbar
              filters={[
                {
                  id: "current",
                  label: "Current",
                  count: currentComplaints.length,
                },
                {
                  id: "resolved",
                  label: "Resolved",
                  count: resolvedComplaints.length,
                },
              ]}
              activeFilter={complaintFilter}
              onFilterChange={setComplaintFilter}
              searchValue={complaintSearch}
              onSearchChange={setComplaintSearch}
              searchLabel="Search your complaints"
              searchPlaceholder="Search title, description, category, or location"
            />

            {loadingComplaints ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted">
                <LoaderCircle size={22} className="animate-spin text-brand" />
                Loading your complaints…
              </div>
            ) : complaintError ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
              >
                {complaintError}
              </p>
            ) : filteredComplaints.length === 0 ? (
              <ComplaintEmptyState
                className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center"
                titleClassName="mt-4 font-display font-bold"
                descriptionClassName="mt-1 max-w-sm text-sm leading-6 text-muted"
                icon={Inbox}
                title={
                  complaintSearch.trim()
                    ? "No matching complaints"
                    : complaintFilter === "resolved"
                      ? "No resolved complaints"
                      : "No current complaints"
                }
                description={
                  complaintSearch.trim()
                    ? "Try another title, category, description, or location."
                    : complaintFilter === "resolved"
                      ? "Resolved complaints will appear here."
                      : "Your submitted complaints will appear here while they are being handled."
                }
              />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-2">
                {filteredComplaints.map((complaint) => (
                  <StudentComplaintCard
                    key={complaint._id}
                    complaint={complaint}
                    onOpen={openComplaintDetails}
                    onDownload={downloadComplaintPdf}
                  />
                ))}
              </div>
            )}
          </section>

  );
}
