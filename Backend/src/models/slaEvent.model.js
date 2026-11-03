const mongoose = require("mongoose");

const slaEventSchema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true, unique: true },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: "complaint", required: true },
    complaintTitle: { type: String, required: true, maxlength: 120 },
    category: { type: String, required: true },
    type: {
      type: String,
      enum: ["response_reminder", "response_overdue", "resolution_reminder", "resolution_overdue"],
      required: true,
    },
    description: { type: String, required: true, maxlength: 300 },
    dueAt: { type: Date, required: true },
  },
  { timestamps: true },
);

slaEventSchema.index({ complaint: 1, createdAt: -1 });
slaEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("slaEvent", slaEventSchema);
