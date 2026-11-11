import { useState, useRef, useEffect } from "react";
import { AlertTriangle, Camera, ImagePlus, LoaderCircle, Mic, MicOff, Sparkles, Wand2, X } from "lucide-react";
import { suggestStatusNoteRequest, formatStaffVoiceNoteRequest } from "../../services/api.js";
import { validateImageFile } from "../../utils/fileValidation.js";

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
  const [fileValidationError, setFileValidationError] = useState("");
  const [listening, setListening] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const recognitionRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedProofFile = resolutionProofs[complaintId] ?? null;

  useEffect(() => {
    if (!selectedProofFile || typeof window === "undefined" || !window.URL?.createObjectURL) {
      setPreviewUrl(null);
      return;
    }

    try {
      const url = window.URL.createObjectURL(selectedProofFile);
      setPreviewUrl(url);
      return () => {
        window.URL.revokeObjectURL(url);
      };
    } catch {
      setPreviewUrl(null);
    }
  }, [selectedProofFile]);

  function handleProofFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setFileValidationError("");
    if (file) {
      const check = validateImageFile(file);
      if (!check.valid) {
        event.target.value = "";
        setFileValidationError(check.error);
        setResolutionProofs((current) => ({
          ...current,
          [complaintId]: null,
        }));
        return;
      }
    }
    setResolutionProofs((current) => ({
      ...current,
      [complaintId]: file,
    }));
  }

  function handleClearProof() {
    setResolutionProofs((current) => ({
      ...current,
      [complaintId]: null,
    }));
    setFileValidationError("");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (isResolved) return null;

  function toggleVoiceNote() {
    const SpeechRecognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      setVoiceError("Voice dictation is not supported by this browser.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setListening(true);
        setVoiceError("");
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((res) => res[0].transcript)
          .join("");
        if (transcript) {
          setNotes((current) => ({
            ...current,
            [complaintId]: transcript,
          }));
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech") {
          setVoiceError(`Voice input error: ${event.error}`);
        }
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognition.start();
    } catch {
      setVoiceError("Could not start microphone.");
      setListening(false);
    }
  }

  async function polishVoiceNote() {
    const currentNote = notes[complaintId] ?? "";
    if (!currentNote.trim()) return;

    setPolishing(true);
    setVoiceError("");
    try {
      const res = await formatStaffVoiceNoteRequest(
        { utterance: currentNote, status: selectedStatus, complaintTitle },
        accessToken,
      );
      if (res.formattedNote) {
        setNotes((current) => ({
          ...current,
          [complaintId]: res.formattedNote,
        }));
      }
    } catch (err) {
      setVoiceError(err.message || "Could not polish note with AI.");
    } finally {
      setPolishing(false);
    }
  }

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

                          <div className="mt-4 space-y-2">
                            <label htmlFor={`note-${complaintId}`} className="block text-sm font-semibold text-ink">
                              {selectedStatus === "Resolved"
                                ? "Resolution note (required)"
                                : selectedStatus === "On_Hold"
                                  ? "Note (required)"
                                  : "Note (optional)"}
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={toggleVoiceNote}
                                title={listening ? "Stop recording" : "Dictate status note by voice"}
                                className={`inline-flex min-h-7.5 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                                  listening
                                    ? "border-rose-400 bg-rose-100 text-rose-700 animate-pulse"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-stone-100"
                                }`}
                              >
                                {listening ? <MicOff size={13} className="text-rose-600" /> : <Mic size={13} className="text-brand" />}
                                {listening ? "Listening…" : "Voice"}
                              </button>

                              {notes[complaintId]?.trim() && (
                                <button
                                  type="button"
                                  onClick={polishVoiceNote}
                                  disabled={polishing}
                                  title="Format informal or spoken note into professional status update"
                                  className="inline-flex min-h-7.5 items-center gap-1 rounded-lg border border-brand/20 bg-brand-soft/60 px-2 py-1 text-xs font-bold text-brand-dark hover:bg-brand-soft disabled:opacity-60 cursor-pointer"
                                >
                                  {polishing ? <LoaderCircle size={13} className="animate-spin" /> : <Wand2 size={13} />}
                                  {polishing ? "Polishing…" : "Polish AI"}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={suggestNote}
                                disabled={suggesting}
                                title="Draft note with AI"
                                className="inline-flex min-h-7.5 items-center gap-1 rounded-lg border border-brand/20 bg-brand-soft/60 px-2.5 py-1 text-xs font-bold text-brand-dark hover:bg-brand-soft disabled:opacity-60 cursor-pointer"
                              >
                                {suggesting ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                {suggesting ? "Drafting…" : "Draft note"}
                              </button>
                            </div>
                          </div>
                          {voiceError && (
                            <p className="mt-1 text-xs text-rose-600 font-medium">
                              {voiceError}
                            </p>
                          )}

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
                              <div className="flex items-center justify-between">
                                <label className="block text-sm font-semibold text-ink">
                                  Resolution photo (required)
                                </label>
                                <span className="text-[11px] text-muted">
                                  Max 5 MB · JPG, PNG, WebP
                                </span>
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <label
                                  htmlFor={`resolution-camera-${complaintId}`}
                                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand-soft/70 px-3 py-2 text-xs font-bold text-brand-dark transition hover:bg-brand-soft active:scale-98 shadow-2xs"
                                >
                                  <Camera size={16} className="text-brand shrink-0" />
                                  <span>Open Camera</span>
                                </label>

                                <label
                                  htmlFor={`resolution-proof-${complaintId}`}
                                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink transition hover:border-brand/40 hover:bg-stone-50 active:scale-98 shadow-2xs"
                                >
                                  <ImagePlus size={16} className="text-slate-600 shrink-0" />
                                  <span>Upload Photo</span>
                                </label>
                              </div>

                              <input
                                ref={cameraInputRef}
                                id={`resolution-camera-${complaintId}`}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="sr-only"
                                onChange={handleProofFileChange}
                              />

                              <input
                                ref={fileInputRef}
                                id={`resolution-proof-${complaintId}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={handleProofFileChange}
                              />

                              {selectedProofFile ? (
                                <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-brand/20 bg-white p-2.5 shadow-2xs">
                                  {previewUrl ? (
                                    <img
                                      src={previewUrl}
                                      alt="Resolution proof preview"
                                      className="size-13 rounded-lg object-cover border border-line shrink-0"
                                    />
                                  ) : (
                                    <div className="grid size-13 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                                      <ImagePlus size={20} />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-ink">
                                      {selectedProofFile.name}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted">
                                      {(selectedProofFile.size / (1024 * 1024)).toFixed(2)} MB · Ready for AI verification
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleClearProof}
                                    className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rose-600 cursor-pointer"
                                    title="Remove photo"
                                    aria-label="Remove photo"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-1.5 text-xs text-muted">
                                  Use <strong>Open Camera</strong> on mobile to snap the repaired asset, or <strong>Upload Photo</strong> from gallery.
                                </p>
                              )}

                              {fileValidationError && (
                                <p role="alert" className="mt-2 text-xs text-rose-700">
                                  {fileValidationError}
                                </p>
                              )}
                            </div>
                          )}

                          {actionError[complaintId] && (() => {
                            const rawErr = actionError[complaintId];
                            const errMsg = typeof rawErr === "object" ? rawErr?.message : String(rawErr || "");
                            const isMismatch =
                              rawErr?.verification?.verdict === "MISMATCH" ||
                              /resolution photo does not match|mismatch/i.test(errMsg);
                            const reasons = rawErr?.verification?.reasons || [];

                            if (isMismatch) {
                              return (
                                <div
                                  role="alert"
                                  className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-950"
                                >
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
                                    <div className="min-w-0 text-sm">
                                      <p className="font-bold text-rose-900">
                                        Resolution photo does not match the reported issue
                                      </p>
                                      <p className="mt-1 text-xs text-rose-800">
                                        Upload a clearer photo of the same asset to verify repair completion.
                                      </p>
                                      {reasons.length > 0 && (
                                        <ul className="mt-2 list-disc pl-4 text-xs space-y-1 text-rose-900 font-medium">
                                          {reasons.map((r, idx) => (
                                            <li key={idx}>{r}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <p role="alert" className="mt-2 text-sm text-rose-700">
                                {errMsg}
                              </p>
                            );
                          })()}

                          {successMessage[complaintId] && (
                            <p
                              role="status"
                              className="mt-2 text-sm text-emerald-700"
                            >
                              {successMessage[complaintId]}
                            </p>
                          )}

                          {isSaving && selectedStatus === "Resolved" && (
                            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-brand-soft/50 px-3 py-1.5 text-xs font-semibold text-brand-dark animate-pulse">
                              <Sparkles size={14} className="animate-spin text-brand" />
                              <span>AI check running… verifying resolution proof photo</span>
                            </div>
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
                              ? isSaving ? "Verifying resolution…" : "Resolve complaint"
                              : isSaving ? "Saving…" : "Save update"}
                          </button>
                        </div>

  );
}
