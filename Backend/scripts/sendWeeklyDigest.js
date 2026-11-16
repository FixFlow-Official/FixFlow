const mongoose = require("mongoose");
const config = require("../src/config/config");
const adminModel = require("../src/models/admin.model");
const sendEmail = require("../src/services/email.service");
const { buildExecutiveDigest } = require("../src/services/executiveDigest.service");
const { generateExecutiveDigestPdf } = require("../src/services/executiveDigestPdf.service");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the automated weekly executive facility digest PDF to all administrators
 * and additional configured DIGEST_RECIPIENTS.
 *
 * @param {Object} options
 * @param {string} [options.period="7d"] - Digest time period.
 * @param {Date} [options.now] - Optional timestamp for deterministic digest testing.
 * @returns {Promise<Object>} Summary of dispatch results and recipients list.
 */
async function sendWeeklyDigest({ period = "7d", now = new Date() } = {}) {
  // 1. Build executive metrics & digest
  const digest = await buildExecutiveDigest({ period, now });
  const summary = digest.summary || {};

  // 2. Generate PDF report buffer
  const pdfBuffer = await generateExecutiveDigestPdf(digest);

  // 3. Resolve recipient email list
  let dbAdminEmails = [];
  try {
    const admins = await adminModel.find({}).select("email").lean();
    dbAdminEmails = admins.map((a) => a.email);
  } catch (err) {
    console.warn("Could not query admin collection for digest recipients:", err.message);
  }

  const envRecipientsRaw = process.env.DIGEST_RECIPIENTS || config.DIGEST_RECIPIENTS || "";
  const envEmails = String(envRecipientsRaw)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const rawRecipients = [...dbAdminEmails, ...envEmails];

  // Filter valid emails and deduplicate; invalid emails are skipped (not fatal)
  const validRecipients = Array.from(
    new Set(
      rawRecipients
        .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter((e) => emailRegex.test(e))
    )
  );

  if (validRecipients.length === 0) {
    console.log("No valid email recipients found for weekly facility digest.");
    return {
      success: true,
      sentTo: [],
      message: "No valid recipients configured.",
      periodLabel: digest.periodLabel,
      generatedAt: digest.generatedAt,
      summary,
    };
  }

  // 4. Construct Subject and 5-bullet summary body
  const subject = `FixFlow Weekly Facility Digest — ${digest.periodLabel}`;

  const bullets = [
    `• Total Complaints: ${summary.total ?? 0} (Resolved: ${summary.resolved ?? 0})`,
    `• Campus MTTR (Mean Time to Resolve): ${summary.avgResolutionHours !== null ? `${summary.avgResolutionHours}h` : "No resolved complaints in this period"}`,
    `• Average First Response Time: ${summary.avgFirstResponseHours !== null ? `${summary.avgFirstResponseHours}h` : "N/A"}`,
    `• Overall SLA Breach Rate: ${summary.overallSlaBreachRate !== null ? `${summary.overallSlaBreachRate}%` : "0%"}`,
    `• Student Satisfaction (CSAT): ${summary.avgCsat !== null ? `${summary.avgCsat} ★` : "No ratings submitted"}`,
  ];

  const bodyText = [
    `Hello FixFlow Administrator,`,
    ``,
    `Here is your campus facility performance and SLA resolution digest for ${digest.periodLabel}:`,
    ``,
    ...bullets,
    ``,
    `Full PDF attached.`,
    ``,
    `--`,
    `FixFlow Facility Operations`,
    `Notice: WhatsApp delivery is currently skipped (requires production WhatsApp Cloud API provider).`,
  ].join("\n");

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; line-height: 1.5;">
      <div style="background-color: #0284c7; padding: 20px 24px; border-radius: 12px 12px 0 0; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">FixFlow Campus Facility Digest</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Weekly Executive Health, MTTR & SLA Report • ${digest.periodLabel}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background-color: #ffffff;">
        <p style="margin-top: 0;">Hello FixFlow Administrator,</p>
        <p>Here is your campus facility performance and SLA resolution digest for <strong>${digest.periodLabel}</strong>:</p>
        <ul style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px 16px 36px; margin: 16px 0;">
          ${bullets.map((b) => `<li style="margin-bottom: 6px;">${b.replace(/^•\s*/, "")}</li>`).join("")}
        </ul>
        <p style="font-weight: 600; color: #0284c7;">Full PDF attached.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">
          FixFlow Automated Executive Digest Service.<br />
          Notice: WhatsApp delivery is currently skipped (requires production WhatsApp Cloud API provider).
        </p>
      </div>
    </div>
  `;

  const dateSlug = new Date(digest.generatedAt).toISOString().split("T")[0];
  const attachments = [
    {
      filename: `FixFlow-Facility-Digest-${dateSlug}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ];

  // 5. Dispatch email to each recipient
  const successfullySent = [];
  for (const to of validRecipients) {
    try {
      await sendEmail({
        to,
        subject,
        text: bodyText,
        html: bodyHtml,
        attachments,
      });
      successfullySent.push(to);
    } catch (err) {
      console.error(`Failed sending weekly digest to ${to}:`, err.message);
    }
  }

  return {
    success: true,
    sentTo: successfullySent,
    periodLabel: digest.periodLabel,
    generatedAt: digest.generatedAt,
    summary,
  };
}

// Allow direct CLI invocation: `node Backend/scripts/sendWeeklyDigest.js`
if (require.main === module) {
  (async () => {
    try {
      const connectDB = require("../src/config/database");
      await connectDB();
      console.log("Connected to database. Generating and sending weekly digest...");
      const result = await sendWeeklyDigest();
      console.log(`Weekly digest finished. Sent to ${result.sentTo.length} recipients:`, result.sentTo);
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error("sendWeeklyDigest CLI execution failed:", error);
      process.exit(1);
    }
  })();
}

module.exports = {
  sendWeeklyDigest,
};
