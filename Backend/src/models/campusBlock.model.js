const mongoose = require("mongoose");

const campusBlockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Building name is required"],
      trim: true,
      maxlength: 120,
    },
    shortName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      default: "",
    },
    category: {
      type: String,
      enum: ["Academic", "Lab", "Administrative", "Amenities", "Sports", "Other"],
      default: "Academic",
    },
    accentColor: {
      type: String,
      enum: ["emerald", "blue", "purple", "amber", "rose", "cyan", "indigo"],
      default: "emerald",
    },
    floors: [
      {
        name: {
          type: String,
          required: [true, "Floor name is required"],
          trim: true,
          maxlength: 50,
        },
        rooms: {
          type: [String],
          default: [],
        },
      },
    ],
    departments: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

campusBlockSchema.index({ name: 1 });
campusBlockSchema.index({ code: 1 });
campusBlockSchema.index({ isActive: 1 });

module.exports = mongoose.model("campus_block", campusBlockSchema);
