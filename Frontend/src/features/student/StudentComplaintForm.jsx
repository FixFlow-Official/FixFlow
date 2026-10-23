import { AlertCircle, CheckCircle2, FileImage, LoaderCircle, Plus, Send, Upload } from "lucide-react";

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
  room,
  setRoom,
  image,
  handleImageChange,
  formError,
  successMessage,
  submitting,
  handleSubmit,
}) {
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
  );
}
