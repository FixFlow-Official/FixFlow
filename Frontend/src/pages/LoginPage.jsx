import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginRequest } from "../services/api.js";
import { useAuth } from "../context/useAuth.js";
import RoleSelect from "../components/auth/RoleSelect.jsx";

const dashboardPaths = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
};

export default function LoginPage() {
  const [form, setForm] = useState({
    type: "student",
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setAccessToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const email = form.email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValidEmail) {
      setError("Enter a valid email address.");
      return;
    }

    if (!form.password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);

    try {
      const data = await loginRequest({
        email,
        password: form.password,
        type: form.type,
      });

      const destination = dashboardPaths[data.user?.role];

      if (!destination) {
        throw new Error("Your account has an unrecognized role.");
      }

      setUser(data.user);
      setAccessToken(data.accessToken);
      navigate(destination);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100svh-140px)] max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 md:grid-cols-[1fr_0.9fr] md:gap-14 md:py-14 lg:px-8">
      <section className="mx-auto max-w-xl md:mx-0">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-dark">
          Campus support, made simpler
        </div>

        <h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
          Good to have you <span className="text-brand">back.</span>
        </h1>

        <p className="mt-4 max-w-lg text-base leading-7 text-muted sm:text-lg">
          Sign in with your campus account to access FixFlow.
        </p>

        <div className="mt-8 hidden space-y-4 md:block">
          <p className="text-sm font-semibold">One campus account</p>
          <p className="text-sm text-muted">
            Your verified identity keeps access tied to your institution.
          </p>
          <p className="text-sm font-semibold">Simple and secure</p>
          <p className="text-sm text-muted">
            Sign in with the role assigned to your campus account.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <h2 className="font-display text-xl font-bold">Sign in to FixFlow</h2>
          <p className="mt-1 text-sm text-muted">
            Use the email linked to your campus ID.
          </p>
        </div>

        {location.state?.passwordResetSuccess && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
          >
            Password reset successfully. Sign in with your new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Account type</span>
            <RoleSelect
              value={form.type}
              onChange={(value) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  type: value,
                }))
              }
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Campus email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@college.edu"
              value={form.email}
              onChange={handleChange}
              className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          </label>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          New to FixFlow?{" "}
          <a
            href="/register"
            className="font-semibold text-brand hover:underline"
          >
            Create your account
          </a>
        </p>

        <p className="mt-5 border-t border-line pt-4 text-center text-xs text-muted">
          Access is verified through your institution
        </p>
      </section>
    </div>
  );
}
