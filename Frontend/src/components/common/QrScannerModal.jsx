import { useState } from "react";
import { Camera, CheckCircle2, Link as LinkIcon, QrCode, X } from "lucide-react";
import { parseRoomReportUrl } from "../../utils/qrCode.js";

export default function QrScannerModal({ onScan, onClose }) {
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleParse(text) {
    setError("");
    const parsed = parseRoomReportUrl(text);
    if (!parsed || (!parsed.building && !parsed.room)) {
      setError(
        "Could not detect a valid FixFlow door QR link. Make sure the link contains building and room parameters.",
      );
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      onScan(parsed);
      onClose();
    }, 400);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if ("BarcodeDetector" in window) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const img = new Image();
      img.onload = async () => {
        try {
          const barcodes = await barcodeDetector.detect(img);
          if (barcodes.length > 0) {
            handleParse(barcodes[0].rawValue);
          } else {
            setError("No QR code detected in this photo. Try snapping closer to the door plaque.");
          }
        } catch {
          setError("Failed to decode QR code. You can paste the link manually below.");
        }
      };
      img.src = URL.createObjectURL(file);
    } else {
      // Fallback message for browsers without native BarcodeDetector
      setError(
        "Direct image decoding is not supported in this browser. Please scan with your phone's native camera app or paste the link below.",
      );
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan Door QR Code"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 text-brand">
            <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <QrCode size={19} />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Scan Door QR Code</h2>
              <p className="text-xs text-muted">Auto-fill building, floor & room</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scanner"
            className="grid size-9 place-items-center rounded-xl border border-line text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-emerald-700">
              <CheckCircle2 size={40} className="text-emerald-600 animate-bounce" />
              <p className="mt-2 font-bold text-ink">Door QR Verified!</p>
              <p className="text-xs text-muted">Applying room location to your form…</p>
            </div>
          ) : (
            <>
              {/* Native Phone Camera Scan Button */}
              <div className="rounded-2xl border-2 border-dashed border-brand/30 bg-brand-soft/40 p-5 text-center">
                <Camera size={32} className="mx-auto text-brand" />
                <h3 className="mt-2 text-sm font-bold text-ink">
                  Capture Door Plaque
                </h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Snap a photo of the FixFlow door sticker or scan directly using your phone camera.
                </p>

                <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95">
                  <Camera size={15} />
                  Open Camera / Choose Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Paste scanned URL fallback */}
              <div className="border-t border-line pt-4">
                <label
                  htmlFor="qr-manual-url"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"
                >
                  <LinkIcon size={13} className="text-muted" />
                  Or paste scanned FixFlow link:
                </label>
                <div className="flex gap-2">
                  <input
                    id="qr-manual-url"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. /report?building=PG+Block&room=102"
                    className="flex-1 rounded-xl border border-line px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                  />
                  <button
                    type="button"
                    onClick={() => handleParse(manualInput)}
                    className="rounded-xl bg-ink px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand active:scale-95"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
