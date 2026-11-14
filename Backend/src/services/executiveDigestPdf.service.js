const PDFDocument = require("pdfkit");

/**
 * Draws a clean, styled data table on the PDF document.
 */
function drawTable(doc, { headers, rows, colWidths, startX = 40, startY, headerBg = "#f1f5f9" }) {
  let y = startY || doc.y;
  const rowHeight = 22;
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

  // Draw header background
  doc.rect(startX, y, totalWidth, rowHeight).fill(headerBg);

  // Draw header text
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#334155");
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 5, y + 6, {
      width: colWidths[i] - 10,
      align: i >= 2 ? "right" : "left",
    });
    x += colWidths[i];
  }

  y += rowHeight;

  // Draw rows
  doc.font("Helvetica").fontSize(8).fillColor("#1e293b");

  if (!rows || rows.length === 0) {
    doc.rect(startX, y, totalWidth, rowHeight).strokeColor("#e2e8f0").stroke();
    doc.fillColor("#64748b").text("No data available in this reporting period.", startX + 5, y + 6, {
      width: totalWidth - 10,
      align: "center",
    });
    y += rowHeight;
    doc.y = y + 10;
    return;
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isAlt = r % 2 === 1;

    if (isAlt) {
      doc.rect(startX, y, totalWidth, rowHeight).fill("#f8fafc");
    }

    doc.rect(startX, y, totalWidth, rowHeight).strokeColor("#e2e8f0").stroke();

    x = startX;
    doc.fillColor("#0f172a");
    for (let c = 0; c < row.length; c++) {
      const val = row[c] === null || row[c] === undefined ? "—" : String(row[c]);
      doc.text(val, x + 5, y + 6, {
        width: colWidths[c] - 10,
        align: c >= 2 ? "right" : "left",
      });
      x += colWidths[c];
    }

    y += rowHeight;
  }

  doc.y = y + 10;
}

/**
 * Generates an executive 2-3 page PDF report buffer from digest data.
 * @param {Object} digest - Executive digest payload.
 * @returns {Promise<Buffer>}
 */
function generateExecutiveDigestPdf(digest = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const summary = digest.summary || {};
      const periodLabel = digest.periodLabel || "Last 7 Days";

      // ================= PAGE 1 =================
      // Top header banner
      doc.rect(40, 40, 515, 60).fill("#0284c7");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text("FixFlow Campus Facilities", 55, 52);
      doc.fontSize(12).font("Helvetica").text("Weekly Executive Facility & SLA Performance Digest", 55, 75);

      // Period & metadata row
      doc.y = 115;
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(10).text("REPORTING PERIOD:", 40, 115);
      doc.font("Helvetica").fillColor("#0f172a").text(periodLabel, 160, 115);

      const generatedStr = digest.generatedAt
        ? new Date(digest.generatedAt).toUTCString()
        : new Date().toUTCString();
      doc.font("Helvetica-Bold").fillColor("#64748b").text("GENERATED:", 340, 115);
      doc.font("Helvetica").fillColor("#0f172a").text(generatedStr, 415, 115, { width: 140 });

      // KPI boxes
      const kpiY = 145;
      const boxW = 98;
      const boxH = 50;

      const kpis = [
        { label: "Total Complaints", val: String(summary.total ?? 0), n: `n=${summary.total ?? 0}` },
        { label: "Resolved", val: String(summary.resolved ?? 0), n: `n=${summary.resolved ?? 0}` },
        {
          label: "MTTR (Mean Time)",
          val: summary.avgResolutionHours !== null ? `${summary.avgResolutionHours}h` : "—",
          n: summary.avgResolutionHours !== null ? `n=${summary.resolved}` : "No resolved tickets",
        },
        {
          label: "SLA Breach Rate",
          val: summary.overallSlaBreachRate !== null ? `${summary.overallSlaBreachRate}%` : "0%",
          n: `n=${summary.total ?? 0}`,
        },
        {
          label: "Campus CSAT",
          val: summary.avgCsat !== null ? `${summary.avgCsat} ★` : "—",
          n: summary.avgCsat !== null ? `n=${summary.resolved}` : "No ratings",
        },
      ];

      for (let i = 0; i < kpis.length; i++) {
        const bx = 40 + i * (boxW + 6.2);
        doc.rect(bx, kpiY, boxW, boxH).fillAndStroke("#f8fafc", "#cbd5e1");
        doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7.5).text(kpis[i].label, bx + 4, kpiY + 6, { width: boxW - 8, align: "center" });
        doc.fillColor("#0284c7").font("Helvetica-Bold").fontSize(13).text(kpis[i].val, bx + 4, kpiY + 20, { width: boxW - 8, align: "center" });
        doc.fillColor("#94a3b8").font("Helvetica").fontSize(6.5).text(kpis[i].n, bx + 4, kpiY + 36, { width: boxW - 8, align: "center" });
      }

      // Section 1: MTTR by Department
      doc.y = 215;
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("1. Department MTTR & Resolution Performance");
      doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("Department workload, mean resolution duration, first response latency, and breach counts.");
      doc.y += 6;

      const deptHeaders = ["Department", "Total", "Resolved", "MTTR (h)", "First Resp (h)", "Breach %"];
      const deptColWidths = [155, 65, 65, 75, 85, 70];
      const deptRows = (digest.mttrByDepartment || []).map((d) => [
        d.department,
        d.total,
        d.resolved,
        d.avgResolutionHours !== null ? `${d.avgResolutionHours}h` : "—",
        d.avgFirstResponseHours !== null ? `${d.avgFirstResponseHours}h` : "—",
        d.slaBreachRate !== null ? `${d.slaBreachRate}%` : "—",
      ]);

      drawTable(doc, {
        headers: deptHeaders,
        rows: deptRows,
        colWidths: deptColWidths,
        startY: doc.y + 4,
      });

      // Section 2: SLA Breach Heatmap (Top Locations)
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("2. Top Facility SLA Breach Locations");
      doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("Campus buildings and departments with highest unresolved or late resolution breach rates.");
      doc.y += 6;

      const breachHeaders = ["Building", "Department", "Breach Count", "Total Tickets", "Breach Rate %"];
      const breachColWidths = [160, 115, 80, 80, 80];
      const breachRows = (digest.slaBreachHeatmap || []).map((b) => [
        b.building,
        b.department,
        b.breachCount,
        b.total,
        b.breachRate !== null ? `${b.breachRate}%` : "—",
      ]);

      drawTable(doc, {
        headers: breachHeaders,
        rows: breachRows,
        colWidths: breachColWidths,
        startY: doc.y + 4,
      });

      // ================= PAGE 2 =================
      doc.addPage();

      // Section 3: Technician Efficiency Table
      doc.y = 45;
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("3. Technician Workload & Performance");
      doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("Top technicians and slower MTTR resolution times requiring operational load re-balancing.");
      doc.y += 6;

      const techHeaders = ["Technician", "Department", "Assigned", "Resolved", "Ack (h)", "MTTR (h)", "CSAT"];
      const techColWidths = [140, 95, 55, 55, 55, 65, 50];
      const techRows = (digest.technicianEfficiency || []).map((t) => [
        t.name,
        t.department,
        t.assigned,
        t.resolved,
        t.avgAcknowledgeHours !== null ? `${t.avgAcknowledgeHours}h` : "—",
        t.avgResolveHours !== null ? `${t.avgResolveHours}h` : "—",
        t.avgCsat !== null ? `${t.avgCsat} ★` : "—",
      ]);

      drawTable(doc, {
        headers: techHeaders,
        rows: techRows,
        colWidths: techColWidths,
        startY: doc.y + 4,
      });

      // Section 4: CSAT & Quality Audit Summary
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("4. Student Satisfaction (CSAT) & Quality Audits");

      // Calculate low rating count across departments
      const totalLowRatings = (digest.csatByDepartment || []).reduce((sum, c) => sum + (c.lowRatingCount || 0), 0);
      doc.fillColor("#be123c").font("Helvetica-Bold").fontSize(8.5).text(
        `• Quality Audit Notice: ${totalLowRatings} complaint rating(s) scored ≤ 2 stars and flagged for facility supervisory review.`,
        40,
        doc.y + 4
      );
      doc.y += 12;

      const csatHeaders = ["Department", "Average CSAT", "Ratings Received", "Low Ratings (≤2 Stars)"];
      const csatColWidths = [185, 110, 110, 110];
      const csatRows = (digest.csatByDepartment || []).map((c) => [
        c.department,
        c.avgCsat !== null ? `${c.avgCsat} ★` : "—",
        c.ratingsCount,
        c.lowRatingCount,
      ]);

      drawTable(doc, {
        headers: csatHeaders,
        rows: csatRows,
        colWidths: csatColWidths,
        startY: doc.y + 4,
      });

      // Footer note on delivery channels
      doc.y += 10;
      doc.rect(40, doc.y, 515, 36).fillAndStroke("#f1f5f9", "#cbd5e1");
      doc.fillColor("#475569").font("Helvetica").fontSize(7.5).text(
        "Delivery Notice: Dispatched via FixFlow Automated Executive Email Service. WhatsApp delivery is currently skipped (requires production Meta WhatsApp Business Solution Provider credentials).",
        50,
        doc.y + 12,
        { width: 495, align: "center" }
      );

      // Number all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor("#94a3b8").font("Helvetica").fontSize(8).text(
          `FixFlow Facility Operations • Confidential Executive Digest • Page ${i + 1} of ${range.count}`,
          40,
          800,
          { width: 515, align: "center" }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateExecutiveDigestPdf,
};
