import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut, Wrench } from "lucide-react";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isDashboard =
    location.pathname === "/app" || location.pathname.endsWith("/dashboard");
  const isLogin = location.pathname === "/login";
  const isRegister = location.pathname === "/register";

  function handleSignOut() {
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/95">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to={isDashboard ? "/app" : "/login"}
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
                  Alex Morgan
                </span>

                <button
                  type="button"
                  onClick={handleSignOut}
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

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-7 text-xs text-muted sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} FixFlow</span>
        <span>Campus account support</span>
      </footer>
    </div>
  );
}
