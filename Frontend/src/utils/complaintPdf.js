import { formatDate, formatStatus } from "./complaintConfig.js";

// Escape user-controlled content before adding it to the PDF report.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

// Build and directly download a PDF report for one complaint.
export async function downloadComplaintPdf(complaint) {
  const history = [...(complaint.statusHistory ?? [])].sort(
    (first, second) =>
      new Date(first.changedAt).getTime() -
      new Date(second.changedAt).getTime(),
  );

  const historyHtml = history.length
    ? history
        .map((entry) => {
          return (
            '<article class="history-entry"><strong>' +
            escapeHtml(formatStatus(entry.status)) +
            "</strong><time>" +
            escapeHtml(formatDate(entry.changedAt)) +
            "</time>" +
            (entry.note ? "<p>" + escapeHtml(entry.note) + "</p>" : "") +
            "</article>"
          );
        })
        .join("")
    : "<p>No status updates are available.</p>";

  const submittedProofHtml = complaint.complaintPictureUrl
    ? '<img class="proof-image" crossorigin="anonymous" src="' +
      escapeHtml(complaint.complaintPictureUrl) +
      '" alt="Submitted complaint proof" />'
    : "<p>No submitted proof photo is available.</p>";

  const resolutionProofHtml = complaint.resolutionProofUrl
    ? '<img class="proof-image" crossorigin="anonymous" src="' +
      escapeHtml(complaint.resolutionProofUrl) +
      '" alt="Resolution proof" />'
    : "";

  const resolutionHtml =
    complaint.status === "Resolved"
      ? '<section class="resolution"><h2>Resolution details</h2><p>' +
        escapeHtml(complaint.resolutionNote || "No resolution note available.") +
        "</p><p><strong>Resolved by:</strong> " +
        escapeHtml(complaint.resolvedBy?.username || complaint.resolvedBySnapshot?.name || "Staff member") +
        "</p><p><strong>Resolved at:</strong> " +
        escapeHtml(formatDate(complaint.resolvedAt)) +
        "</p>" +
        resolutionProofHtml +
        "</section>"
      : "";

  const html = [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>FixFlow complaint report</title>",
    "<style>",
    "*{box-sizing:border-box}",
    "body{margin:0;padding:36px;color:#172b27;font:14px/1.6 Arial,sans-serif}",
    "main{max-width:800px;margin:0 auto}",
    "header{padding-bottom:18px;border-bottom:2px solid #246b5b}",
    "h1{margin:8px 0;font-size:26px;line-height:1.25}",
    "h2{margin:26px 0 10px;font-size:17px}",
    "p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".brand{color:#246b5b;font-size:28px;font-weight:800;letter-spacing:-.5px}",
    ".muted{color:#64736f}",
    ".status{display:inline-block;padding:4px 10px;border-radius:999px;background:#e8f3ef;color:#246b5b;font-weight:700}",
    ".details{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;border:1px solid #dce5e1;border-radius:12px}",
    ".label{display:block;color:#64736f;font-size:12px}",
    ".value{font-weight:600;overflow-wrap:anywhere}",
    ".proof-image{display:block;max-width:100%;max-height:440px;margin-top:10px;border:1px solid #dce5e1;border-radius:10px;object-fit:contain}",
    ".report-label{margin:4px 0 0;color:#64736f;font-size:10px;font-weight:700;letter-spacing:1.5px}",
    ".history-entry{margin:0 0 12px;padding:10px 12px;border-left:3px solid #246b5b;background:#f4f7f6}",
    ".history-entry time{display:block;color:#64736f;font-size:12px}",
    ".resolution{padding:14px;border:1px solid #b8dfce;border-radius:12px;background:#f0faf5}",
    "@media print{body{padding:0}.details,.resolution,.history-entry{break-inside:avoid}h2{break-after:avoid}}",
    "@media(max-width:600px){body{padding:18px}.details{grid-template-columns:1fr}}",
    "</style></head><body><main>",
    '<header><div class="brand">FixFlow</div><p class="report-label">OFFICIAL CAMPUS COMPLAINT REPORT</p><h1>' +
      escapeHtml(complaint.complaintTitle) +
      '</h1><p class="status">' +
      escapeHtml(formatStatus(complaint.status)) +
      '</p><p class="muted">Report generated ' +
      escapeHtml(formatDate(new Date())) +
      "</p></header>",
    "<section><h2>Complaint details</h2><p>" +
      escapeHtml(complaint.complaintDescription) +
      '</p><div class="details">',
    '<div><span class="label">Category</span><span class="value">' +
      escapeHtml(complaint.category || "Not available") +
      "</span></div>",
    '<div><span class="label">Building</span><span class="value">' +
      escapeHtml(complaint.location?.building || "Not available") +
      "</span></div>",
    '<div><span class="label">Room</span><span class="value">' +
      escapeHtml(complaint.location?.room || "Not provided") +
      "</span></div>",
    '<div><span class="label">Submitted</span><span class="value">' +
      escapeHtml(formatDate(complaint.createdAt)) +
      "</span></div>",
    '<div><span class="label">Student</span><span class="value">' +
      escapeHtml(complaint.user?.username || complaint.userSnapshot?.name || "Student") +
      (complaint.user?.rollno || complaint.userSnapshot?.campusId
        ? " · " + escapeHtml(complaint.user?.rollno || complaint.userSnapshot?.campusId)
        : "") +
      "</span></div>",
    '<div><span class="label">Assigned staff</span><span class="value">' +
      escapeHtml(complaint.assignedStaff?.username || complaint.assignedStaffSnapshot?.name || "Staff member") +
      "</span></div>",
    '<div><span class="label">Department</span><span class="value">' +
      escapeHtml(complaint.assignedDepartment || "Not assigned") +
      "</span></div></div></section>",
    "<section><h2>Submitted proof</h2>" +
      submittedProofHtml +
      "</section>",
    resolutionHtml,
    "<section><h2>Status history</h2>" +
      historyHtml +
      "</section></main></body></html>",
  ].join("");

  const parsedDocument = new DOMParser().parseFromString(html, "text/html");
  const reportContent = parsedDocument.body.querySelector("main");
  const reportStyles = parsedDocument.head.querySelector("style");
  const report = document.createElement("div");

  report.className = "fixflow-pdf-export";

  // Keep the export element in normal flow so html2pdf measures its height.
  report.style.cssText =
    "position:relative;display:block;width:794px;min-height:1px;margin:0 auto;background:#fff;z-index:9999;";

  report.innerHTML =
    (reportStyles?.outerHTML || "") + (reportContent?.outerHTML || "");

  document.body.appendChild(report);

  try {
    // The PDF engine is large; load it only when a user requests a PDF export.
    const { default: html2pdf } = await import("html2pdf.js");

    // Wait for proof images to load before creating the PDF.
    const images = Array.from(report.querySelectorAll("img"));

    await Promise.all(
      images.map((image) => {
        image.crossOrigin = "anonymous";

        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }),
    );

    const safeTitle = (complaint.complaintTitle || "complaint")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    // Generate and download the PDF without opening a new browser window.
    await html2pdf()
      .set({
        margin: [10, 10, 12, 10],
        filename: `FixFlow-${safeTitle || "complaint"}.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 900,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(report)
      .save();
  } catch (error) {
    console.error("Could not generate the complaint PDF:", error);

    window.alert(
      `Could not download the complaint PDF: ${
        error?.message || "Unknown error"
      }`,
    );
  } finally {
    report.remove();
  }
}
