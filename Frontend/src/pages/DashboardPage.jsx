import { useEffect, useState } from "react";
import DashboardShell from "../components/DashboardShell.jsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileImage,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Send,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createComplaintRequest,
  getComplaintsRequest,
} from "../services/api.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const activeComplaintStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
];

const statusStyles = {
  Submitted: "bg-sky-50 text-sky-700",
  Under_Review: "bg-amber-50 text-amber-800",
  Assigned: "bg-indigo-50 text-indigo-700",
  In_Progress: "bg-violet-50 text-violet-700",
  On_Hold: "bg-orange-50 text-orange-800",
  Rejected: "bg-rose-50 text-rose-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-slate-100 text-slate-700",
  Withdrawn: "bg-slate-100 text-slate-700",
};

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatStatus(status) {
  return (status || "Submitted").replaceAll("_", " ");
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [complaintError, setComplaintError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [page, setPage] = useState("create");
  const [complaintFilter, setComplaintFilter] = useState("current");
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [building, setBuilding] = useState("");
  const [room, setRoom] = useState("");
  const [image, setImage] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadComplaints() {
      setLoadingComplaints(true);
      setComplaintError("");

      try {
        const data = await getComplaintsRequest(accessToken);

        if (active) {
          setComplaints(data.complaints ?? []);
        }
      } catch (error) {
        if (active) {
          setComplaintError(error.message || "Could not load your complaints.");
        }
      } finally {
        if (active) {
          setLoadingComplaints(false);
        }
      }
    }

    loadComplaints();

    return () => {
      active = false;
    };
  }, [accessToken]);

  const newestFirst = [...complaints].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const newestActiveComplaint = newestFirst.find((complaint) =>
    activeComplaintStatuses.includes(complaint.status),
  );

  const currentComplaints = newestFirst.filter(
    (complaint) => complaint.status !== "Resolved",
  );

  const resolvedComplaints = newestFirst.filter(
    (complaint) => complaint.status === "Resolved",
  );

  const filteredComplaints =
    complaintFilter === "resolved" ? resolvedComplaints : currentComplaints;

  const selectedComplaint = complaints.find(
    (complaint) => complaint._id === selectedComplaintId,
  );

  function openMyComplaints() {
    setComplaintFilter("current");
    setSelectedComplaintId(null);
    setPage("mine");
  }

  function openCreateComplaint() {
    setSelectedComplaintId(null);
    setPage("create");
  }

  function openComplaintDetails(complaint) {
    setSelectedComplaintId(complaint._id);
    setPage("detail");
  }

  function handleImageChange(event) {
    const selectedImage = event.target.files?.[0] ?? null;
    setFormError("");
    setSuccessMessage("");

    if (
      selectedImage &&
      !["image/jpeg", "image/png", "image/webp"].includes(selectedImage.type)
    ) {
      setImage(null);
      event.target.value = "";
      setFormError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (selectedImage && selectedImage.size > MAX_IMAGE_SIZE) {
      setImage(null);
      event.target.value = "";
      setFormError("The image must be 5 MB or smaller.");
      return;
    }

    setImage(selectedImage);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanBuilding = building.trim();
    const cleanRoom = room.trim();

    setFormError("");
    setSuccessMessage("");

    if (
      !cleanTitle ||
      !cleanDescription ||
      !category ||
      !cleanBuilding ||
      !image
    ) {
      setFormError("Complete the required fields and attach a photo as proof.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createComplaintRequest(
        {
          title: cleanTitle,
          description: cleanDescription,
          category,
          building: cleanBuilding,
          room: cleanRoom,
          image,
        },
        accessToken,
      );

      setSuccessMessage(result.message || "Complaint submitted successfully.");
      setTitle("");
      setDescription("");
      setCategory("");
      setBuilding("");
      setRoom("");
      setImage(null);
      form.reset();

      try {
        const updatedData = await getComplaintsRequest(accessToken);
        setComplaints(updatedData.complaints ?? []);
        setComplaintError("");
      } catch (error) {
        setComplaintError(
          error.message ||
            "Complaint submitted, but the list could not refresh.",
        );
      }
    } catch (error) {
      setFormError(error.message || "Could not submit the complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = user?.username?.trim()?.split(/\s+/)[0] || "there";

  function ComplaintCard({ complaint }) {
    const status = complaint.status || "Submitted";
    const statusClass = statusStyles[status] || statusStyles.Submitted;

    return (
      <button
        type="button"
        onClick={() => openComplaintDetails(complaint)}
        className="w-full overflow-hidden rounded-2xl border border-line/80 bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-brand/10"
      >
        <span className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:gap-4">
          {complaint.complaintPictureUrl ? (
            <img
              src={complaint.complaintPictureUrl}
              alt={`Proof for ${complaint.complaintTitle}`}
              loading="lazy"
              className="size-20 shrink-0 rounded-xl bg-canvas object-cover sm:size-[76px]"
            />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-canvas text-muted sm:size-[76px]">
              <FileImage size={22} />
            </span>
          )}

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-start justify-between gap-2">
              <span className="line-clamp-2 font-semibold leading-5 text-ink">
                {complaint.complaintTitle}
              </span>
              <span
                className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass}`}
              >
                {formatStatus(status)}
              </span>
            </span>

            <span className="mt-2 block line-clamp-2 text-sm leading-5 text-muted">
              {complaint.complaintDescription}
            </span>

            <span className="mt-2 block break-words text-xs font-medium text-muted">
              {complaint.category || "Category not available"}
              {" · "}
              {complaint.location?.building || "Building not available"}
              {complaint.location?.room
                ? ` · Room ${complaint.location.room}`
                : ""}
            </span>

            <span className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock3 size={13} />
              {formatDate(complaint.createdAt)}
            </span>
          </span>
        </span>
      </button>
    );
  }

  function ComplaintDetails({ complaint }) {
    const status = complaint.status || "Submitted";
    const statusClass = statusStyles[status] || statusStyles.Submitted;
    const history = [...(complaint.statusHistory ?? [])].sort(
      (a, b) => new Date(a.changedAt) - new Date(b.changedAt),
    );

    return (
      <section className="w-full rounded-[1.75rem] border border-white/90 bg-white/95 p-4 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage("mine")}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft"
          >
            <ArrowLeft size={16} />
            Back to My complaints
          </button>

          <button
            type="button"
            onClick={() => setPage("mine")}
            aria-label="Close complaint details"
            title="Close"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-brand/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">
              Complaint details
            </p>
            <h2 className="mt-1 break-words font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {complaint.complaintTitle}
            </h2>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold ${statusClass}`}
          >
            {formatStatus(status)}
          </span>
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
                <a
                  href={complaint.complaintPictureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block max-w-full overflow-hidden rounded-2xl border border-line"
                >
                  <img
                    src={complaint.complaintPictureUrl}
                    alt={`Submitted proof for ${complaint.complaintTitle}`}
                    className="max-h-72 max-w-full object-contain"
                  />
                </a>
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
                    <a
                      href={complaint.resolutionProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block max-w-full overflow-hidden rounded-xl border border-emerald-200"
                    >
                      <img
                        src={complaint.resolutionProofUrl}
                        alt={`Resolution proof for ${complaint.complaintTitle}`}
                        className="max-h-72 max-w-full object-contain"
                      />
                    </a>
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
            <h3 className="font-display font-bold">Status history</h3>

            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No status updates are available yet.
              </p>
            ) : (
              <ol className="mt-4 space-y-4">
                {history.map((entry, index) => (
                  <li key={`${entry.status}-${entry.changedAt}-${index}`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">
                          {formatStatus(entry.status)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(entry.changedAt)}
                        </p>
                        {entry.note && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <DashboardShell
      workspaceLabel="Student"
      activeSection="complaints"
      navItems={[
        { id: "complaints", label: "Complaints", icon: MessageSquareText },
        { id: "profile", label: "Profile", icon: UserRound, disabled: true },
      ]}
    >
      <div className="relative isolate mx-auto w-full max-w-none px-3 py-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[460px] before:bg-[radial-gradient(ellipse_at_top,_#e8f3ef_0%,_transparent_68%)] sm:px-6 sm:py-8 lg:px-8 xl:px-10">
        {page === "create" ? (
          <>
            <section className="relative mb-6 overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-white via-white to-[#e9f4ef] px-5 py-6 shadow-[0_24px_70px_-40px_rgba(24,35,45,0.35)] ring-1 ring-line/70 sm:mb-8 sm:rounded-[2rem] sm:px-8 sm:py-9 lg:px-10">
              <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-brand-soft/80 blur-3xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-dark">
                    <span className="size-1.5 rounded-full bg-brand" />
                    Student workspace
                  </span>
                  <h1 className="mt-4 break-words font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                    Hello, {firstName}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-base">
                    Report a campus issue and follow its progress from one
                    place.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openMyComplaints}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line/80 bg-white/85 px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:bg-white hover:shadow-md sm:w-auto"
                >
                  My complaints <ArrowUpRight size={16} />
                </button>
              </div>
            </section>

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
                    Share enough detail so your campus team can help.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
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
                    onChange={(event) => setTitle(event.target.value)}
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
                    onChange={(event) => setCategory(event.target.value)}
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
                  <label
                    htmlFor="complaint-description"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Description
                  </label>
                  <textarea
                    id="complaint-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={2000}
                    rows={5}
                    required
                    placeholder="Where is the issue, and what happened?"
                    className="w-full min-w-0 resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                  <p className="mt-1.5 text-right text-xs text-muted">
                    {description.length}/2000
                  </p>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="complaint-building"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Building
                  </label>
                  <input
                    id="complaint-building"
                    value={building}
                    onChange={(event) => setBuilding(event.target.value)}
                    maxLength={100}
                    required
                    placeholder="For example, Science Block"
                    className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="complaint-room"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Room number{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="complaint-room"
                    value={room}
                    onChange={(event) => setRoom(event.target.value)}
                    maxLength={30}
                    placeholder="For example, Room 204"
                    className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
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

                {successMessage && (
                  <p
                    role="status"
                    className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 sm:col-span-2"
                  >
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                    <span>{successMessage}</span>
                  </p>
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
                        Submitting…
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

            <section className="mt-6 w-full rounded-3xl border border-white/90 bg-white/95 p-4 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 sm:mt-8 sm:rounded-[1.75rem] sm:p-6 lg:p-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <MessageSquareText size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold">
                    Latest current complaint
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Your newest complaint being handled
                  </p>
                </div>
              </div>

              {loadingComplaints ? (
                <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-muted">
                  <LoaderCircle size={20} className="animate-spin text-brand" />
                  Loading complaints…
                </div>
              ) : complaintError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
                >
                  {complaintError}
                </p>
              ) : newestActiveComplaint ? (
                <ComplaintCard complaint={newestActiveComplaint} />
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center">
                  <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-sm">
                    <Inbox size={22} />
                  </span>
                  <h3 className="mt-4 font-display font-bold">
                    No complaints in progress
                  </h3>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
                    Submit a complaint using the form. You can see all your
                    complaints from My complaints.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : page === "mine" ? (
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

            <div className="mb-6 grid grid-cols-2 gap-2 sm:flex">
              {[
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
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setComplaintFilter(filter.id)}
                  aria-pressed={complaintFilter === filter.id}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                    complaintFilter === filter.id
                      ? "bg-brand text-white"
                      : "border border-line bg-white text-muted hover:bg-brand-soft hover:text-brand-dark"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      complaintFilter === filter.id
                        ? "bg-white/20"
                        : "bg-canvas"
                    }`}
                  >
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

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
              <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-sm">
                  <Inbox size={22} />
                </span>
                <h2 className="mt-4 font-display font-bold">
                  {complaintFilter === "resolved"
                    ? "No resolved complaints"
                    : "No current complaints"}
                </h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
                  {complaintFilter === "resolved"
                    ? "Resolved complaints will appear here."
                    : "Your submitted complaints will appear here while they are being handled."}
                </p>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-2">
                {filteredComplaints.map((complaint) => (
                  <ComplaintCard
                    key={complaint._id}
                    complaint={complaint}
                  />
                ))}
              </div>
            )}
          </section>
        ) : selectedComplaint ? (
          <ComplaintDetails complaint={selectedComplaint} />
        ) : (
          <section className="w-full rounded-3xl border border-white/90 bg-white/95 p-6 text-center shadow-sm ring-1 ring-line/70 sm:p-8">
            <h1 className="font-display text-xl font-bold">
              Complaint not found
            </h1>
            <p className="mt-2 text-sm text-muted">
              It may have been removed from the list. Return to My complaints
              to choose another one.
            </p>
            <button
              type="button"
              onClick={() => setPage("mine")}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <ArrowLeft size={16} />
              My complaints
            </button>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}