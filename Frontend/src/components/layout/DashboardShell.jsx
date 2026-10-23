import { useEffect, useState } from "react";
import { LockKeyhole, Menu, X } from "lucide-react";

function DashboardNavigation({
  workspaceLabel,
  navItems,
  activeSection,
  onNavigate,
}) {
  return (
    <>
      <div className="px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Workspace
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">
          {workspaceLabel}
        </h2>
      </div>

      <nav
        aria-label={`${workspaceLabel} dashboard sections`}
        className="space-y-1 px-3"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeSection;

          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors duration-200 ${
                isActive
                  ? "bg-brand-soft text-brand-dark"
                  : item.disabled
                    ? "cursor-not-allowed text-muted/60"
                    : "text-muted hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>

              {item.disabled && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted/70">
                  Soon
                  <LockKeyhole size={12} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default function DashboardShell({
  workspaceLabel,
  navItems,
  activeSection,
  onSectionChange,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  function handleNavigate(item) {
    if (item.disabled) return;

    onSectionChange?.(item.id);
    setMobileMenuOpen(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] w-full bg-canvas">
      {/* Desktop navigation: full-height sidebar attached to the left edge */}
      <aside className="fixed bottom-0 left-0 top-[68px] z-10 hidden w-64 border-r border-line bg-white lg:block">
        <DashboardNavigation
          workspaceLabel={workspaceLabel}
          navItems={navItems}
          activeSection={activeSection}
          onNavigate={handleNavigate}
        />
      </aside>

      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close dashboard navigation"
        tabIndex={mobileMenuOpen ? 0 : -1}
        onClick={() => setMobileMenuOpen(false)}
        className={`fixed inset-x-0 bottom-0 top-[68px] z-30 bg-slate-950/40 transition-opacity duration-300 motion-reduce:transition-none lg:hidden ${
          mobileMenuOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile navigation drawer */}
      <aside
        id="mobile-dashboard-sidebar"
        aria-label={`${workspaceLabel} dashboard navigation`}
        aria-hidden={!mobileMenuOpen}
        className={`fixed bottom-0 left-0 top-[68px] z-40 w-[min(82vw,300px)] border-r border-line bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <DashboardNavigation
          workspaceLabel={workspaceLabel}
          navItems={navItems}
          activeSection={activeSection}
          onNavigate={handleNavigate}
        />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:ml-64 lg:px-9 lg:py-8">
        {/* Mobile menu button */}
        <div className="mb-4 lg:hidden">
          <button
            type="button"
            aria-label={
              mobileMenuOpen ? "Close dashboard navigation" : "Open dashboard navigation"
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-dashboard-sidebar"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-stone-50"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            Menu
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}