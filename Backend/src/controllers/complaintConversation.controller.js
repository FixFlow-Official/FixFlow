const mongoose = require("mongoose");
const complaintModel = require("../models/complaint.model");
const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const { createNotifications, complaintNotification } = require("../services/notification.service");

const accountModels = {
  student: studentModel,
  staff: staffModel,
  admin: adminModel,
};

async function findAccessibleComplaint(req, res) {
  const { complaintId } = req.params;
  if (!mongoose.isValidObjectId(complaintId)) {
    res.status(400).json({ message: "Invalid complaint ID." });
    return null;
  }

  const { id, role } = req.auth || {};
  let filter;
  if (role === "student") {
    filter = { _id: complaintId, user: id, userRef: "student" };
  } else if (role === "staff") {
    filter = { _id: complaintId, assignedStaff: id, userRef: "student" };
  } else if (role === "admin") {
    filter = { _id: complaintId, userRef: "student" };
  } else {
    res.status(403).json({ message: "You cannot access this conversation." });
    return null;
  }

  const complaint = await complaintModel.findOne(filter);
  if (!complaint) {
    res.status(404).json({ message: "Complaint not found or access denied." });
    return null;
  }
  return complaint;
}

async function getComplaintComments(req, res) {
  try {
    const complaint = await findAccessibleComplaint(req, res);
    if (!complaint) return;
    return res.status(200).json({ comments: complaint.comments || [] });
  } catch (error) {
    console.error("getComplaintComments failed:", error);
    return res.status(500).json({ message: "Could not load complaint messages." });
  }
}

async function getComplaintDetails(req, res) {
  try {
    const complaint = await findAccessibleComplaint(req, res);
    if (!complaint) return;

    await complaint.populate([
      { path: "user", select: "username rollno staffId" },
      { path: "assignedStaff", select: "username staffId department" },
      { path: "resolvedBy", select: "username staffId department" },
    ]);

    return res.status(200).json({ complaint });
  } catch (error) {
    console.error("getComplaintDetails failed:", error);
    return res.status(500).json({ message: "Could not load complaint details." });
  }
}

async function addComplaintComment(req, res) {
  if (req.auth?.role === "admin") {
    return res.status(403).json({
      message: "Administrators can review complaint messages but cannot post as a student or staff member.",
    });
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ message: "Enter a message before sending." });
  }
  if (message.length > 1000) {
    return res.status(400).json({ message: "Messages must be 1,000 characters or fewer." });
  }

  try {
    const complaint = await findAccessibleComplaint(req, res);
    if (!complaint) return;

    const { id, role } = req.auth;
    const AccountModel = accountModels[role];
    const account = await AccountModel.findById(id).select("username rollno staffId");
    if (!account) {
      return res.status(401).json({ message: "Your account could not be found." });
    }

    const campusId = account.rollno ?? account.staffId ?? null;
    const comment = {
      author: account._id,
      authorRole: role,
      authorSnapshot: { name: account.username, campusId },
      message,
      createdAt: new Date(),
    };
    complaint.comments.push(comment);
    await complaint.save();

    if (role === "student" && complaint.assignedStaff) {
      await createNotifications([
        complaintNotification({
          recipient: complaint.assignedStaff,
          recipientRef: "staff",
          complaint,
          type: "message",
          title: "New complaint message",
          message: `${account.username} sent a message about this complaint.`,
        }),
      ]);
    } else if (role === "staff") {
      await createNotifications([
        complaintNotification({
          recipient: complaint.user,
          recipientRef: "student",
          complaint,
          type: "message",
          title: "Staff replied to your complaint",
          message: `${account.username} sent you a message.`,
        }),
      ]);
    }

    return res.status(201).json({
      message: "Message added to the complaint.",
      comment: complaint.comments[complaint.comments.length - 1],
    });
  } catch (error) {
    console.error("addComplaintComment failed:", error);
    return res.status(500).json({ message: "Could not send your message." });
  }
}

module.exports = { getComplaintDetails, getComplaintComments, addComplaintComment };
