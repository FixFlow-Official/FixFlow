// Accessible confirmation dialog for signing out from one or all sessions.
export default function SignOutDialog({
  open,
  signOutScope,
  setSignOutScope,
  signOutError,
  signingOut,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="sign-out-title" className="font-display text-xl font-bold">
          Sign out?
        </h2>

        <p className="mt-2 text-sm leading-6 text-muted">
          Choose whether to sign out on this device or on all devices.
        </p>

        <fieldset className="mt-5 space-y-3">
          <legend className="text-sm font-semibold">
            Where do you want to sign out?
          </legend>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="radio"
              name="sign-out-scope"
              value="current"
              checked={signOutScope === "current"}
              onChange={() => setSignOutScope("current")}
              className="mt-1 accent-brand"
            />
            <span>
              <span className="block text-sm font-semibold">This device</span>
              <span className="text-xs text-muted">
                Keep other devices signed in.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="radio"
              name="sign-out-scope"
              value="all"
              checked={signOutScope === "all"}
              onChange={() => setSignOutScope("all")}
              className="mt-1 accent-brand"
            />
            <span>
              <span className="block text-sm font-semibold">All devices</span>
              <span className="text-xs text-muted">
                Sign out every active session for this account.
              </span>
            </span>
          </label>
        </fieldset>

        {signOutError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
          >
            {signOutError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={signingOut}
            onClick={onClose}
            className="min-h-10 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-stone-100 disabled:opacity-60"
          >
            No, stay signed in
          </button>

          <button
            type="button"
            disabled={signingOut}
            onClick={onConfirm}
            className="min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Yes, sign out"}
          </button>
        </div>
      </section>
    </div>
  );
}
