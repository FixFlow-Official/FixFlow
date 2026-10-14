const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userRef",
      required:true
    },
    userRef: {
      type: String,
      enum: ["student", "staff", "admin"],
      required: [true, "UserRef is required"],
    },
    refreshTokenHash: {
      type: String,
      required: [true, "RefreshTokenHash is required"],
    },
    ip: {
      type: String,
      required: [true, "IP address is required"],
    },
    userAgent: {
      type: String,
      required: [true, "UserAgent is required"],
    },
    revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const sessionModel = mongoose.model("session", sessionSchema);

module.exports = sessionModel;
