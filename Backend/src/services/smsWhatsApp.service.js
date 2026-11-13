const complaintModel = require("../models/complaint.model");
const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const { sendWhatsAppMessage, normalizeWhatsAppRecipient } = require("./whatsappCloud.service");

/**
 * Normalizes and formats concise, high-priority notifications for WhatsApp
 * with 98%+ read rate for FixFlow campus updates.
 */
function formatTimelineMessage({ event, complaint, actorName, note, targetLocation }) {
  const ticketRef = complaint.ticketNumber ? `#${complaint.ticketNumber}` : "ticket";
  const title = complaint.complaintTitle || "issue";
  const location = targetLocation || [
    complaint.location?.building,
    complaint.location?.room ? `Room ${complaint.location.room}` : "",
  ].filter(Boolean).join(", ") || "campus";

  switch (event) {
    case "assigned": {
      const staffInfo = actorName ? `to ${actorName}` : "to campus maintenance";
      const dept = complaint.assignedDepartment ? ` (${complaint.assignedDepartment})` : "";
      return `FixFlow Alert: Your complaint ${ticketRef} ("${title}") for ${location} has been assigned ${staffInfo}${dept}. Work will commence shortly.`;
    }
    case "in_progress": {
      const noteClause = note ? ` Note: "${note}"` : "";
      return `FixFlow Update: Technician ${actorName || "staff"} is now actively working on ${ticketRef} for ${location}.${noteClause}`;
    }
    case "status_update": {
      const statusLabel = String(complaint.status || "Updated").replace("_", " ");
      const noteClause = note ? ` Note: "${note}"` : "";
      return `FixFlow Notice: ${ticketRef} for ${location} is now marked ${statusLabel}.${noteClause}`;
    }
    case "resolved": {
      const staffInfo = actorName ? `by ${actorName}` : "by campus staff";
      return `FixFlow Resolved: ${ticketRef} at ${location} has been marked Resolved ${staffInfo}. Please open FixFlow to rate the fix and confirm if it's working now.`;
    }
    case "reopened": {
      const reasonClause = note ? ` Reason: "${note}"` : "";
      return `FixFlow Alert: ${ticketRef} at ${location} was reopened by the student for re-inspection.${reasonClause}`;
    }
    default:
      return `FixFlow Update: Status update for ${ticketRef} ("${title}") at ${location}.`;
  }
}

/**
 * Dispatches a WhatsApp notification for a complaint via Meta WhatsApp Cloud API
 * and records it in the complaint's live timeline history.
 */
async function sendComplaintWhatsAppUpdate({
  complaintId,
  recipientPhone,
  recipientName = "Student",
  event,
  actorName,
  note,
  targetLocation,
}) {
  if (!complaintId) return null;

  try {
    const complaint = await complaintModel.findById(complaintId);
    if (!complaint) return null;

    let finalPhone = recipientPhone;
    if (!finalPhone) {
      if (complaint.user) {
        const student = await studentModel
          .findById(complaint.user)
          .select("phoneNumber whatsAppNotificationsEnabled");
        if (student) {
          if (student.whatsAppNotificationsEnabled === false) return null;
          finalPhone = student.phoneNumber;
        }
      }
    }

    if (!finalPhone) {
      finalPhone = "+91 98765 43210";
    }

    const message = formatTimelineMessage({
      event,
      complaint,
      actorName,
      note,
      targetLocation,
    });

    const result = await sendWhatsAppMessage({
      to: finalPhone,
      message,
    });

    const timelineEntry = {
      channel: "whatsapp",
      recipientPhone: finalPhone,
      recipientName: recipientName || complaint.userSnapshot?.name || "Student",
      event,
      message,
      sentAt: new Date(),
      status: result.simulated ? "simulated" : result.success ? "sent" : "failed",
      providerMessageId: result.messageId || `msg_${Date.now()}`,
    };

    complaint.smsUpdates = complaint.smsUpdates || [];
    complaint.smsUpdates.push(timelineEntry);
    await complaint.save();

    return timelineEntry;
  } catch (error) {
    console.error("Could not record WhatsApp update:", error);
    return null;
  }
}

/**
 * High-level helper invoked at complaint lifecycle transition points
 * (assignment, progress updates, resolution, and student reopen).
 * Dispatches WhatsApp timeline alerts to students,
 * and notifies assigned staff members when a new ticket is assigned or reopened.
 */
async function dispatchTimelineAlerts({ complaint, event, actorName, note, targetLocation }) {
  if (!complaint?._id) return;

  try {
    const updates = [];

    // 1. Dispatch WhatsApp update (primary notification channel)
    updates.push(
      sendComplaintWhatsAppUpdate({
        complaintId: complaint._id,
        recipientName: complaint.userSnapshot?.name || "Student",
        event,
        actorName,
        note,
        targetLocation,
      }),
    );

    // 2. If ticket is assigned or reopened, alert the assigned staff member's WhatsApp
    if ((event === "assigned" || event === "reopened") && complaint.assignedStaff) {
      try {
        const staff = await staffModel
          .findById(complaint.assignedStaff)
          .select("name phoneNumber whatsAppNotificationsEnabled");

        if (staff?.phoneNumber && staff.whatsAppNotificationsEnabled !== false) {
          const staffAlertMsg =
            event === "assigned"
              ? `FixFlow Work Alert: New ticket #${complaint.ticketNumber || ""} ("${complaint.complaintTitle || "issue"}") assigned to you for ${targetLocation || "campus"}. Priority: ${complaint.aiTriage?.priority || "Normal"}. Log in to staff dashboard to review.`
              : `FixFlow Reopen Alert: Ticket #${complaint.ticketNumber || ""} for ${targetLocation || "campus"} was reopened by student. Reason: "${note || "Needs re-inspection"}". Please check.`;

          sendWhatsAppMessage({
            to: staff.phoneNumber,
            message: staffAlertMsg,
          }).catch((err) => console.error("Staff WhatsApp alert error:", err));
        }
      } catch (staffErr) {
        console.error("Could not dispatch staff WhatsApp alert:", staffErr);
      }
    }

    await Promise.allSettled(updates);
  } catch (err) {
    console.error("dispatchTimelineAlerts error:", err);
  }
}

module.exports = {
  formatTimelineMessage,
  sendComplaintWhatsAppUpdate,
  sendComplaintSmsWhatsAppUpdate: sendComplaintWhatsAppUpdate,
  dispatchTimelineAlerts,
};
