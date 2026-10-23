import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  verifyUserRequest,
  verifyEmailRequest,
  createAccountRequest,
} from "../services/api.js";
import { Link, useNavigate } from "react-router-dom";
import RoleSelect from "../components/auth/RoleSelect.jsx";
import TermsModal from "../components/registration/TermsModal.jsx";

const steps = ["Verify ID", "Check email", "Set password"];

const roleNames = {
  student: "Student",
  staff: "Staff",
  admin: "Administrator",
};

const idLabels = {
  student: "Student roll number",
  staff: "Staff ID",
  admin: "Admin ID",
};

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [type, setType] = useState("student");
  const [id, setId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResendCode() {
    setError("");
    setResending(true);

    try {
      await verifyUserRequest({
        id: id.trim(),
        type,
      });

      setResendCooldown(60);
    } catch (error) {
      setError(error.message);

      if (error.retryAfterSeconds > 0) {
        setResendCooldown(error.retryAfterSeconds);
      }
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (step === 0) {
      if (!id.trim()) {
        setError(`Enter your ${idLabels[type].toLowerCase()}.`);
        return;
      }

      setBusy(true);

      try {
        await verifyUserRequest({ id: id.trim(), type });
        setResendCooldown(60);
        setStep(1);
      } catch (error) {
        setError(error.message);
      } finally {
        setBusy(false);
      }

      return;
    }

    if (step === 1) {
      if (!/^\d{6}$/.test(otp)) {
        setError("Enter the 6-digit code from your email.");
        return;
      }

      setBusy(true);

      try {
        await verifyEmailRequest({
          otp,
          id: id.trim(),
          type,
        });
        setStep(2);
      } catch (error) {
        setError(error.message);
      } finally {
        setBusy(false);
      }

      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    if (!termsAccepted) {
      setError("Please accept the Terms and Conditions to create an account.");
      return;
    }

    setBusy(true);

    try {
      await createAccountRequest({
        password,
        type,
        termsAccepted,
      });
      navigate("/login");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8">
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
            Institution verified
          </span>

          <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Create your account
          </h1>

          <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
            FixFlow checks your campus ID against your institution’s approved
            directory.
          </p>

          <ol className="my-7 grid grid-cols-3 gap-2 sm:gap-4">
            {steps.map((title, index) => (
              <li key={title} className="min-w-0">
                <div
                  className={`flex items-center gap-2 border-t-2 pt-3 ${
                    step >= index
                      ? "border-brand text-brand"
                      : "border-line text-slate-400"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                      step > index
                        ? "bg-brand text-white"
                        : step === index
                          ? "bg-brand-soft"
                          : "bg-slate-100"
                    }`}
                  >
                    {step > index ? <Check size={15} /> : index + 1}
                  </span>
                  <span className="truncate text-xs font-semibold sm:text-sm">
                    {title}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 0 && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    I am registering as
                  </span>
                  <RoleSelect value={type} onChange={setType} />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {idLabels[type]}
                  </span>
                  <input
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    autoComplete="off"
                    placeholder="Enter your campus ID"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                  <span className="block text-xs leading-5 text-muted">
                    Use the ID issued by your institution. A one-time code will
                    be sent to the email on file.
                  </span>
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <div className="rounded-xl bg-brand-soft/70 p-4 text-sm leading-6 text-brand-dark">
                  Enter the 6-digit code sent to the email address registered to
                  this {roleNames[type].toLowerCase()} ID.
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    Verification code
                  </span>
                  <input
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-center font-mono text-xl tracking-[0.35em] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || resending || busy}
                  className="text-sm font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                  {resending
                    ? "Sending code…"
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Create password</span>
                  <span className="block text-xs text-muted">
                    Use at least 8 characters.
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) =>
                      setTermsAccepted(event.target.checked)
                    }
                    className="mt-1 size-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <span>
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="font-semibold text-brand underline underline-offset-2 hover:text-brand-dark"
                    >
                      Terms and Conditions
                    </button>
                    .
                  </span>
                </label>
              </>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((currentStep) => currentStep - 1)}
                  className="min-h-11 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? step === 0
                    ? "Checking ID…"
                    : step === 1
                      ? "Verifying email…"
                      : "Creating account…"
                  : step === 2
                    ? "Create account"
                    : step === 1
                      ? "Verify email"
                      : "Send verification code"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </section>

        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

        <p className="mt-5 text-center text-sm text-muted">
          Already registered?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}