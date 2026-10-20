const mongoose = require("mongoose");
const complaintModel = require("../models/complaint.model");
const uploadFile = require("../services/storage.service");

const staffStatuses = [
  "Under_Review",
  "In_Progress",
  "On_Hold",
  "Resolved",
];

async function getAssignedComplaints(req, res) {
  if (req.auth?.role !== "staff") {
    return res.status(403).json({
      message: "Only staff members can view assigned complaints.",
    });
  }

  try {
    const complaints = await complaintModel
      .find({
        userRef: "student",
        assignedStaff: req.auth.id,
        status: { $ne: "Resolved" },
      })
      .populate("user", "username rollno")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ complaints });
  } catch {
    return res.status(500).json({
      message: "Could not load your assigned complaints.",
    });
  }
}

async function updateComplaintStatus(req, res) {
  if (req.auth?.role !== "staff") {
    return res.status(403).json({
      message: "Only staff members can update complaint status.",
    });
  }

  const { complaintId } = req.params;
  const { status, note = "" } = req.body;
  const trimmedNote = typeof note === "string" ? note.trim() : "";

  if (!mongoose.isValidObjectId(complaintId)) {
    return res.status(400).json({
      message: "Invalid complaint ID.",
    });
  }

  if (!staffStatuses.includes(status)) {
    return res.status(400).json({
      message: "Choose a valid status.",
    });
  }

  if (status === "On_Hold" && !trimmedNote) {
    return res.status(400).json({
      message: "Add a note explaining why this complaint is on hold.",
    });
  }

  if (status === "Resolved" && !trimmedNote) {
    return res.status(400).json({
      message: "Add a resolution note before resolving this complaint.",
    });
  }

  if (status === "Resolved" && !req.file) {
    return res.status(400).json({
      message: "Attach a photo as proof that the complaint is resolved.",
    });
  }

  try {
    const complaint = await complaintModel.findOne({
      _id: complaintId,
      userRef: "student",
      assignedStaff: req.auth.id,
      
    });

    if (!complaint) {
      return res.status(404).json({
        message: "Active assigned complaint not found.",
      });
    }

    let resolutionProofUrl = null;

    if (status === "Resolved") {
      const uploadResult = await uploadFile(
        req.file.buffer,
        `resolution-${complaintId}`,
      );

      if (!uploadResult?.url) {
        return res.status(500).json({
          message: "Could not upload the resolution proof photo.",
        });
      }

      resolutionProofUrl = uploadResult.url;
    }

    complaint.status = status;

    if (status === "On_Hold") {
      complaint.onHoldReason = trimmedNote;
    } else {
      complaint.onHoldReason = null;
    }

    if (status === "Resolved") {
      complaint.resolutionProofUrl = resolutionProofUrl;
      complaint.resolutionNote = trimmedNote;
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = req.auth.id;
    }

    complaint.statusHistory.push({
      status,
      note: trimmedNote,
      changedBy: req.auth.id,
      changedByRole: "staff",
    });

    await complaint.save();

    return res.status(200).json({
      message: "Complaint status updated.",
      complaint,
    });
  } catch {
    return res.status(500).json({
      message: "Could not update complaint status.",
    });
  }
}

module.exports = {
  getAssignedComplaints,
  updateComplaintStatus,
};