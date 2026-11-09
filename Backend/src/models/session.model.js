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
    previousRefreshTokenHash: {
      type: String,
      default: null,
    },
    rotatedAt: {
      type: Date,
      default: null,
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
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Mongo's TTL monitor removes expired sessions asynchronously; auth queries
// also enforce expiresAt so an expired session is rejected immediately.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userRef: 1, user: 1, revoked: 1, expiresAt: 1 });

const sessionModel = mongoose.model("session", sessionSchema);

module.exports = sessionModel;
