import { Component } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("FixFlow ErrorBoundary caught an unexpected render error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <section
          role="alert"
          aria-live="assertive"
          className="mx-auto my-8 max-w-xl rounded-3xl border border-rose-200 bg-white p-6 shadow-xl ring-1 ring-rose-100 sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-4 ring-rose-50/50">
              <AlertTriangle size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-ink sm:text-xl">
                {this.props.title || "Something went wrong"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {this.props.message ||
                  "FixFlow ran into an unexpected display problem. Your saved complaints and data are safe."}
              </p>
              {this.state.error?.message && (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-stone-50 p-3 text-xs text-rose-800">
                  {this.state.error.message}
                </pre>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-stone-50"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Reload page
                </button>
                <a
                  href="/login"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted transition hover:text-ink"
                >
                  <Home size={16} aria-hidden="true" />
                  Return home
                </a>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
