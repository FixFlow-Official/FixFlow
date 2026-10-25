import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  UserPlus,
  UserRoundX,
} from "lucide-react";
import {
  addUserToDirectoryByAdminRequest,
  deleteUserByAdminRequest,
} from "../../services/api.js";

const emptyCreateForm = {
  id: "",
  name: "",
  email: "",
  course: "",
};

// Admin controls for managing student/staff directory entries and accounts.
export default function AdminUserManagement({ accessToken }) {
  const [activeAction, setActiveAction] = useState("create");
  const [userType, setUserType] = useState("student");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [campusId, setCampusId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function clearFeedback() {
    setError("");
    setSuccess("");
  }

  function setCreateField(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }));
    clearFeedback();
  }

  function handleIdChange(value) {
    setCampusId(value.replace(/\D/g, "").slice(0, 10));
    setConfirmingDelete(false);
    clearFeedback();
  }

  async function handleCreate(event) {
    event.preventDefault();
    clearFeedback();

    setIsSaving(true);
    try {
      const result = await addUserToDirectoryByAdminRequest(
        {
          id: createForm.id,
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          course: createForm.course.trim(),
          type: userType,
        },
        accessToken,
      );
      setSuccess(result.message || "Added to the campus directory.");
      setCreateForm(emptyCreateForm);
    } catch (requestError) {
      setError(requestError.message || "Could not add this person to the directory.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginDeleteConfirmation(event) {
    event.preventDefault();
    clearFeedback();
    if (!campusId) {
      setError("Enter the student or staff campus ID.");
      return;
    }
    setConfirmingDelete(true);
  }

  async function handleDelete() {
    setIsSaving(true);
    clearFeedback();
    try {
      const result = await deleteUserByAdminRequest(
        { id: campusId, type: userType },
        accessToken,
      );
      setSuccess(result.message || "User removed successfully.");
      setCampusId("");
      setConfirmingDelete(false);
    } catch (requestError) {
      setError(requestError.message || "Could not remove this user.");
    } finally {
      setIsSaving(false);
    }
  }

  const isCreating = activeAction === "create";

  return (
    <div className="w-full min-w-0">
      <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
        Administrator workspace
      </span>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        User access
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
        Manage the campus directory and remove account access when it is no longer needed.
      </p>

      <section className="mt-6 grid w-full min-w-0 items-start gap-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:mt-8 sm:p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] xl:gap-8 xl:p-8">
        <div className="min-w-0">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-1">
          <button
            type="button"
            aria-pressed={isCreating}
            onClick={() => {
              setActiveAction("create");
              setConfirmingDelete(false);
              clearFeedback();
            }}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              isCreating ? "bg-white text-brand-dark shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <UserPlus size={17} aria-hidden="true" /> Add to directory
          </button>
          <button
            type="button"
            aria-pressed={!isCreating}
            onClick={() => {
              setActiveAction("delete");
              clearFeedback();
            }}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              !isCreating ? "bg-white text-rose-700 shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <UserRoundX size={17} aria-hidden="true" /> Remove account
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {success && (
          <p role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </p>
        )}

        {isCreating ? (
          <>
            <div className="mt-6 flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
                <UserPlus size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">Add a person to the directory</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Add institution-approved details. The person must verify this email with an OTP and set their own password to register.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Account type</span>
                <select
                  value={userType}
                  onChange={(event) => {
                    setUserType(event.target.value);
                    clearFeedback();
                  }}
                  disabled={isSaving}
                  className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">{userType === "student" ? "Student roll number" : "Staff ID"}</span>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={createForm.id}
                    onChange={(event) => setCreateField("id", event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="Numeric campus ID"
                    disabled={isSaving}
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Full name</span>
                  <input
                    required
                    type="text"
                    maxLength={100}
                    value={createForm.name}
                    onChange={(event) => setCreateField("name", event.target.value)}
                    placeholder="Enter the user's name"
                    disabled={isSaving}
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Campus email</span>
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={createForm.email}
                  onChange={(event) => setCreateField("email", event.target.value)}
                  placeholder="name@college.edu"
                  disabled={isSaving}
                  className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">{userType === "student" ? "Course" : "Department"}</span>
                <input
                  required
                  type="text"
                  maxLength={100}
                  value={createForm.course}
                  onChange={(event) => setCreateField("course", event.target.value)}
                  placeholder={userType === "student" ? "For example, BCA" : "For example, Electrical Maintenance"}
                  disabled={isSaving}
                  className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
              >
                <UserPlus size={17} aria-hidden="true" />
                {isSaving ? "Adding to directory…" : "Add to campus directory"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mt-6 flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <UserRoundX size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">Remove an account</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Account access is removed; complaint reports and their history are retained.
                </p>
              </div>
            </div>

            <form onSubmit={beginDeleteConfirmation} className="mt-6 space-y-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Account type</span>
                <select
                  value={userType}
                  onChange={(event) => {
                    setUserType(event.target.value);
                    setConfirmingDelete(false);
                    clearFeedback();
                  }}
                  disabled={isSaving}
                  className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">{userType === "student" ? "Student roll number" : "Staff ID"}</span>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={campusId}
                  onChange={(event) => handleIdChange(event.target.value)}
                  placeholder="Enter the campus ID"
                  disabled={isSaving}
                  className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                />
              </label>

              {!confirmingDelete ? (
                <button type="submit" disabled={!campusId || isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={17} aria-hidden="true" /> Review removal
                </button>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2 text-amber-950">
                    <ShieldAlert size={19} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Confirm account removal</p>
                      <p className="mt-1 text-sm leading-5">
                        Remove {userType} ID <strong>{campusId}</strong>? The account and active sessions will be removed. Complaint records remain and retain a copy of the user details for historical reference.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={handleDelete} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60">
                      <Trash2 size={16} aria-hidden="true" />
                      {isSaving ? "Removing…" : "Confirm removal"}
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isSaving} className="min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-stone-50 disabled:opacity-60">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </form>
          </>
        )}

        <div className="mt-6 rounded-xl bg-canvas p-4 text-sm leading-6 text-muted">
          <p className="font-semibold text-ink">Important</p>
          {isCreating ? (
            <p className="mt-1">This adds directory details only. It does not create an account or set a password. The user must verify their email with an OTP, accept the terms, and choose a password during registration.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Complaint reports and status history are retained with identity snapshots.</li>
              <li>Administrator accounts cannot be removed from this screen.</li>
            </ul>
          )}
        </div>
        </div>

        <aside className="min-w-0 rounded-2xl border border-line bg-gradient-to-br from-brand-soft/70 via-white to-canvas p-5 sm:p-6 xl:sticky xl:top-24">
          {isCreating ? (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm ring-1 ring-brand/10">
                <UserPlus size={22} aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-brand-dark">
                Directory entry
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink">
                Registration stays verified
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Adding a person here authorizes their campus ID and email for registration. It does not create sign-in access.
              </p>

              <ol className="mt-6 space-y-4">
                <li className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-dark ring-1 ring-line">1</span>
                  <span className="pt-1 text-sm leading-5 text-ink">Enter the institution-issued ID, name, email, and course or department.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-dark ring-1 ring-line">2</span>
                  <span className="pt-1 text-sm leading-5 text-ink">The user verifies the email address with the registration OTP.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-dark ring-1 ring-line">3</span>
                  <span className="pt-1 text-sm leading-5 text-ink">The user accepts the terms and chooses a personal password.</span>
                </li>
              </ol>

              <div className="mt-6 rounded-xl border border-brand/10 bg-white/80 p-4">
                <p className="text-sm font-semibold text-ink">No credentials stored by admin</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  The admin only maintains approved campus directory details. OTP verification and password setup remain in the user registration flow.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm ring-1 ring-rose-100">
                <ShieldAlert size={22} aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-rose-700">
                Account removal
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink">
                Access removed, records retained
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Removing an account revokes its active sessions and removes its campus directory entry. Complaint history remains available to administrators.
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-line bg-white/80 p-4">
                  <p className="text-sm font-semibold text-ink">What is preserved</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Reports keep a snapshot of the student or staff identity, including names and campus IDs used in historical records.
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white/80 p-4">
                  <p className="text-sm font-semibold text-ink">What is removed</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    The user account, its active sessions, and its entry in the campus directory are removed.
                  </p>
                </div>
              </div>

              <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted">
                <ShieldAlert size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                Administrator accounts are not eligible for removal here.
              </p>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
