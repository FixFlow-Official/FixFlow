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
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    otpHash: {
      type: String,
      required: [true, "Otp Hash is required"],
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

const otpModel = mongoose.model("otp", otpSchema);

module.exports = otpModel;
