import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../../context/useAuth.js";
import {
  changeMyPasswordRequest,
  requestPhoneOtpRequest,
  updateMyProfileRequest,
  verifyPhoneOtpRequest,
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
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [whatsAppNotificationsEnabled, setWhatsAppNotificationsEnabled] = useState(user?.whatsAppNotificationsEnabled ?? true);
  const [phoneOtpMode, setPhoneOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [editingPhone, setEditingPhone] = useState(!user?.phoneNumber || !user?.phoneNumberVerified);
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

  useEffect(() => {
    if (otpSecondsLeft <= 0) return undefined;
    const interval = setInterval(() => {
      setOtpSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpSecondsLeft]);

  async function handleSendOtp() {
    setOtpError("");
    setOtpSuccess("");
    const digits = (phoneNumber.match(/\d/g) || []).length;
    if (digits < 10 || digits > 15) {
      setOtpError("Enter a valid mobile number with 10–15 digits (e.g. +91 98765 43210).");
      return;
    }
    setOtpSending(true);
    try {
      const res = await requestPhoneOtpRequest({ phoneNumber }, accessToken);
      setPhoneOtpMode(true);
      setPhoneNumber(res.phoneNumber || phoneNumber);
      setOtpSecondsLeft(res.retryAfterSeconds || 60);
      setOtpSuccess(res.message || "WhatsApp verification code sent successfully!");
    } catch (err) {
      setOtpError(err.message || "Failed to send WhatsApp verification code.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e?.preventDefault();
    setOtpError("");
    setOtpSuccess("");
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError("Please enter the 6-digit verification code.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await verifyPhoneOtpRequest({ phoneNumber, otp: otpCode.trim() }, accessToken);
      setUser(res.user);
      setPhoneNumber(res.user.phoneNumber || phoneNumber);
      setPhoneOtpMode(false);
      setEditingPhone(false);
      setOtpCode("");
      setOtpSuccess(res.message || "WhatsApp number linked successfully!");
    } catch (err) {
      setOtpError(err.message || "Invalid or expired code.");
    } finally {
      setOtpVerifying(false);
    }
  }

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
        {
          username,
          profilePicture,
          removeProfilePicture,
          phoneNumber,
          whatsAppNotificationsEnabled,
        },
        accessToken,
      );
      setUser(result.user);
      setUsername(result.user.username || "");
      setPhoneNumber(result.user.phoneNumber || "");
      setWhatsAppNotificationsEnabled(result.user.whatsAppNotificationsEnabled ?? true);
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

          <div className="mt-5 rounded-2xl border border-line bg-canvas/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-ink">
                <Phone size={18} className="text-emerald-600" />
                <h3 className="font-display text-sm font-bold">
                  WhatsApp Timeline Updates
                </h3>
              </div>
              {user?.phoneNumber && user?.phoneNumberVerified && !editingPhone && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Verified WhatsApp Number
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-muted leading-relaxed">
              Link your mobile number with a 6-digit OTP to receive instant repair updates, technician acceptance notes, and 1-click reopen alerts on WhatsApp.
            </p>

            {/* Display State: Verified */}
            {user?.phoneNumber && user?.phoneNumberVerified && !editingPhone ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-3.5 shadow-2xs">
                <div>
                  <span className="text-[11px] font-semibold text-muted">Linked WhatsApp Number</span>
                  <p className="font-mono text-sm font-bold text-ink">{user.phoneNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPhone(true);
                    setPhoneOtpMode(false);
                    setOtpError("");
                    setOtpSuccess("");
                  }}
                  className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                >
                  Change Number
                </button>
              </div>
            ) : (
              /* Edit & OTP Verification Form */
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="profile-phone" className="block text-xs font-semibold text-muted">
                    Mobile Number (with country code)
                  </label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="profile-phone"
                      type="tel"
                      value={phoneNumber}
                      disabled={phoneOtpMode}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 98765 43210"
                      maxLength={20}
                      className="min-h-10 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-100"
                    />
                    {!phoneOtpMode && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpSending || !phoneNumber.trim()}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                      >
                        {otpSending ? <LoaderCircle size={14} className="animate-spin" /> : <Smartphone size={14} />}
                        Send WhatsApp OTP
                      </button>
                    )}
                  </div>
                </div>

                {/* OTP Input Card */}
                {phoneOtpMode && (
                  <div className="rounded-xl border border-brand/30 bg-white p-4 shadow-sm animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-dark">
                        Enter 6-Digit WhatsApp Verification Code
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Verification code sent via <strong className="text-ink">WhatsApp</strong> to <strong className="text-ink">{phoneNumber}</strong>.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        className="min-h-10 w-full rounded-xl border-2 border-brand/40 px-3 text-center font-mono text-base font-bold tracking-[0.3em] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 sm:w-36"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otpCode.length !== 6}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50 sm:flex-none"
                      >
                        {otpVerifying ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Verify &amp; Link
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpSecondsLeft > 0 || otpSending}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-3 text-xs font-semibold text-ink transition hover:bg-slate-100 disabled:opacity-50 sm:flex-none"
                      >
                        <RefreshCw size={12} className={otpSending ? "animate-spin" : ""} />
                        <span>{otpSecondsLeft > 0 ? `Resend (${otpSecondsLeft}s)` : "Resend Code"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneOtpMode(false);
                          setOtpError("");
                          setOtpSuccess("");
                        }}
                        className="min-h-10 px-2 text-xs text-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {otpError && (
              <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {otpError}
              </p>
            )}

            {otpSuccess && (
              <p role="status" className="mt-3 flex items-start gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                {otpSuccess}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-ink">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={whatsAppNotificationsEnabled}
                  onChange={(e) => setWhatsAppNotificationsEnabled(e.target.checked)}
                  className="size-4 rounded border-line text-emerald-700 accent-emerald-700"
                />
                <span>WhatsApp status alerts (instant campus ticket updates)</span>
              </label>
            </div>
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
