import { useEffect, useState } from "react";
import {
  AlertCircle,
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
  Wrench,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createComplaintRequest,
  getComplaintsRequest,
} from "../services/api.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const statusStyles = {
  Submitted: "bg-sky-50 text-sky-700",
  Under_Review: "bg-amber-50 text-amber-800",
  In_Progress: "bg-violet-50 text-violet-700",
  On_Hold: "bg-orange-50 text-orange-800",
  Rejected: "bg-rose-50 text-rose-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-slate-100 text-slate-700",
};

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [complaintError, setComplaintError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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

    setFormError("");
    setSuccessMessage("");

    if (!cleanTitle || !cleanDescription || !image) {
      setFormError("Enter a title and description, and attach an image.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createComplaintRequest(
        {
          title: cleanTitle,
          description: cleanDescription,
          image,
        },
        accessToken,
      );

      setSuccessMessage(result.message || "Complaint submitted successfully.");
      setTitle("");
      setDescription("");
      setImage(null);
      form.reset();

      try {
        const updatedData = await getComplaintsRequest(accessToken);
        setComplaints(updatedData.complaints ?? []);
        setComplaintError("");
      } catch (error) {
        setComplaintError(
          error.message || "Complaint submitted, but the list could not refresh.",
        );
      }
    } catch (error) {
      setFormError(error.message || "Could not submit the complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = user?.username?.trim()?.split(/\s+/)[0] || "there";

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-4 py-8 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[460px] before:bg-[radial-gradient(ellipse_at_top,_#e8f3ef_0%,_transparent_68%)] sm:px-6 sm:py-11 lg:px-8">
      <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-[#e9f4ef] px-6 py-8 shadow-[0_24px_70px_-40px_rgba(24,35,45,0.35)] ring-1 ring-line/70 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-brand-soft/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-[38%] size-56 rounded-full bg-emerald-100/60 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-dark">
              <span className="size-1.5 rounded-full bg-brand" />
              Student workspace
            </span>

            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Hello, {firstName}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-base">
              Report a campus issue and follow its progress from one place.
            </p>
          </div>

          <a
            href="#my-complaints"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-line/80 bg-white/85 px-4 text-sm font-semibold text-ink shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:bg-white hover:shadow-md sm:self-auto"
          >
            My complaints <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/95 p-5 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 backdrop-blur transition-shadow duration-300 hover:shadow-[0_24px_65px_-38px_rgba(24,35,45,0.42)] sm:p-7">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
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
                className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink shadow-sm outline-none transition duration-200 placeholder:text-muted/70 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              <p className="mt-1.5 text-right text-xs text-muted">
                {title.length}/100
              </p>
            </div>

            <div>
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
                className="w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 text-ink shadow-sm outline-none transition duration-200 placeholder:text-muted/70 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              <p className="mt-1.5 text-right text-xs text-muted">
                {description.length}/2000
              </p>
            </div>

            <div>
              <label
                htmlFor="complaint-image"
                className="mb-2 block text-sm font-semibold"
              >
                Add a photo
              </label>

              <label
                htmlFor="complaint-image"
                className="group flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line bg-gradient-to-br from-canvas to-white px-4 py-4 transition duration-200 hover:border-brand/50 hover:from-brand-soft/60 hover:to-white"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm transition group-hover:scale-105">
                  {image ? <FileImage size={20} /> : <Upload size={20} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {image?.name || "Choose an image to attach"}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    JPG, PNG, or WebP · up to 5 MB
                  </span>
                </span>

                <span className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition group-hover:border-brand/30 group-hover:text-brand-dark">
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
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
              >
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                {formError}
              </p>
            )}

            {successMessage && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
              >
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(35,107,92,0.8)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-48"
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
          </form>
        </section>

        <section
          id="my-complaints"
          className="scroll-mt-24 rounded-[1.75rem] border border-white/90 bg-white/95 p-5 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 backdrop-blur sm:p-7"
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <MessageSquareText size={20} />
              </span>

              <div>
                <h2 className="font-display text-xl font-bold tracking-tight">
                  My complaints
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted">
                  Updates on the issues you reported
                </p>
              </div>
            </div>

            {!loadingComplaints && (
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-bold text-muted">
                {complaints.length}
              </span>
            )}
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
          ) : complaints.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-sm">
                <Inbox size={22} />
              </span>
              <h3 className="mt-4 font-display font-bold">
                Nothing submitted yet
              </h3>
              <p className="mt-1 max-w-xs text-sm leading-6 text-muted">
                Your submitted complaints and their updates will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {complaints.map((complaint) => {
                const status = complaint.status || "Submitted";
                const statusClass =
                  statusStyles[status] || statusStyles.Submitted;

                return (
                  <article
                    key={complaint._id}
                    className="overflow-hidden rounded-2xl border border-line/80 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:bg-brand-soft/10 hover:shadow-md"
                  >
                    <div className="flex gap-4 p-4">
                      {complaint.complaintPictureUrl ? (
                        <a
                          href={complaint.complaintPictureUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open image for ${complaint.complaintTitle}`}
                          className="shrink-0"
                        >
                          <img
                            src={complaint.complaintPictureUrl}
                            alt=""
                            loading="lazy"
                            className="size-[76px] rounded-xl bg-canvas object-cover"
                          />
                        </a>
                      ) : (
                        <span className="grid size-[76px] shrink-0 place-items-center rounded-xl bg-canvas text-muted">
                          <FileImage size={22} />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-semibold leading-5 text-ink">
                            {complaint.complaintTitle}
                          </h3>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass}`}
                          >
                            {status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">
                          {complaint.complaintDescription}
                        </p>

                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                          <Clock3 size={13} />
                          {formatDate(complaint.createdAt)}
                        </p>
                      </div>
                    </div>

                    {(complaint.rejectedReason || complaint.onHoldReason) && (
                      <p className="border-t border-line bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-900">
                        {complaint.rejectedReason || complaint.onHoldReason}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
