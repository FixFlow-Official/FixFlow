import { useState } from "react";
import { ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { suggestStatusNoteRequest } from "../../services/api.js";

// Status controls for one active staff complaint. The dashboard owns request state and saving.
export default function StaffComplaintStatusForm({
  complaintId,
  complaintTitle,
  complaintCategory,
  accessToken,
  isResolved,
  selectedStatus,
  staffStatuses,
  setSelectedStatuses,
  notes,
  setNotes,
  resolutionProofs,
  setResolutionProofs,
  actionError,
  successMessage,
  isSaving,
  onSave,
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  if (isResolved) return null;

  async function suggestNote() {
    setSuggesting(true);
    setSuggestion(null);
    setSuggestionError("");
    try {
      setSuggestion(await suggestStatusNoteRequest({ title: complaintTitle, category: complaintCategory, status: selectedStatus }, accessToken));
    } catch (error) {
      setSuggestionError(error.message || "Could not draft a note.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
                        <div className="rounded-2xl bg-stone-50 p-4">
                          <label
                            htmlFor={`status-${complaintId}`}
                            className="text-sm font-semibold"
                          >
                            Update status
                          </label>

                          <select
                            id={`status-${complaintId}`}
                            value={selectedStatus}
                            onChange={(event) =>
                              {
                                setSuggestion(null);
                                setSelectedStatuses((current) => ({
                                  ...current,
                                  [complaintId]: event.target.value,
                                }));
                              }
                            }
                            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                          >
                            {staffStatuses.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>

                          <div className="mt-4 flex items-center justify-between gap-2">
                          <label htmlFor={`note-${complaintId}`} className="block text-sm font-semibold">
                            {selectedStatus === "Resolved"
                              ? "Resolution note (required)"
                              : selectedStatus === "On_Hold"
                                ? "Note (required)"
                                : "Note (optional)"}
                          </label>
                          <button type="button" onClick={suggestNote} disabled={suggesting} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-brand/20 bg-brand-soft/60 px-2.5 text-[11px] font-bold text-brand-dark hover:bg-brand-soft disabled:opacity-60">{suggesting ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}{suggesting ? "Drafting…" : "Draft note"}</button>
                          </div>

                          <textarea
                            id={`note-${complaintId}`}
                            rows={3}
                            maxLength={1000}
                            value={notes[complaintId] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [complaintId]: event.target.value,
                              }))
                            }
                            placeholder={
                              selectedStatus === "Resolved"
                                ? "Describe the work completed"
                                : selectedStatus === "On_Hold"
                                  ? "Explain why work is on hold"
                                  : "Add an update for the complaint history"
                            }
                            className="mt-2 w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                          />

                          {suggestionError && <p role="alert" className="mt-2 text-xs text-rose-700">{suggestionError}</p>}
                          {suggestion && <div className="mt-2 rounded-xl border border-brand/15 bg-brand-soft/40 p-3"><p className="whitespace-pre-wrap text-xs leading-5 text-ink">{suggestion.note}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-muted">{suggestion.source === "gemini" ? "AI draft · verify all details" : "Starter template · add verified details"}</span><button type="button" onClick={() => { setNotes((current) => ({ ...current, [complaintId]: suggestion.note })); setSuggestion(null); }} className="rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-bold text-white">Use draft</button></div></div>}

                          {selectedStatus === "Resolved" && (
                            <div className="mt-4">
                              <label
                                htmlFor={`resolution-proof-${complaintId}`}
                                className="block text-sm font-semibold"
                              >
                                Resolution photo (required)
                              </label>

                              <label
                                htmlFor={`resolution-proof-${complaintId}`}
                                className="mt-2 flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-white p-3 transition hover:border-brand hover:bg-brand-soft/30"
                              >
                                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                                  <ImagePlus size={19} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold">
                                    {resolutionProofs[complaintId]?.name ??
                                      "Choose a resolution photo"}
                                  </span>
                                  <span className="mt-1 block text-xs text-muted">
                                    Add a photo showing the completed repair
                                  </span>
                                </span>
                              </label>

                              <input
                                id={`resolution-proof-${complaintId}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  setResolutionProofs((current) => ({
                                    ...current,
                                    [complaintId]: file,
                                  }));
                                }}
                              />
                            </div>
                          )}

                          {actionError[complaintId] && (
                            <p
                              role="alert"
                              className="mt-2 text-sm text-rose-700"
                            >
                              {actionError[complaintId]}
                            </p>
                          )}

                          {successMessage[complaintId] && (
                            <p
                              role="status"
                              className="mt-2 text-sm text-emerald-700"
                            >
                              {successMessage[complaintId]}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving && (
                              <LoaderCircle
                                size={16}
                                className="animate-spin"
                              />
                            )}
                            {selectedStatus === "Resolved"
                              ? "Resolve complaint"
                              : "Save update"}
                          </button>
                        </div>

  );
}
