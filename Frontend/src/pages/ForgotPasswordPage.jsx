import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RoleSelect from "../components/auth/RoleSelect.jsx";
import {
  requestPasswordResetCode,
  verifyEmailRequest,
  resetPasswordRequest,
} from "../services/api.js";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0);
  const [type, setType] = useState("student");
  const [id, setId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResendCode() {
    setError("");
    setBusy(true);

    try {
      await requestPasswordResetCode({ id: id.trim(), type });
      setResendCooldown(60);
    } catch (requestError) {
      setError(requestError.message);

      if (requestError.retryAfterSeconds > 0) {
        setResendCooldown(requestError.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const cleanId = id.trim();

    if (step === 0 && !/^\d{10}$/.test(cleanId)) {
      setError("Enter your 10-digit campus ID.");
      return;
    }

    if (step === 1 && !/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    if (step === 2) {
      if (password.length < 8 || password.length > 20) {
        setError("Your password must be between 8 and 20 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("The passwords do not match.");
        return;
      }
    }

    setBusy(true);

    try {
      if (step === 0) {
        // The page moves to OTP only if the backend request succeeds.
        await requestPasswordResetCode({ id: cleanId, type });
        setResendCooldown(60);
        setStep(1);
      } else if (step === 1) {
        await verifyEmailRequest({
          otp: otp.trim(),
          id: cleanId,
          type,
          purpose: "password-reset",
        });
        setStep(2);
      } else {
        await resetPasswordRequest({
          password,
          id: cleanId,
          type,
        });
        navigate("/login", { state: { passwordResetSuccess: true } });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-140px)] max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
        <Link
          to="/login"
          className="text-sm font-semibold text-muted hover:text-brand"
        >
          ← Back to sign in
        </Link>

        <div className="mb-6 mt-5">
          <h1 className="font-display text-2xl font-extrabold">
            Reset your password
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted">
            {step === 0 &&
              "Enter your campus ID and account type. We’ll email a verification code to the address on file."}
            {step === 1 &&
              "Enter the 6-digit code sent to your registered email."}
            {step === 2 && "Choose a new password for your FixFlow account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 0 && (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Account type</span>
                <RoleSelect value={type} onChange={setType} />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Campus ID</span>
                <input
                  value={id}
                  onChange={(event) => setId(event.target.value)}
                  autoComplete="username"
                  inputMode="numeric"
                  maxLength={10}
                  className="min-h-12 w-full rounded-xl border border-line px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="Enter your 10-digit campus ID"
                />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Verification code</span>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="min-h-12 w-full rounded-xl border border-line px-3.5 tracking-[0.3em] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="6-digit code"
                />
              </label>

              <div className="text-right">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={busy || resendCooldown > 0}
                  className="text-sm font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="min-h-12 w-full rounded-xl border border-line px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="Create a new password"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="min-h-12 w-full rounded-xl border border-line px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="Enter the new password again"
                />
              </label>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : step === 0
                ? "Send reset code"
                : step === 1
                  ? "Verify code"
                  : "Reset password"}
          </button>
        </form>
      </section>
    </main>
  );
}