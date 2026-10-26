import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../../context/useAuth.js";
import {
  changeMyPasswordRequest,
  updateMyProfileRequest,
} from "../../services/api.js";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function getInitials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ProfileField({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-canvas/60 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value || "Not provided"}</p>
    </div>
  );
}

export default function ProfileSettings() {
  const { user, setUser, accessToken } = useAuth();
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const [username, setUsername] = useState(user?.username || "");
  const [profilePicture, setProfilePicture] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [confirmProfileSave, setConfirmProfileSave] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setProfileError("");
    setProfileSuccess("");
    if (!file) return;
    if (!acceptedImageTypes.has(file.type)) {
      setProfileError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setProfileError("Profile photo must be 5 MB or smaller.");
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setPhotoPreview(previewUrlRef.current);
    setProfilePicture(file);
    setRemoveProfilePicture(false);
  }

  async function saveProfile() {
    setProfileError("");
    setProfileSuccess("");
    setProfileBusy(true);
    try {
      const result = await updateMyProfileRequest(
        { username, profilePicture, removeProfilePicture },
        accessToken,
      );
      setUser(result.user);
      setUsername(result.user.username || "");
      setProfilePicture(null);
      setRemoveProfilePicture(false);
      setConfirmProfileSave(false);
      setProfileSuccess(result.message || "Profile updated successfully.");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
      setPhotoPreview("");
    } catch (error) {
      setConfirmProfileSave(false);
      setProfileError(error.message || "Could not update your profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword.length < 8 || newPassword.length > 20) {
      setPasswordError("New password must be between 8 and 20 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordBusy(true);
    try {
      const result = await changeMyPasswordRequest(
        { currentPassword, newPassword },
        accessToken,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(result.message || "Password changed successfully.");
      setPasswordOpen(false);
    } catch (error) {
      setPasswordError(error.message || "Could not change your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  const displayedPhoto = photoPreview || (!removeProfilePicture ? user?.profilePictureUrl : "");
  const roleLabel = user?.role === "admin" ? "Administrator" : user?.role === "staff" ? "Staff member" : "Student";

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl">
      <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">{roleLabel} workspace</span>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Profile settings</h1>
      <p className="mt-2 text-sm leading-6 text-muted sm:text-base">Update your profile details, photo, and sign-in password.</p>

      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form onSubmit={(event) => { event.preventDefault(); setProfileError(""); setConfirmProfileSave(true); }} className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><UserRound size={20} /></span>
            <div><h2 className="font-display text-lg font-bold text-ink">Personal details</h2><p className="text-sm text-muted">Your campus identity details are read-only.</p></div>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-brand-soft/70 to-emerald-50/70 p-4 sm:flex-row sm:items-center">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-xl font-extrabold text-brand shadow-sm ring-1 ring-brand/10">
              {displayedPhoto ? <img src={displayedPhoto} alt={`${user?.username || "Your"} profile`} className="size-full object-cover" /> : getInitials(username)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Profile photo</p>
              <p className="mt-1 text-xs leading-5 text-muted">JPG, PNG, or WebP · up to 5 MB</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} className="sr-only" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-brand hover:text-brand"><Camera size={16} />Choose photo</button>
                {(user?.profilePictureUrl || profilePicture) && <button type="button" onClick={() => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = ""; setPhotoPreview(""); setProfilePicture(null); setRemoveProfilePicture(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"><Trash2 size={15} />Remove photo</button>}
              </div>
            </div>
          </div>

          {profileError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{profileError}</p>}
          {profileSuccess && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{profileSuccess}</p>}

          <label className="mt-5 block text-sm font-semibold text-ink">Full name
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={60} required className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ProfileField label="Email address" value={user?.email} />
            <ProfileField label={user?.role === "student" ? "Roll number" : user?.role === "staff" ? "Staff ID" : "Admin ID"} value={user?.campusId} />
            <ProfileField label={user?.role === "student" ? "Course" : user?.role === "staff" ? "Department" : "Designation"} value={user?.detail} />
            <ProfileField label="Account type" value={roleLabel} />
          </div>

          <button type="submit" disabled={profileBusy} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {profileBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {profileBusy ? "Saving profile…" : "Save profile"}
          </button>
        </form>

        <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><KeyRound size={20} /></span>
            <div><h2 className="font-display text-lg font-bold text-ink">Password &amp; security</h2><p className="text-sm text-muted">Manage your sign-in password and active sessions.</p></div>
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-canvas/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold text-ink">Keep your account secure</p><p className="mt-1 text-xs leading-5 text-muted">You’ll verify your current password before setting a new one.</p></div>
            <button type="button" onClick={() => { setPasswordError(""); setPasswordSuccess(""); setPasswordOpen(true); }} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-brand hover:text-brand"><KeyRound size={16} />Change password</button>
          </div>
          {passwordSuccess && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{passwordSuccess}</p>}
        </section>
      </div>

      {confirmProfileSave && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-profile-title" className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="confirm-profile-title" className="font-display text-lg font-bold text-ink">Save profile changes?</h2><p className="mt-1 text-sm leading-5 text-muted">Please confirm the updates to your profile.</p></div>
              <button type="button" onClick={() => setConfirmProfileSave(false)} aria-label="Close confirmation" className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><X size={17} /></button>
            </div>
            <div className="mt-4 space-y-2 rounded-xl bg-canvas/60 p-4 text-sm">
              {username.trim() !== (user?.username || "") && <p><span className="font-semibold text-ink">Name:</span> {user?.username} → {username.trim()}</p>}
              {profilePicture && <p className="font-medium text-ink">A new profile photo will be uploaded.</p>}
              {removeProfilePicture && <p className="font-medium text-rose-700">Your profile photo will be removed.</p>}
              <p className="text-xs leading-5 text-muted">Your verified email and campus details will stay the same.</p>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmProfileSave(false)} className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold text-ink">Review again</button>
              <button type="button" onClick={saveProfile} disabled={profileBusy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{profileBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{profileBusy ? "Saving…" : "Confirm and save"}</button>
            </div>
          </section>
        </div>
      )}

      {passwordOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !passwordBusy && setPasswordOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="my-auto w-full max-w-lg rounded-2xl border border-line bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div><h2 id="change-password-title" className="font-display text-lg font-bold text-ink">Change password</h2><p className="mt-1 text-sm text-muted">Verify your current password to continue.</p></div>
              <button type="button" onClick={() => !passwordBusy && setPasswordOpen(false)} aria-label="Close password dialog" className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-canvas"><X size={17} /></button>
            </header>
            <form onSubmit={changePassword} className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-ink">Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line px-3.5 text-sm font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" /></label>
              <label className="block text-sm font-semibold text-ink">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line px-3.5 text-sm font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" /><span className="mt-1 block text-xs font-normal text-muted">Use 8–20 characters and choose a password you haven’t used before.</span></label>
              <label className="block text-sm font-semibold text-ink">Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={20} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line px-3.5 text-sm font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" /></label>
              {passwordError && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{passwordError}</p>}
              <p className="flex items-start gap-2 rounded-xl border border-brand/10 bg-brand-soft/50 p-3 text-xs leading-5 text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" />This device stays signed in. Other active sessions are signed out after the password changes.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={passwordBusy} onClick={() => setPasswordOpen(false)} className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold text-ink">Cancel</button>
                <button type="submit" disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{passwordBusy ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}{passwordBusy ? "Updating…" : "Update password"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
