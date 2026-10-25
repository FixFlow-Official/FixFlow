import { Link } from "react-router-dom";
import { ArrowRight, LogOut, Wrench } from "lucide-react";
import NotificationCenter from "./NotificationCenter.jsx";

const dashboardPaths = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
};

// Shared public/dashboard header. Navigation and sign-out state stay in AppLayout.
export default function AppHeader({ isDashboard, isLogin, isRegister, user, onSignOut }) {
  return (
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

                <NotificationCenter />

                <button
                  type="button"
                  onClick={onSignOut}
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
  );
}
