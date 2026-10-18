const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
    },
    userType: {
      type: String,
      required: [true, "User type is required"],
      enum: ["student", "staff", "admin"],
    },
    purpose: {
      type: String,
      enum: ["registration", "password-reset"],
      default: "registration",
      required: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    otpHash: {
      type: String,
      required: [true, "Otp Hash is required"],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    
  },
  {
    timestamps: true,
  },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpSchema.index(
  { userId: 1, userType: 1, purpose: 1 },
  { unique: true },
);

const otpModel = mongoose.model("otp", otpSchema);

module.exports = otpModel;
