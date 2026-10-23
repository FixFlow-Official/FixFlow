import { useEffect } from "react";
import { X } from "lucide-react";

export default function TermsModal({ onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="flex max-h-[min(85vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              FixFlow
            </p>
            <h2
              id="terms-modal-title"
              className="mt-1 text-xl font-bold sm:text-2xl"
            >
              Terms and Conditions
            </h2>
            <p className="mt-1 text-sm text-muted">
              Please review these terms before creating your account.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Terms and Conditions"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </header>

        <div className="terms-modal-scroll space-y-5 overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700 sm:px-7">
          <p>
            By creating a FixFlow account, you agree to use the service
            responsibly and follow these terms.
          </p>

          <section>
            <h3 className="font-semibold text-slate-900">1. Account details</h3>
            <p>
              Provide accurate information and keep your account credentials
              private. You are responsible for activity performed through your
              account.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900">
              2. Submitting complaints
            </h3>
            <p>
              Submit truthful, relevant campus complaints. Uploaded photos
              should be genuine evidence related to the reported issue. Do not
              submit abusive, misleading, unlawful, or unrelated material.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900">
              3. Review and handling
            </h3>
            <p>
              Administrators may review complaints and assign them to campus
              staff. Staff may update complaint statuses and add notes or
              resolution evidence. Submission does not guarantee a particular
              response or resolution time.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900">
              4. Appropriate use
            </h3>
            <p>
              Do not misuse FixFlow, interfere with its operation, attempt
              unauthorized access, or use another person’s account.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900">
              5. Privacy and updates
            </h3>
            <p>
              Complaint details and attachments may be viewed by the
              administrators and staff responsible for handling the complaint.
              These terms may be updated as the service changes.
            </p>
          </section>

          <p className="rounded-xl bg-slate-50 p-3 text-xs text-muted">
            This is draft wording for the FixFlow project. Have your institution
            review it before using the application with real users.
          </p>
        </div>

        <footer className="flex justify-end border-t border-line px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}