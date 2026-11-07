import { useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Printer, QrCode, X } from "lucide-react";
import { generateQrDataUrl, generateRoomReportUrl } from "../../utils/qrCode.js";

export default function RoomQrModal({
  buildingName,
  buildingCode,
  floorName = "Ground Floor",
  room,
  rooms = [], // optional for batch printing
  onClose,
}) {
  const [qrMap, setQrMap] = useState({});
  const [loading, setLoading] = useState(true);

  // If a single room is provided, wrap into an array; otherwise use the batch rooms array
  const targetRooms = useMemo(() => {
    return rooms.length > 0 ? rooms : room ? [room] : [];
  }, [rooms, room]);

  useEffect(() => {
    let active = true;
    async function generateAll() {
      setLoading(true);
      const results = {};
      for (const rm of targetRooms) {
        const url = generateRoomReportUrl({
          building: buildingName,
          floor: floorName,
          room: rm,
        });
        try {
          results[rm] = await generateQrDataUrl(url, { width: 340 });
        } catch (err) {
          console.error(`Failed to generate QR for room ${rm}:`, err);
        }
      }
      if (active) {
        setQrMap(results);
        setLoading(false);
      }
    }
    generateAll();
    return () => {
      active = false;
    };
  }, [buildingName, floorName, targetRooms]);

  function handlePrint() {
    window.print();
  }

  function handleDownloadSingle(rm, dataUrl) {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    const safeRoom = String(rm).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeBuilding = String(buildingCode || buildingName).replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `FixFlow_QR_${safeBuilding}_${safeRoom}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Door QR Code Plaque"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl print:max-h-none print:w-full print:max-w-none print:border-none print:shadow-none">
        {/* Header (hidden in print) */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 print:hidden">
          <div className="flex items-center gap-2.5 text-brand">
            <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <QrCode size={19} />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">
                Classroom & Lab Door QR Codes
              </h2>
              <p className="text-xs text-muted">
                Scan-to-Report printable stickers for facility issues
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95 disabled:opacity-50"
            >
              <Printer size={14} />
              Print Plaque
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close QR Modal"
              className="grid size-9 place-items-center rounded-xl border border-line text-muted transition hover:bg-canvas hover:text-ink"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="assistant-voice-scroll overflow-y-auto p-6 print:p-0">
          {loading ? (
            <div className="grid min-h-[300px] place-items-center text-sm font-semibold text-muted">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={20} className="animate-spin text-brand" />
                Generating high-resolution QR plaques…
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2 print:gap-8">
              {targetRooms.map((rm) => {
                const qrUrl = qrMap[rm];
                return (
                  <div
                    key={rm}
                    className="flex flex-col items-center justify-between rounded-2xl border-2 border-emerald-900/20 bg-gradient-to-b from-white via-white to-emerald-50/40 p-6 text-center shadow-md print:break-inside-avoid print:border-2 print:border-black print:shadow-none"
                  >
                    {/* Header badge */}
                    <div className="flex w-full items-center justify-between border-b border-emerald-900/10 pb-3 text-left">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                          FixFlow Campus Support
                        </span>
                        <h3 className="font-display text-sm font-bold text-ink">
                          {buildingName}
                        </h3>
                      </div>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 print:border print:border-black">
                        {floorName}
                      </span>
                    </div>

                    {/* Room title */}
                    <div className="my-3">
                      <span className="text-[11px] font-semibold text-muted">
                        Room / Facility
                      </span>
                      <h4 className="font-display text-2xl font-black tracking-tight text-ink">
                        {rm}
                      </h4>
                    </div>

                    {/* QR Code Graphic */}
                    <div className="relative my-2 rounded-2xl border border-line bg-white p-3 shadow-inner">
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt={`Scan QR Code to report issue in ${rm}`}
                          className="size-48 object-contain sm:size-52"
                        />
                      ) : (
                        <div className="grid size-48 place-items-center text-xs text-muted">
                          QR not available
                        </div>
                      )}
                    </div>

                    {/* Scan Instructions */}
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      📷 <strong>Scan with Phone Camera</strong> to file a campus complaint here with location pre-filled.
                    </p>

                    {/* Action buttons (hidden in print) */}
                    <div className="mt-4 flex items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(rm, qrUrl)}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-xs transition hover:bg-canvas"
                      >
                        <Download size={13} />
                        Download PNG
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
