const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientRef",
    },
    recipientRef: {
      type: String,
      enum: ["student", "staff", "admin"],
      required: true,
    },
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "complaint",
      required: true,
    },
    complaintTitle: { type: String, required: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["submitted", "assigned", "reassigned", "status", "message", "sla_reminder", "sla_escalation"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 300 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientRef: 1, recipient: 1, createdAt: -1 });
notificationSchema.index({ recipientRef: 1, recipient: 1, readAt: 1 });

// Keep notification storage bounded; complaint records and audit history are retained.
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60, name: "notification_retention_ttl" },
);

module.exports = mongoose.model("notification", notificationSchema);
