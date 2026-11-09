import QRCode from "qrcode";

/**
 * Builds the canonical scan-to-report URL for a specific campus room/lab door.
 */
export function generateRoomReportUrl({
  building,
  floor,
  room,
  origin = typeof window !== "undefined" ? window.location.origin : "https://fixflow.campus",
}) {
  const params = new URLSearchParams();
  if (building) params.set("building", building);
  if (floor) params.set("floor", floor);
  if (room) params.set("room", room);
  params.set("source", "qr_door");
  return `${origin}/report?${params.toString()}`;
}

/**
 * Parses building, floor, and room parameters from a URL or query string.
 */
export function parseRoomReportUrl(urlOrSearch) {
  if (!urlOrSearch) return null;
  try {
    let search = urlOrSearch;
    if (urlOrSearch.includes("?")) {
      search = urlOrSearch.slice(urlOrSearch.indexOf("?"));
    }
    const params = new URLSearchParams(search);
    const building = params.get("building") || "";
    const floor = params.get("floor") || "";
    const room = params.get("room") || "";
    const source = params.get("source") || "";

    if (!building && !room) return null;
    return { building, floor, room, source };
  } catch {
    return null;
  }
}

/**
 * Generates a high-resolution QR code data URL (PNG) from text.
 */
export async function generateQrDataUrl(text, options = {}) {
  if (!text) throw new Error("Text is required to generate a QR code.");
  return QRCode.toDataURL(text, {
    width: options.width || 360,
    margin: options.margin !== undefined ? options.margin : 2,
    color: {
      dark: options.darkColor || "#134e4a", // FixFlow deep brand teal
      light: options.lightColor || "#ffffff",
    },
    errorCorrectionLevel: options.errorCorrectionLevel || "H", // High redundancy for scannability
  });
}
