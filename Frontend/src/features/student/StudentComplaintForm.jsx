import { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Camera, CheckCircle2, FileImage, LoaderCircle, Plus, QrCode, Send, Sparkles, ThumbsUp, Upload, X } from "lucide-react";
import ComplaintStatusBadge from "../../components/complaints/ComplaintStatusBadge.jsx";
import {
  getCampusBlocksRequest,
  getSimilarComplaintsRequest,
  suggestComplaintDescriptionRequest,
  upvoteComplaintRequest,
  diagnoseComplaintImageRequest,
  getBroadcastMatchRequest,
} from "../../services/api.js";

// Student complaint submission UI with AI duplicate protection and clean submission flow.
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
  setImage,
  handleImageChange,
  formError,
  successMessage,
  accessToken,
  submitting,
  handleSubmit,
  qrPrefilled = false,
  onOpenQrScanner,
  onOpenBroadcasts,
}) {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [image]);

  function handleClearImage(e) {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (typeof setImage === "function") {
      setImage(null);
    }
    setDiagnosisInfo(null);
    setDiagnosisError("");
  }

  const [draftSuggestion, setDraftSuggestion] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [campusBlocks, setCampusBlocks] = useState([]);
  const [customBuilding, setCustomBuilding] = useState(false);
  const [customRoom, setCustomRoom] = useState(false);

  // Duplicate detection on Submit
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [topDuplicate, setTopDuplicate] = useState(null);
  const [topReason, setTopReason] = useState("");
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [upvotingId, setUpvotingId] = useState(null);
  const [upvoteMessage, setUpvoteMessage] = useState("");
  const [clientValidationError, setClientValidationError] = useState("");
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisInfo, setDiagnosisInfo] = useState(null);
  const [diagnosisError, setDiagnosisError] = useState("");

  // Outage Broadcast Intercept State
  const [broadcastMatch, setBroadcastMatch] = useState(null);
  const [checkingBroadcast, setCheckingBroadcast] = useState(false);
  const [broadcastDismissed, setBroadcastDismissed] = useState(false);

  useEffect(() => {
    setBroadcastDismissed(false);
    if (!category || !building?.trim() || !accessToken) {
      setBroadcastMatch(null);
      return;
    }

    let isMounted = true;
    async function checkOutage() {
      setCheckingBroadcast(true);
      try {
        const res = await getBroadcastMatchRequest(
          { category, building: building.trim() },
          accessToken,
        );
        if (isMounted) {
          if (res?.matched && res?.match) {
            setBroadcastMatch(res.match);
          } else {
            setBroadcastMatch(null);
          }
        }
      } catch {
        if (isMounted) setBroadcastMatch(null);
      } finally {
        if (isMounted) setCheckingBroadcast(false);
      }
    }

    checkOutage();
    return () => {
      isMounted = false;
    };
  }, [category, building, accessToken]);

  async function handleAiDiagnose() {
    if (!image) return;
    setDiagnosing(true);
    setDiagnosisError("");
    try {
      const res = await diagnoseComplaintImageRequest(image, accessToken);
      if (res.diagnosis) {
        setDiagnosisInfo(res.diagnosis);
        if (res.diagnosis.title && (!title || title.length < 5)) {
          setTitle(res.diagnosis.title);
        }
        if (res.diagnosis.category) {
          setCategory(res.diagnosis.category);
        }
        if (res.diagnosis.description && (!description || description.length < 20)) {
          setDescription(res.diagnosis.description);
        }
      }
    } catch (err) {
      setDiagnosisError(err.message || "Could not analyze the photo with AI.");
    } finally {
      setDiagnosing(false);
    }
  }

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

  async function handleUpvote(complaintId) {
    if (upvotingId) return;
    setUpvotingId(complaintId);
    setUpvoteMessage("");
    try {
      const res = await upvoteComplaintRequest(complaintId, accessToken);
      setTopDuplicate((prev) =>
        prev && prev._id === complaintId
          ? {
              ...prev,
              hasUpvoted: res.upvoted,
              upvoteCount: res.upvoteCount,
            }
          : prev,
      );
      if (res.upvoted) {
        setUpvoteMessage(
          "Issue upvoted (+1 Me Too)! You will be notified automatically when staff resolves it.",
        );
      } else {
        setUpvoteMessage("Upvote removed.");
      }
    } catch (error) {
      setUpvoteMessage(error.message || "Could not upvote complaint.");
    } finally {
      setUpvotingId(null);
    }
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    setClientValidationError("");
    setUpvoteMessage("");

    if (!title.trim() || !category || !description.trim() || !building.trim() || !image) {
      setClientValidationError("Complete all required fields and attach a photo as proof.");
      return;
    }

    // If student explicitly unlocked submission as a separate issue:
    if (overrideDuplicate) {
      await handleSubmit(event, true, true);
      return;
    }

    // 1st: Check if a duplicate already exists before creating a new ticket
    setCheckingDuplicate(true);
    try {
      const res = await getSimilarComplaintsRequest(
        {
          building: building.trim(),
          floor: floor?.trim(),
          room: room?.trim(),
          category: category?.trim(),
          title: title.trim(),
          description: description.trim(),
        },
        accessToken,
      );

      // If an actual duplicate is detected: STOP and display it, replace submit with Upvote!
      if (res.isDuplicate && res.topDuplicate) {
        setTopDuplicate(res.topDuplicate);
        setTopReason(res.topReason || "");
        setCheckingDuplicate(false);
        return;
      }
    } catch {
      // If network pre-check fails, allow direct submit and let server validate
    } finally {
      setCheckingDuplicate(false);
    }

    // 1st: If NO duplicate detected -> DIRECT SUBMIT!
    await handleSubmit(event, true, false);
  }

  async function handleOverrideAndSubmit(event) {
    setOverrideDuplicate(true);
    await handleSubmit(event, true, true);
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
            Report facility issues on campus. Campus staff review and respond to every complaint.
          </p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleFormSubmit(e);
        }}
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
              setTopDuplicate(null);
              setOverrideDuplicate(false);
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
              setTopDuplicate(null);
              setOverrideDuplicate(false);
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
            onChange={(event) => {
              setDescription(event.target.value);
              setTopDuplicate(null);
              setOverrideDuplicate(false);
            }}
            maxLength={2000}
            rows={5}
            required
            placeholder="Where is the issue, and what happened?"
            className="w-full min-w-0 resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
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
          <p className="mt-1.5 text-right text-xs text-muted">
            {description.length}/2000
          </p>
        </div>

        {/* Campus Building, Floor & Room Selection */}
        {qrPrefilled && (
          <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                ✓
              </span>
              <div>
                <p className="font-bold">Location Auto-Filled via Door QR Code</p>
                <p className="text-xs text-emerald-800">
                  {building || "Campus"} · {floor || "Ground Floor"} · Room {room || "Selected"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-200/90 px-2.5 py-0.5 text-[11px] font-bold text-emerald-950">
              Door Verified
            </span>
          </div>
        )}

        <div className="min-w-0 sm:col-span-2 grid gap-3 sm:grid-cols-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="complaint-building"
                className="block text-sm font-semibold"
              >
                Building
              </label>
              <div className="flex items-center gap-2">
                {onOpenQrScanner && (
                  <button
                    type="button"
                    onClick={onOpenQrScanner}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                    title="Scan Classroom Door QR Code"
                  >
                    <QrCode size={12} /> Scan QR
                  </button>
                )}
                {campusBlocks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBuilding(!customBuilding);
                      if (customBuilding) setBuilding("");
                      setTopDuplicate(null);
                      setOverrideDuplicate(false);
                    }}
                    className="text-[11px] font-semibold text-brand hover:underline"
                  >
                    {customBuilding ? "Choose from list" : "Other"}
                  </button>
                )}
              </div>
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
                  setTopDuplicate(null);
                  setOverrideDuplicate(false);
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
                  setTopDuplicate(null);
                  setOverrideDuplicate(false);
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
                setTopDuplicate(null);
                setOverrideDuplicate(false);
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
                    setTopDuplicate(null);
                    setOverrideDuplicate(false);
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
                  setTopDuplicate(null);
                  setOverrideDuplicate(false);
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
                onChange={(event) => {
                  setRoom(event.target.value);
                  setTopDuplicate(null);
                  setOverrideDuplicate(false);
                }}
                maxLength={30}
                placeholder="e.g. Washroom or Corridor"
                className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            )}
          </div>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="block text-sm font-semibold text-ink">
              Add a photo{" "}
              <span className="text-rose-600">(required proof)</span>
            </span>
            <span className="text-xs text-muted">
              JPG, PNG, or WebP · up to 5 MB
            </span>
          </div>

          {/* When NO image is attached yet */}
          {!image && (
            <>
              {/* Mobile Camera & Upload options */}
              <div className="mb-2.5 grid grid-cols-2 gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand-soft/70 px-3 py-2 text-xs font-bold text-brand-dark transition hover:bg-brand-soft active:scale-98 shadow-2xs"
                >
                  <Camera size={16} className="text-brand shrink-0" />
                  <span>Click Photo</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink transition hover:border-brand/40 hover:bg-stone-50 active:scale-98 shadow-2xs"
                >
                  <Upload size={16} className="text-slate-600 shrink-0" />
                  <span>Upload Photo</span>
                </button>
              </div>

              {/* Desktop File Picker Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="group hidden sm:flex min-h-24 min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line bg-gradient-to-br from-canvas to-white px-3 py-4 transition hover:border-brand/50 hover:from-brand-soft/60 sm:gap-4 sm:px-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm">
                  <Upload size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    Choose an image to attach
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    Click to browse files from your device
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold shadow-sm">
                  Browse
                </span>
              </div>
            </>
          )}

          {/* Selected File Preview with thumbnail & clear/retake buttons */}
          {image && (
            <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-brand/25 bg-brand-soft/30 p-2.5 shadow-2xs overflow-hidden">
              <div className="flex flex-1 min-w-0 items-center gap-2.5 overflow-hidden">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Proof preview"
                    className="size-12 rounded-xl object-cover border border-brand/20 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <FileImage size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs font-bold text-ink">
                    {image.name}
                  </p>
                  <p className="text-[11px] text-muted">
                    {(image.size / (1024 * 1024)).toFixed(2)} MB · Photo ready
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="flex sm:hidden size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-brand transition cursor-pointer"
                  title="Retake photo"
                  aria-label="Retake photo"
                >
                  <Camera size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="hidden sm:flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-brand transition cursor-pointer"
                  title="Change photo"
                  aria-label="Change photo"
                >
                  <Upload size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="flex size-8 items-center justify-center rounded-lg text-stone-400 hover:bg-white hover:text-rose-600 transition cursor-pointer"
                  title="Remove photo"
                  aria-label="Remove photo"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <input
            ref={cameraInputRef}
            id="complaint-camera"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="fixed -top-[1000px] -left-[1000px] size-px opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />

          <input
            ref={fileInputRef}
            id="complaint-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleImageChange}
            className="fixed -top-[1000px] -left-[1000px] size-px opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />

          {image && (
            <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-2xl border border-brand/20 bg-brand-soft/40 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles size={16} className="text-brand shrink-0" />
                <span className="text-xs font-semibold text-ink truncate sm:whitespace-normal">
                  {diagnosisInfo ? "Photo diagnosed by Gemini Vision" : "Have Gemini Vision diagnose this photo?"}
                </span>
              </div>
              <button
                type="button"
                disabled={diagnosing}
                onClick={handleAiDiagnose}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 sm:py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-50 cursor-pointer shrink-0"
              >
                {diagnosing ? (
                  <>
                    <LoaderCircle size={13} className="animate-spin" />
                    Analyzing photo…
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    {diagnosisInfo ? "Re-diagnose photo" : "✨ AI Diagnose & Auto-fill"}
                  </>
                )}
              </button>
            </div>
          )}

          {diagnosisError && (
            <p className="mt-2 text-xs text-rose-600 font-medium break-words">
              {diagnosisError}
            </p>
          )}

          {diagnosisInfo && (
            <div className="mt-2.5 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3 text-xs text-emerald-950">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 font-bold">
                <span className="flex items-start gap-1.5 text-emerald-800 min-w-0">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="break-words">Gemini Vision: {diagnosisInfo.title}</span>
                </span>
                <span className="self-start shrink-0 rounded-md bg-emerald-200/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900 border border-emerald-300">
                  {diagnosisInfo.severity} Severity
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-emerald-900/90 leading-relaxed">
                Category set to <strong>{diagnosisInfo.category}</strong>. You can adjust details before submitting.
              </p>
              {diagnosisInfo.safetyWarning && (
                <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-amber-900 font-semibold text-xs break-words">
                  ⚠️ Safety Hazard: {diagnosisInfo.safetyWarning}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Active Campus Outage Broadcast Intercept Box */}
        {broadcastMatch && !broadcastDismissed && (
          <div
            id="broadcast-outage-intercept"
            className="min-w-0 sm:col-span-2 rounded-2xl border border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-100/50 p-4 shadow-sm ring-2 ring-amber-300/80"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-600 text-white shadow-xs">
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-amber-950 sm:text-base">
                    ⚠️ Active Scheduled Outage in {building || "this area"}
                  </h3>
                  <span className="rounded-full border border-amber-400 bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-950">
                    Known Campus Outage
                  </span>
                </div>

                <p className="mt-1 text-xs leading-relaxed text-amber-950">
                  A scheduled outage is currently underway for this area until{" "}
                  <strong className="font-semibold text-amber-950">
                    {new Date(broadcastMatch.endsAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </strong>{" "}
                  — <span className="font-semibold">{broadcastMatch.title}</span>. You can still submit, or upvote the existing report instead.
                </p>

                <div className="mt-2.5 rounded-xl border border-amber-200/90 bg-white/95 p-3 text-xs text-muted shadow-xs">
                  <p className="font-medium text-ink">{broadcastMatch.message}</p>
                  <p className="mt-1 text-[11px] text-amber-800">
                    Category: <strong>{broadcastMatch.category}</strong> · Expected resolution:{" "}
                    <strong>
                      {new Date(broadcastMatch.endsAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </strong>
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof onOpenBroadcasts === "function") {
                        onOpenBroadcasts();
                      } else {
                        window.dispatchEvent(new CustomEvent("fixflow:open-broadcasts"));
                      }
                    }}
                    className="rounded-xl border border-amber-400 bg-amber-100/90 px-3.5 py-1.5 text-xs font-semibold text-amber-950 shadow-xs hover:bg-amber-200 transition-colors"
                  >
                    View campus outages →
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const dupElem = document.getElementById("duplicate-section");
                      if (dupElem) {
                        dupElem.scrollIntoView({ behavior: "smooth" });
                      } else {
                        window.scrollTo({ top: 400, behavior: "smooth" });
                      }
                    }}
                    className="rounded-xl border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-950 shadow-xs hover:bg-amber-50 transition-colors"
                  >
                    View existing report
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastDismissed(true)}
                    className="rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-800 transition-colors"
                  >
                    Submit anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Issue Alert — Only shown after clicking submit if a duplicate was detected */}
        {topDuplicate && !overrideDuplicate && (
          <div className="min-w-0 sm:col-span-2 rounded-2xl border border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-100/40 p-4 shadow-sm ring-2 ring-amber-300/70">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-600 text-white shadow-xs">
                <ThumbsUp size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-amber-950 sm:text-base">
                    ⚠️ Matching Issue Already Open in {building || "this facility"}
                  </h3>
                  <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-950 border border-amber-400/80">
                    AI Duplicate Detected
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/95">
                  Our system analyzed active reports and found an open complaint matching your issue{topReason ? ` (${topReason})` : ""}. Instead of creating a duplicate ticket, upvote this issue below to boost its priority and receive resolution alerts!
                </p>

                {upvoteMessage && (
                  <div role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300 bg-white/90 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    <span>{upvoteMessage}</span>
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-amber-200/90 bg-white/95 p-3.5 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-bold text-ink">
                      {topDuplicate.title}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                      {topDuplicate.category}
                    </span>
                    <ComplaintStatusBadge status={topDuplicate.status} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                    {topDuplicate.description || "No description provided."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span>📍 {[topDuplicate.location?.building, topDuplicate.location?.floor, topDuplicate.location?.room].filter(Boolean).join(" · ")}</span>
                    <span>•</span>
                    <span className="font-semibold text-amber-950">👍 {topDuplicate.upvoteCount || 0} student{topDuplicate.upvoteCount === 1 ? "" : "s"} backed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {clientValidationError && (
          <p
            role="alert"
            className="flex min-w-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 sm:col-span-2"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{clientValidationError}</span>
          </p>
        )}

        {formError && (
          <p
            role="alert"
            className="flex min-w-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 sm:col-span-2"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{formError}</span>
          </p>
        )}

        {successMessage && (
          <p role="status" className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 sm:col-span-2">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>{successMessage}</span>
          </p>
        )}

        <div className="sm:col-span-2">
          {topDuplicate && !overrideDuplicate ? (
            <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 p-4 shadow-sm ring-1 ring-emerald-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                    <CheckCircle2 size={12} className="text-emerald-700" />
                    Duplicate Prevention Active
                  </span>
                  <h4 className="mt-1 text-sm font-bold text-ink sm:text-base">
                    Back existing issue &ldquo;{topDuplicate.title}&rdquo;
                  </h4>
                  <p className="mt-0.5 text-xs text-muted">
                    Instead of creating a duplicate ticket, upvoting immediately increases its priority and notifies you when staff resolves it.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                  {topDuplicate.isOwner ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-stone-200 px-5 text-sm font-bold text-stone-600 shadow-xs cursor-not-allowed"
                    >
                      You Reported This Issue ({topDuplicate.upvoteCount || 0} upvotes)
                    </button>
                  ) : topDuplicate.hasUpvoted ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-5 text-sm font-bold text-emerald-900 shadow-xs cursor-default"
                    >
                      <CheckCircle2 size={16} className="text-emerald-700" />
                      Already Upvoted (+1 Recorded · {topDuplicate.upvoteCount || 0})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUpvote(topDuplicate._id)}
                      disabled={upvotingId === topDuplicate._id}
                      className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-6 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70"
                    >
                      {upvotingId === topDuplicate._id ? (
                        <LoaderCircle size={17} className="animate-spin" />
                      ) : (
                        <ThumbsUp size={16} className="fill-white" />
                      )}
                      <span>Upvote Issue (+1 Me Too · {topDuplicate.upvoteCount || 0})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOverrideAndSubmit}
                    className="text-xs font-semibold text-stone-600 hover:text-ink underline"
                  >
                    Different issue? Submit as separate report
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={submitting || checkingDuplicate}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-48"
              >
                {submitting || checkingDuplicate ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    {checkingDuplicate ? "Checking for duplicates…" : "Submitting…"}
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit complaint
                  </>
                )}
              </button>

              {overrideDuplicate && (
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                  ⚠️ Duplicate override enabled: Submitting as separate report.
                </span>
              )}
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
