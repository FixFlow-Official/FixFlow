const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
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
    endpoint: { type: String, required: true, unique: true, maxlength: 2048 },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

pushSubscriptionSchema.index({ recipientRef: 1, recipient: 1 });

module.exports = mongoose.model("pushSubscription", pushSubscriptionSchema);
