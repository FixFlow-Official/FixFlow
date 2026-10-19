const mongoose = require("mongoose");

const complaintStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
  "Resolved",
  "Rejected",
  "Closed",
  "Withdrawn",
];

const complaintSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userRef",
      required: [true, "User is required"],
    },
    userRef: {
      type: String,
      enum: ["student", "staff", "admin"],
      required: [true, "UserRef is required"],
    },
    complaintPictureUrl: {
      type: String,
      required: [true, "ComplaintPictureUrl is required"],
    },
    resolutionProofUrl: {
      type: String,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      default: null,
    },
    complaintTitle: {
      type: String,
      required: [true, "Complaint Title is required"],
    },
    complaintDescription: {
      type: String,
      required: [true, "Complaint Description is required"],
    },

    category: {
      type: String,
      enum: [
        "Electrical",
        "Plumbing",
        "Cleaning",
        "Internet",
        "Furniture",
        "Other",
      ],
      required: [true, "Complaint category is required"],
    },
    location: {
      building: {
        type: String,
        required: [true, "Building is required"],
        trim: true,
      },
      room: {
        type: String,
        trim: true,
        default: "",
      },
    },
    status: {
      type: String,
      enum: complaintStatuses,
      default: "Submitted",
    },
    assignedDepartment: {
      type: String,
      trim: true,
      default: null,
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      default: null,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: complaintStatuses,
          required: true,
        },
        note: {
          type: String,
          trim: true,
          default: "",
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },
        changedByRole: {
          type: String,
          enum: ["student", "staff", "admin"],
          default: null,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        author: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        authorRole: {
          type: String,
          enum: ["student", "staff", "admin"],
          required: true,
        },
        message: {
          type: String,
          trim: true,
          required: true,
          maxlength: 1000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    rejectedReason: {
      type: String,
      default: null,
    },
    onHoldReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const complaintModel = mongoose.model("complaint", complaintSchema);

module.exports = complaintModel;
