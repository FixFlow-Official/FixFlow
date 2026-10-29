const mongoose = require("mongoose");

const campusDirectorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["student", "staff", "admin"],
      required: true,
    },
    campusId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    course: { type: String, trim: true, maxlength: 100 },
    department: { type: String, trim: true, maxlength: 100 },
    designation: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true },
);

// Campus IDs are unique within an account type. Email uniqueness remains
// enforced by the account model and by admin directory-entry validation.
campusDirectorySchema.index({ type: 1, campusId: 1 }, { unique: true });
campusDirectorySchema.index({ type: 1, email: 1 });

module.exports = mongoose.model("campusDirectory", campusDirectorySchema);
