const mongoose = require("mongoose");

const broadcastCategories = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Internet",
  "Furniture",
  "Other",
];

const broadcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters."],
    },
    message: {
      type: String,
      required: [true, "Message is required."],
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters."],
    },
    category: {
      type: String,
      required: [true, "Category is required."],
      enum: {
        values: broadcastCategories,
        message: "Invalid broadcast category.",
      },
    },
    buildings: {
      type: [String],
      default: [], // Empty array = whole campus
    },
    startsAt: {
      type: Date,
      required: [true, "Start time is required."],
    },
    endsAt: {
      type: Date,
      required: [true, "End time is required."],
      validate: {
        validator: function (value) {
          if (!this.startsAt || !value) return true;
          return new Date(value).getTime() > new Date(this.startsAt).getTime();
        },
        message: "End time must be after start time.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "admin",
      required: [true, "Creator admin reference is required."],
    },
  },
  {
    timestamps: true,
  },
);

broadcastSchema.index({ isActive: 1, endsAt: 1 });
broadcastSchema.index({ category: 1, isActive: 1 });

const broadcastModel = mongoose.model("broadcast", broadcastSchema);

module.exports = {
  broadcastModel,
  broadcastCategories,
};
