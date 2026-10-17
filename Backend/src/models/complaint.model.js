const mongoose = require("mongoose");

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
    complaintTitle: {
      type: String,
      required: [true, "Complaint Title is required"],
    },
    complaintDescription: {
      type: String,
      required: [true, "Complaint Description is required"],
    },
    status: {
      type: String,
      enum: [
        "Submitted",
        "Under_Review",
        "In_Progress",
        "On_Hold",
        "Rejected",
        "Resolved",
        "Closed",
      ],
      default:"Submitted"
    },
    rejectedReason:{
        type:String,
        default:null
    },
    onHoldReason:{
        type:String,
        default:null
    }
  },
  {
    timestamps: true,
  },
);

const complaintModel = mongoose.model("complaint", complaintSchema);

module.exports = complaintModel;
