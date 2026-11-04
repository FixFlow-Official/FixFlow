const mongoose = require("mongoose");

const slaPolicySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Electrical", "Plumbing", "Cleaning", "Internet", "Furniture", "Other"],
      required: true,
      unique: true,
    },
    responseHours: { type: Number, min: 1, max: 720, required: true },
    resolutionHours: { type: Number, min: 1, max: 2160, required: true },
    reminderBeforeHours: { type: Number, min: 0, max: 168, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "admin", default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("slaPolicy", slaPolicySchema);
