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
    // Keep report ownership visible if an administrator later removes the account.
    userSnapshot: {
      name: { type: String, default: null },
      campusId: { type: String, default: null },
      email: { type: String, default: null },
      role: { type: String, enum: ["student", "staff", "admin"], default: null },
    },
    assignedStaffSnapshot: {
      name: { type: String, default: null },
      campusId: { type: String, default: null },
      department: { type: String, default: null },
    },
    resolvedBySnapshot: {
      name: { type: String, default: null },
      campusId: { type: String, default: null },
      department: { type: String, default: null },
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
    aiTriage: {
      suggestedCategory: { type: String, enum: ["Electrical", "Plumbing", "Cleaning", "Internet", "Furniture", "Other"], default: null },
      priority: { type: String, enum: ["P1", "P2", "P3", "P4"], default: null },
      urgency: { type: String, enum: ["Critical", "High", "Normal", "Low"], default: null },
      confidence: { type: Number, min: 0, max: 1, default: null },
      summary: { type: String, maxlength: 280, default: null },
      missingInformation: { type: [String], default: [] },
      safetyConcern: { type: Boolean, default: false },
      relatedOpenReports: { type: Number, min: 0, default: 0 },
      rationale: { type: String, maxlength: 280, default: null },
      provider: { type: String, enum: ["gemini", "rules"], default: null },
      reviewSignal: { type: String, enum: ["actionable", "needs_details", "check_relevance"], default: "needs_details" },
      reviewSignalReason: { type: String, maxlength: 240, default: "" },
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
    // SLA deadlines are snapshotted when submitted so later policy edits do not
    // silently change the promise already shown to a student.
    slaResponseDueAt: { type: Date, default: null },
    slaResolutionDueAt: { type: Date, default: null },
    slaFirstRespondedAt: { type: Date, default: null },
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
        changedBySnapshot: {
          name: { type: String, default: null },
          campusId: { type: String, default: null },
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
        authorSnapshot: {
          name: { type: String, default: null },
          campusId: { type: String, default: null },
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

// Support student complaint history, admin queues, and staff workload lists.
complaintSchema.index({ userRef: 1, user: 1, createdAt: -1 });
complaintSchema.index({ userRef: 1, user: 1, status: 1, createdAt: -1 });
complaintSchema.index({ userRef: 1, createdAt: -1 });
complaintSchema.index({
  userRef: 1,
  assignedStaff: 1,
  status: 1,
  createdAt: -1,
});
complaintSchema.index({ userRef: 1, assignedStaff: 1, updatedAt: -1 });
complaintSchema.index({
  userRef: 1,
  assignedStaff: 1,
  status: 1,
  updatedAt: -1,
});
complaintSchema.index({ status: 1, slaResponseDueAt: 1, slaFirstRespondedAt: 1 });
complaintSchema.index({ status: 1, slaResolutionDueAt: 1 });
complaintSchema.index({ "aiTriage.priority": 1, status: 1, createdAt: -1 });

const complaintModel = mongoose.model("complaint", complaintSchema);

module.exports = complaintModel;
