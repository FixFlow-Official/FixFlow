import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileImage, LoaderCircle, Plus, Send, Sparkles, Upload } from "lucide-react";
import ComplaintAiTriage from "../../components/complaints/ComplaintAiTriage.jsx";
import {
  getCampusBlocksRequest,
  previewComplaintTriageRequest,
  suggestComplaintDescriptionRequest,
} from "../../services/api.js";

// Student complaint submission UI. State, validation, and API requests stay in DashboardPage.
export default function StudentComplaintForm({
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
  building,
  setBuilding,
  floor = "Ground Floor",
  setFloor,
  room,
  setRoom,
  image,
  handleImageChange,
  formError,
  successMessage,
  submissionTriage,
  confirmedCampusIssue,
  setConfirmedCampusIssue,
  triagePreview,
  setTriagePreview,
  accessToken,
  submitting,
  handleSubmit,
}) {
  const [draftSuggestion, setDraftSuggestion] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState("");
  const triageRequestId = useRef(0);
  const [campusBlocks, setCampusBlocks] = useState([]);
  const [customBuilding, setCustomBuilding] = useState(false);
  const [customRoom, setCustomRoom] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadBlocks() {
      try {
        const res = await getCampusBlocksRequest(accessToken);
        if (active && res.blocks?.length) {
          setCampusBlocks(res.blocks);
        }
      } catch {
        // Fallback to text input if offline or API unavailable
      }
    }
    loadBlocks();
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    const requestId = ++triageRequestId.current;
    if (title.trim().length < 5 || description.trim().length < 30 || !category) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setTriageLoading(true);
      try {
        const result = await previewComplaintTriageRequest({
          title: title.trim(),
          description: description.trim(),
          category,
          building: building.trim(),
        }, accessToken);
        if (triageRequestId.current === requestId) setTriagePreview(result);
      } catch (error) {
        if (triageRequestId.current === requestId) {
          setTriagePreview(null);
          setTriageError(error.message || "Could not assess this draft yet.");
        }
      } finally {
        if (triageRequestId.current === requestId) setTriageLoading(false);
      }
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [title, description, category, building, accessToken, setTriagePreview]);

  function invalidateTriagePreview() {
    triageRequestId.current += 1;
    setTriagePreview(null);
    setTriageLoading(false);
    setTriageError("");
    setConfirmedCampusIssue(false);
  }

  async function requestDescriptionDraft() {
    if (title.trim().length < 5 || draftLoading) return;
    setDraftLoading(true);
    setDraftError("");
    setDraftSuggestion(null);
    try {
      setDraftSuggestion(await suggestComplaintDescriptionRequest({ title: title.trim(), category }, accessToken));
    } catch (error) {
      setDraftError(error.message || "Could not suggest a description. Please try again.");
    } finally {
      setDraftLoading(false);
    }
  }

  const selectedBlockObj = campusBlocks.find(
    (b) => b.name === building || b.shortName === building || b.code === building,
  );
  const availableFloors = selectedBlockObj?.floors?.length
    ? selectedBlockObj.floors
    : [{ name: "Ground Floor", rooms: [] }];
  const selectedFloorObj =
    availableFloors.find((f) => f.name === floor) || availableFloors[0];
  const suggestedRooms = selectedFloorObj?.rooms || [];

  return (
            <section className="w-full rounded-3xl border border-white/90 bg-white/95 p-4 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 sm:rounded-[1.75rem] sm:p-6 lg:p-8">
              <div className="mb-6 flex items-start gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Plus size={21} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Submit a complaint
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    As you write, AI can suggest a category, priority, and useful missing details. Staff review every complaint and make the final decision.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(event) => handleSubmit(event, confirmedCampusIssue)}
                className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2"
              >
                <div className="min-w-0">
                  <label
                    htmlFor="complaint-title"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Complaint title
                  </label>
                  <input
                    id="complaint-title"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setDraftSuggestion(null);
                      invalidateTriagePreview();
                    }}
                    maxLength={100}
                    required
                    placeholder="For example, Projector not working in Room 204"
                    className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                  <p className="mt-1.5 text-right text-xs text-muted">
                    {title.length}/100
                  </p>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="complaint-category"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Category
                  </label>
                  <select
                    id="complaint-category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setDraftSuggestion(null);
                      invalidateTriagePreview();
                    }}
                    required
                    className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                  >
                    <option value="">Choose a category</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Internet">Internet</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="min-w-0 sm:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="complaint-description" className="block text-sm font-semibold">Description</label>
                    <button type="button" onClick={requestDescriptionDraft} disabled={title.trim().length < 5 || draftLoading} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand/20 bg-brand-soft/60 px-3 text-xs font-bold text-brand-dark transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50">
                      {draftLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {draftLoading ? "Drafting…" : "Suggest with AI"}
                    </button>
                  </div>
                  <textarea
                    id="complaint-description"
                    value={description}
                    onChange={(event) => { setDescription(event.target.value); invalidateTriagePreview(); }}
                    maxLength={2000}
                    rows={5}
                    required
                    placeholder="Where is the issue, and what happened?"
                    className="w-full min-w-0 resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                      <p className="mt-1 text-xs text-muted">Description drafts use your title and category. Draft triage checks the title, description, category, and building for suggestions; avoid including personal information.</p>
                  {draftError && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{draftError}</p>}
                  {draftSuggestion && (
                    <div className="mt-3 rounded-xl border border-brand/15 bg-gradient-to-br from-brand-soft/60 to-white p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{draftSuggestion.source === "gemini" ? "AI draft suggestion" : "Starter draft suggestion"}</p>
                        <button type="button" onClick={() => { setDescription(draftSuggestion.description); setDraftSuggestion(null); }} className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-dark">Use this draft</button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{draftSuggestion.description}</p>
                      <p className="mt-2 text-[11px] text-muted">This is only a starting point. Replace bracketed prompts with what actually happened.</p>
                    </div>
                  )}
                  {triageLoading && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-muted"><LoaderCircle size={14} className="animate-spin" /> Reviewing this draft…</p>}
                  {triageError && <p role="status" className="mt-3 text-xs text-muted">Draft suggestions are temporarily unavailable. You can still submit your complaint.</p>}
                  {!successMessage && triagePreview?.triage && <div className="mt-3"><ComplaintAiTriage triage={triagePreview.triage} /></div>}
                  <p className="mt-1.5 text-right text-xs text-muted">
                    {description.length}/2000
                  </p>
                </div>

                {/* Campus Building, Floor & Room Selection */}
                <div className="min-w-0 sm:col-span-2 grid gap-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="complaint-building"
                        className="block text-sm font-semibold"
                      >
                        Building
                      </label>
                      {campusBlocks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomBuilding(!customBuilding);
                            if (customBuilding) setBuilding("");
                          }}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          {customBuilding ? "Choose from list" : "Other"}
                        </button>
                      )}
                    </div>

                    {!customBuilding && campusBlocks.length > 0 ? (
                      <select
                        id="complaint-building"
                        value={building}
                        onChange={(event) => {
                          const val = event.target.value;
                          if (val === "__custom__") {
                            setCustomBuilding(true);
                            setBuilding("");
                          } else {
                            setBuilding(val);
                            const found = campusBlocks.find((b) => b.name === val);
                            if (found?.floors?.length && setFloor) {
                              setFloor(found.floors[0].name);
                            }
                          }
                          invalidateTriagePreview();
                        }}
                        required
                        className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                      >
                        <option value="">Select campus building</option>
                        {campusBlocks.map((b) => (
                          <option key={b._id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Other / Not listed</option>
                      </select>
                    ) : (
                      <input
                        id="complaint-building"
                        value={building}
                        onChange={(event) => {
                          setBuilding(event.target.value);
                          invalidateTriagePreview();
                        }}
                        maxLength={100}
                        required
                        placeholder="e.g. Commerce Block or Canteen"
                        className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="complaint-floor"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Floor
                    </label>
                    <select
                      id="complaint-floor"
                      value={floor}
                      onChange={(event) => {
                        if (setFloor) setFloor(event.target.value);
                      }}
                      className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                    >
                      {availableFloors.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="complaint-room"
                        className="block text-sm font-semibold"
                      >
                        Room / Facility
                      </label>
                      {suggestedRooms.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomRoom(!customRoom);
                            setRoom("");
                          }}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          {customRoom ? "Select from list" : "Other"}
                        </button>
                      )}
                    </div>

                    {!customRoom && suggestedRooms.length > 0 ? (
                      <select
                        id="complaint-room"
                        value={room}
                        onChange={(event) => {
                          const val = event.target.value;
                          if (val === "__custom__") {
                            setCustomRoom(true);
                            setRoom("");
                          } else {
                            setRoom(val);
                          }
                        }}
                        className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                      >
                        <option value="">Select room or lab</option>
                        {suggestedRooms.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        <option value="__custom__">+ Other / Not in list</option>
                      </select>
                    ) : (
                      <input
                        id="complaint-room"
                        value={room}
                        onChange={(event) => setRoom(event.target.value)}
                        maxLength={30}
                        placeholder="e.g. Washroom or Corridor"
                        className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                      />
                    )}
                  </div>
                </div>

                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="complaint-image"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Add a photo{" "}
                    <span className="text-rose-600">(required proof)</span>
                  </label>

                  <label
                    htmlFor="complaint-image"
                    className="group flex min-h-24 min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line bg-gradient-to-br from-canvas to-white px-3 py-4 transition hover:border-brand/50 hover:from-brand-soft/60 sm:gap-4 sm:px-4"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm">
                      {image ? <FileImage size={20} /> : <Upload size={20} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-all text-sm font-semibold">
                        {image?.name || "Choose an image to attach"}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        JPG, PNG, or WebP · up to 5 MB
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold shadow-sm">
                      Browse
                    </span>
                  </label>

                  <input
                    id="complaint-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="flex min-w-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 sm:col-span-2"
                  >
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </p>
                )}

                {triagePreview?.triage?.reviewSignal === "check_relevance" && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950 sm:col-span-2">
                    <input type="checkbox" required checked={confirmedCampusIssue} onChange={(event) => setConfirmedCampusIssue(event.target.checked)} className="mt-1 size-4 accent-amber-700" />
                    <span><strong>Confirm for staff review:</strong> I’m reporting an actual campus issue. The AI cannot verify whether something is true; this confirmation lets staff review a draft the AI could not classify clearly. Safety reports remain submitable.</span>
                  </label>
                )}

                {successMessage && (
                  <div className="space-y-3 sm:col-span-2">
                    <p role="status" className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                      <span>{successMessage}</span>
                    </p>
                    <ComplaintAiTriage triage={submissionTriage} />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-48"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle size={17} className="animate-spin" />
                        Submitting · reviewing…
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Submit complaint
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
  );
}
