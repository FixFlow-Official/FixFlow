const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientRef",
      index: true,
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
      enum: ["assigned", "reassigned", "status", "message"],
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

module.exports = mongoose.model("notification", notificationSchema);
