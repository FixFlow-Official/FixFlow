const mongoose = require("mongoose");
const complaintModel = require("../models/complaint.model");
const staffModel = require("../models/staff.model");

async function getUnassignedComplaints(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view the complaint queue.",
    });
  }

  try {
    const complaints = await complaintModel
      .find({
        userRef: "student",
        assignedStaff: null,
        status: { $in: ["Submitted", "Under_Review"] },
      })
      .populate("user", "username rollno email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ complaints });
  } catch (err) {
    console.error("getUnassignedComplaints failed:", err);

    return res.status(500).json({
      message: "Could not load the complaint queue.",
    });
  }
}

async function getStaffByDepartment(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view staff assignments.",
    });
  }

  const department = req.query.department?.trim();

  if (!department) {
    return res.status(400).json({
      message: "Choose a department.",
    });
  }

  try {
    const staff = await staffModel
      .find({ department })
      .select("staffId username department")
      .sort({ username: 1 });

    return res.status(200).json({ staff });
  } catch (err) {
    console.error("getStaffByDepartment failed:", err);

    return res.status(500).json({
      message: "Could not load staff for this department.",
    });
  }
}

async function getAssignedComplaints(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view assigned complaints.",
    });
  }

  try {
    const complaints = await complaintModel
      .find({
        userRef: "student",
        assignedStaff: { $ne: null },
      })
      .populate("user", "username rollno email")
      .populate("assignedStaff", "staffId username department")
      .populate("resolvedBy", "staffId username department")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ complaints });
  } catch (err) {
    console.error("getAssignedComplaints failed:", err);

    return res.status(500).json({
      message: "Could not load assigned complaints.",
    });
  }
}

async function assignComplaint(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can assign complaints.",
    });
  }

  const { complaintId } = req.params;
  const { staffId, department } = req.body;

  if (!mongoose.isValidObjectId(complaintId)) {
    return res.status(400).json({
      message: "Invalid complaint ID.",
    });
  }

  const numericStaffId = Number(staffId);

  if (!Number.isInteger(numericStaffId) || !department?.trim()) {
    return res.status(400).json({
      message: "Choose a department and a valid staff member.",
    });
  }

  try {
    const complaint = await complaintModel.findOne({
      _id: complaintId,
      userRef: "student",
      assignedStaff: null,
      status: { $in: ["Submitted", "Under_Review"] },
    });

    if (!complaint) {
      return res.status(404).json({
        message: "Unassigned complaint not found.",
      });
    }

    const staff = await staffModel.findOne({
      staffId: numericStaffId,
      department: department.trim(),
    });

    if (!staff) {
      return res.status(404).json({
        message: "That staff member was not found in the selected department.",
      });
    }

    complaint.assignedDepartment = staff.department;
    complaint.assignedStaff = staff._id;
    complaint.status = "Assigned";
    complaint.statusHistory.push({
      status: "Assigned",
      note: `Assigned to ${staff.username} (${staff.department}).`,
      changedBy: req.auth.id,
      changedByRole: "admin",
    });

    await complaint.save();

    return res.status(200).json({
      message: "Complaint assigned successfully.",
      complaint,
    });
  } catch (err) {
    console.error("assignComplaint failed:", err);

    return res.status(500).json({
      message: "Could not assign the complaint.",
    });
  }
}

async function reassignComplaint(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can reassign complaints.",
    });
  }

  const { complaintId } = req.params;
  const { staffId, department } = req.body;

  if (!mongoose.isValidObjectId(complaintId)) {
    return res.status(400).json({
      message: "Invalid complaint ID.",
    });
  }

  const numericStaffId = Number(staffId);
  const cleanDepartment =
    typeof department === "string" ? department.trim() : "";

  if (!Number.isInteger(numericStaffId) || !cleanDepartment) {
    return res.status(400).json({
      message: "Choose a department and a valid staff member.",
    });
  }

  try {
    const complaint = await complaintModel.findOne({
      _id: complaintId,
      userRef: "student",
      assignedStaff: { $ne: null },
      status: { $nin: ["Resolved", "Rejected", "Closed", "Withdrawn"] },
    });

    if (!complaint) {
      return res.status(404).json({
        message: "Active assigned complaint not found.",
      });
    }

    const staff = await staffModel.findOne({
      staffId: numericStaffId,
      department: cleanDepartment,
    });

    if (!staff) {
      return res.status(404).json({
        message: "That staff member was not found in the selected department.",
      });
    }

    if (String(complaint.assignedStaff) === String(staff._id)) {
      return res.status(400).json({
        message: "This complaint is already assigned to that staff member.",
      });
    }

    const previousStaff = await staffModel
      .findById(complaint.assignedStaff)
      .select("username staffId department");

    const previousStaffLabel = previousStaff
      ? `${previousStaff.username} (ID ${previousStaff.staffId})`
      : "the previous staff member";

    complaint.assignedStaff = staff._id;
    complaint.assignedDepartment = staff.department;
    complaint.statusHistory.push({
      status: complaint.status,
      note: `Reassigned from ${previousStaffLabel} to ${staff.username} (ID ${staff.staffId}, ${staff.department}).`,
      changedBy: req.auth.id,
      changedByRole: "admin",
    });

    await complaint.save();

    return res.status(200).json({
      message: "Complaint reassigned successfully.",
      complaint,
    });
  } catch (err) {
    console.error("reassignComplaint failed:", err);

    return res.status(500).json({
      message: "Could not reassign the complaint.",
    });
  }
}

module.exports = {
  getUnassignedComplaints,
  getStaffByDepartment,
  getAssignedComplaints,
  assignComplaint,
  reassignComplaint,
};