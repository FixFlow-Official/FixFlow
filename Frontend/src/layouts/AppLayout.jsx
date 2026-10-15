import { Link, Outlet, useLocation } from 'react-router-dom'

export default function AppLayout() {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/95">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/login"
            className="flex items-center gap-2.5 rounded-lg"
            aria-label="FixFlow home"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand font-bold text-white">
              F
            </span>

            <span className="font-display text-lg font-extrabold tracking-tight">
              fixflow<span className="text-brand">.</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="flex items-center gap-2">
            <Link
              to="/login"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                isLoginPage ? 'text-brand' : 'text-muted hover:text-ink'
              }`}
            >
              Sign in
            </Link>

            <Link
              to="/register"
              className="inline-flex min-h-10 items-center rounded-xl bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mx-auto flex max-w-7xl items-center justify-between px-4 py-7 text-xs text-muted sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} FixFlow</span>
        <span>Campus account support</span>
      </footer>
    </div>
  )
}