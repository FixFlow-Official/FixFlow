import { useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { ArrowRight, LogOut, Wrench } from "lucide-react"
import { useAuth } from "../context/AuthContext.jsx"
import { logoutRequest, logoutAllRequest } from "../services/api.js"

const dashboardPaths = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser, accessToken, setAccessToken } = useAuth()

  const [showSignOutDialog, setShowSignOutDialog] = useState(false)
  const [signOutScope, setSignOutScope] = useState("current")
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState("")

  const isDashboard =
    location.pathname === "/app" || location.pathname.endsWith("/dashboard")
  const isLogin = location.pathname === "/login"
  const isRegister = location.pathname === "/register"

  async function handleConfirmSignOut() {
    setSigningOut(true)
    setSignOutError("")

    try {
      if (signOutScope === "all") {
        await logoutAllRequest(accessToken)
      } else {
        await logoutRequest(accessToken)
      }

      setUser(null)
      setAccessToken(null)
      setShowSignOutDialog(false)
      navigate("/login", { replace: true })
    } catch (error) {
      setSignOutError(error.message)
    } finally {
      setSigningOut(false)
    }
  }

  function handleOpenSignOutDialog() {
    setSignOutScope("current")
    setSignOutError("")
    setShowSignOutDialog(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/95">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to={
              isDashboard
                ? dashboardPaths[user?.role] || "/login"
                : "/login"
            }
            className="flex items-center gap-2.5 rounded-lg"
            aria-label="FixFlow home"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
              <Wrench size={18} />
            </span>

            <span className="font-display text-lg font-extrabold tracking-tight">
              fixflow<span className="text-brand">.</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="flex items-center gap-2">
            {isDashboard ? (
              <>
                <span className="hidden text-sm font-medium sm:inline">
                  {user?.username ?? "Account"}
                </span>

                <button
                  type="button"
                  onClick={handleOpenSignOutDialog}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-stone-100 hover:text-ink"
                >
                  <LogOut size={17} />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  aria-current={isLogin ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3.5 text-sm font-semibold ${
                    isLogin
                      ? "bg-brand text-white"
                      : "text-muted hover:bg-stone-100 hover:text-ink"
                  }`}
                >
                  Sign in
                </Link>

                <Link
                  to="/register"
                  aria-current={isRegister ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold ${
                    isRegister
                      ? "bg-brand text-white"
                      : "text-muted hover:bg-stone-100 hover:text-ink"
                  }`}
                >
                  Create account
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {signOutError && !showSignOutDialog && (
        <p
          role="alert"
          className="bg-rose-50 px-4 py-2 text-center text-sm text-rose-800"
        >
          {signOutError}
        </p>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-7 text-xs text-muted sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} FixFlow</span>
        <span>Campus account support</span>
      </footer>

      {showSignOutDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-out-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2
              id="sign-out-title"
              className="font-display text-xl font-bold"
            >
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
                  <span className="block text-sm font-semibold">
                    This device
                  </span>
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
                  <span className="block text-sm font-semibold">
                    All devices
                  </span>
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
                onClick={() => setShowSignOutDialog(false)}
                className="min-h-10 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-stone-100 disabled:opacity-60"
              >
                No, stay signed in
              </button>

              <button
                type="button"
                disabled={signingOut}
                onClick={handleConfirmSignOut}
                className="min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Yes, sign out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}