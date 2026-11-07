const complaintModel = require("../models/complaint.model");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const uploadFile = require("../services/storage.service");
const studentModel = require("../models/student.model");
const adminModel = require("../models/admin.model");
const { createNotifications, complaintNotification } = require("../services/notification.service");
const { getSlaPolicy, makeComplaintSlaDates } = require("../services/sla.service");
const { triageComplaint, fingerprintComplaint } = require("../services/complaintTriage.service");
const { findDuplicates } = require("../services/duplicateDetection.service");
const {
  getPageMetadata,
  getPageOptions,
  makeSearchRegex,
} = require("../utils/complaintPagination");

const activeComplaintStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
];
const currentComplaintStatuses = [
  ...activeComplaintStatuses,
  "Rejected",
  "Closed",
  "Withdrawn",
];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

 /**
 *
 * @route createComplaint
 * @description accepts a Image,title,description to create a complaint
 * @access public
 */

async function createComplaint(req, res) {
  if (!req.auth) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  // Complaints can only be submitted by students.
  if (req.auth.role !== "student") {
    return res.status(403).json({
      message: "Only students can submit complaints.",
    });
  }

  const user = await studentModel.findById(req.auth.id);

  if (!user) {
    return res.status(401).json({
      message: "User not found.",
    });
  }

  const {
    title,
    description,
    category,
    building,
    floor = "Ground Floor",
    room = "",
  } = req.body;

  const allowedCategories = [
    "Electrical",
    "Plumbing",
    "Cleaning",
    "Internet",
    "Furniture",
    "Other",
  ];

  if (!title?.trim() || !description?.trim() || !building?.trim()) {
    return res.status(400).json({
      message: "Title, description, and building are required.",
    });
  }

  if (!allowedCategories.includes(category)) {
    return res.status(400).json({
      message: "Choose a valid complaint category.",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      message: "Attach a photo as proof of the complaint.",
    });
  }

  const submittedAt = new Date();
  const triageInput = { title: title.trim(), description: description.trim(), category, building: building.trim() };
  let aiTriage;
  try {
    const preview = req.body.triageToken && jwt.verify(req.body.triageToken, config.JWT_SECRET, { subject: String(user._id) });
    if (preview?.purpose === "complaint-triage-preview" && preview.fingerprint === fingerprintComplaint(triageInput) && preview.aiTriage) {
      aiTriage = preview.aiTriage;
    }
  } catch {
    // Expired or mismatched previews are safely recalculated at submission.
  }
  aiTriage ||= await triageComplaint(triageInput);
  const exactTitle = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const exactBuilding = new RegExp(`^${building.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (!Number.isFinite(aiTriage.relatedOpenReports)) aiTriage.relatedOpenReports = await complaintModel.countDocuments({
    complaintTitle: exactTitle,
    category,
    "location.building": exactBuilding,
    status: { $in: activeComplaintStatuses },
    createdAt: { $gte: new Date(submittedAt.getTime() - 30 * 24 * 60 * 60 * 1000) },
  });
  if (aiTriage.reviewSignal === "check_relevance" && !aiTriage.safetyConcern && req.body.confirmedCampusIssue !== "true") {
    return res.status(422).json({
      message: "The AI could not identify a clear campus issue in this draft. Add specific details or confirm that this is an actual campus issue so staff can review it.",
    });
  }

  // AI & Semantic Duplicate Prevention Check
  const activeCandidates = await complaintModel
    .find({
      status: { $in: activeComplaintStatuses },
      "location.building": exactBuilding,
    })
    .select("_id complaintTitle complaintDescription category location upvoteCount upvotes user status")
    .lean();

  const duplicateCheck = await findDuplicates(
    {
      title: title.trim(),
      description: description.trim(),
      category,
      building: building.trim(),
      floor,
      room,
    },
    activeCandidates,
  );

  if (duplicateCheck.isDuplicate && req.body.confirmDistinctIssue !== "true") {
    const top = duplicateCheck.topDuplicate;
    const isOwner = String(top.user) === String(user._id);
    return res.status(409).json({
      message: isOwner
        ? `You already have an active complaint for this issue in this location ("${top.complaintTitle}").`
        : `A similar active complaint is already open in this location ("${top.complaintTitle}"). Please upvote it (+1 Me Too) instead of creating a duplicate report.`,
      isDuplicate: true,
      duplicateComplaint: {
        _id: top._id,
        title: top.complaintTitle,
        description: top.complaintDescription,
        category: top.category,
        location: top.location,
        upvoteCount: top.upvoteCount || 0,
        isOwner,
      },
      reason: duplicateCheck.topReason,
    });
  }

  const result = await uploadFile(req.file.buffer, title.trim());
  if (!result?.url) {
    return res.status(502).json({
      message: "Could not upload the complaint photo. Please try again.",
    });
  }

  const slaPolicy = await getSlaPolicy(category);
  const userSnapshot = {
    name: user.username,
    campusId: String(user.rollno ?? user.staffId ?? user.adminId ?? ""),
    email: user.email,
    role: user.role,
  };
  const complaint = await complaintModel.create({
    user: user._id,
    userRef: user.role,
    userSnapshot,
    complaintPictureUrl: result.url,
    complaintTitle: title.trim(),
    complaintDescription: description.trim(),
    category,
    aiTriage,
    ...makeComplaintSlaDates(slaPolicy, submittedAt),
    location: {
      building: building.trim(),
      floor: (floor || "Ground Floor").trim(),
      room: room.trim(),
    },
  });

  // Confirm submission to the student and alert administrators who are watching
  // for new reports. Keep notification failures from undoing a saved complaint.
  try {
    const admins = await adminModel.find({}).select("_id").lean();
    await createNotifications([
      complaintNotification({
        recipient: user._id,
        recipientRef: "student",
        complaint,
        type: "submitted",
        title: "Complaint submitted",
        message: "Your complaint was submitted and is waiting for review.",
      }),
      ...admins.map((admin) => complaintNotification({
        recipient: admin._id,
        recipientRef: "admin",
        complaint,
        type: "submitted",
        title: "New complaint submitted",
        message: `${aiTriage.priority} · ${aiTriage.urgency}: ${title.trim()} (${aiTriage.suggestedCategory} suggested). Waiting for staff review.`,
      })),
    ]);
  } catch (error) {
    console.error("Could not notify users about a submitted complaint:", error.message);
  }

  return res.status(201).json({
    message: "Complaint created successfully",
    complaint: {
      user: complaint.user,
      complaintImage: complaint.complaintPictureUrl,
      title: complaint.complaintTitle,
      description: complaint.complaintDescription,
      createdAt: complaint.createdAt,
      aiTriage: { ...(complaint.aiTriage?.toObject?.() || complaint.aiTriage || aiTriage), currentCategory: complaint.category },
    },
  });
}

/**
 *
 * @route getComplaint
 * @description get all the complaint created by a user
 * @access public
 */

async function getComplaint(req, res) {
  if (!req.auth) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const decoded = req.auth;
  const pageOptions = getPageOptions(req.query);
  if (pageOptions.error) {
    return res.status(400).json({ message: pageOptions.error });
  }

  const view = req.query.view || "all";
  if (!["all", "active", "current", "resolved"].includes(view)) {
    return res.status(400).json({
      message: "Choose a valid complaint view.",
    });
  }

  const baseFilter = {
    user: decoded.id,
    userRef: decoded.role,
  };
  const filter = { ...baseFilter };

  if (view === "active") {
    filter.status = { $in: activeComplaintStatuses };
  } else if (view === "current") {
    filter.status = { $in: currentComplaintStatuses };
  } else if (view === "resolved") {
    filter.status = "Resolved";
  }

  const searchRegex = makeSearchRegex(req.query.search);
  if (searchRegex) {
    filter.$or = [
      { complaintTitle: searchRegex },
      { complaintDescription: searchRegex },
      { category: searchRegex },
      { "location.building": searchRegex },
      { "location.room": searchRegex },
    ];
  }

  const countFilters = searchRegex ? { $or: filter.$or } : {};
  const [complaints, total, currentCount, resolvedCount] = await Promise.all([
    complaintModel
      .find(filter)
      .populate("resolvedBy", "username staffId department")
      .sort({ createdAt: -1 })
      .skip(pageOptions.skip)
      .limit(pageOptions.limit),
    complaintModel.countDocuments(filter),
    complaintModel.countDocuments({
      ...baseFilter,
      ...countFilters,
      status: { $in: currentComplaintStatuses },
    }),
    complaintModel.countDocuments({
      ...baseFilter,
      ...countFilters,
      status: "Resolved",
    }),
  ]);

  return res.status(200).json({
    complaints,
    pagination: getPageMetadata(pageOptions.page, pageOptions.limit, total),
    counts: { current: currentCount, resolved: resolvedCount },
  });
}

// Find existing open complaints in the same location to prevent duplicates
async function getSimilarComplaints(req, res) {
  const { building, floor, room, category, title, description } = req.query;

  if (!building || typeof building !== "string" || !building.trim()) {
    return res.status(200).json({ complaints: [], isDuplicate: false, topDuplicate: null });
  }

  const exactBuilding = new RegExp(`^${escapeRegex(building.trim())}$`, "i");

  const query = {
    status: { $in: activeComplaintStatuses },
    "location.building": exactBuilding,
  };

  const results = await complaintModel
    .find(query)
    .select(
      "_id complaintTitle complaintDescription category location status upvotes upvoteCount createdAt complaintPictureUrl user",
    )
    .sort({ upvoteCount: -1, createdAt: -1 })
    .limit(10)
    .lean();

  const userId = req.auth?.id ? String(req.auth.id) : null;

  const formatted = results.map((c) => {
    const hasUpvoted = userId
      ? (c.upvotes || []).some((u) => String(u.user) === userId)
      : false;
    const isOwner = userId ? String(c.user) === userId : false;

    return {
      _id: c._id,
      title: c.complaintTitle,
      description: c.complaintDescription,
      category: c.category,
      location: c.location,
      status: c.status,
      upvoteCount: c.upvoteCount || 0,
      hasUpvoted,
      isOwner,
      createdAt: c.createdAt,
      complaintPictureUrl: c.complaintPictureUrl,
    };
  });

  const duplicateCheck = await findDuplicates(
    {
      title: title || "",
      description: description || "",
      category: category || "",
      building: building.trim(),
      floor: floor || "",
      room: room || "",
    },
    results,
  );

  const hasContentQuery = Boolean(title?.trim() || category?.trim());

  let responseComplaints = formatted;
  if (hasContentQuery) {
    const duplicateIds = new Set(
      (duplicateCheck.duplicates || []).map((d) => String(d._id)),
    );
    if (duplicateCheck.topDuplicate) {
      duplicateIds.add(String(duplicateCheck.topDuplicate._id));
    }
    responseComplaints = formatted.filter((c) => duplicateIds.has(String(c._id)));
  }

  const topDuplicate = duplicateCheck.topDuplicate
    ? formatted.find((c) => String(c._id) === String(duplicateCheck.topDuplicate._id)) || null
    : null;

  return res.status(200).json({
    complaints: responseComplaints,
    isDuplicate: duplicateCheck.isDuplicate,
    topDuplicate,
    topReason: duplicateCheck.topReason || null,
  });
}

// Toggle "Me Too" upvote for an existing active complaint
async function toggleUpvoteComplaint(req, res) {
  if (!req.auth || req.auth.role !== "student") {
    return res.status(403).json({ message: "Only students can upvote complaints." });
  }

  const { complaintId } = req.params;
  const complaint = await complaintModel.findById(complaintId);

  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  const terminalStatuses = ["Resolved", "Closed", "Rejected", "Withdrawn"];
  if (terminalStatuses.includes(complaint.status)) {
    return res.status(400).json({ message: "Cannot upvote a closed or resolved complaint." });
  }

  const userId = String(req.auth.id);
  if (String(complaint.user) === userId) {
    return res.status(400).json({ message: "You are the creator of this complaint." });
  }

  const existingUpvote = (complaint.upvotes || []).find((u) => String(u.user) === userId);

  if (existingUpvote) {
    complaint.upvotes = complaint.upvotes.filter((u) => String(u.user) !== userId);
    complaint.upvoteCount = Math.max(0, (complaint.upvoteCount || 1) - 1);
    await complaint.save();

    return res.status(200).json({
      message: "Upvote removed.",
      upvoted: false,
      upvoteCount: complaint.upvoteCount,
    });
  }

  complaint.upvotes.push({ user: req.auth.id, upvotedAt: new Date() });
  complaint.upvoteCount = (complaint.upvoteCount || 0) + 1;
  await complaint.save();

  return res.status(200).json({
    message: "Complaint upvoted (+1 Me Too). You will be notified when it is resolved.",
    upvoted: true,
    upvoteCount: complaint.upvoteCount,
  });
}

// Student verifies resolution with 1 to 5 stars (CSAT) and optional feedback
async function verifyComplaintResolution(req, res) {
  if (!req.auth || req.auth.role !== "student") {
    return res.status(403).json({ message: "Only students can verify complaint resolution." });
  }

  const { complaintId } = req.params;
  const { rating, feedback } = req.body;

  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  if (String(complaint.user) !== String(req.auth.id)) {
    return res.status(403).json({ message: "Only the student who submitted this complaint can verify its resolution." });
  }

  if (complaint.status !== "Resolved") {
    return res.status(400).json({ message: "Can only verify resolution for complaints currently marked as Resolved." });
  }

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: "A rating between 1 and 5 stars is required." });
  }

  complaint.resolutionVerified = true;
  complaint.resolutionVerifiedAt = new Date();
  complaint.csatRating = numRating;
  complaint.csatFeedback = feedback ? String(feedback).trim().slice(0, 1000) : "";

  complaint.statusHistory.push({
    status: "Resolved",
    note: `Student verified fix: ${numRating}/5 stars.${feedback ? ` Feedback: "${feedback.trim()}"` : ""}`,
    changedBy: req.auth.id,
    changedByRole: "student",
    changedBySnapshot: {
      name: req.user?.fullName || req.auth.name || "Student",
      campusId: req.user?.campusId || req.auth.campusId || "",
    },
    changedAt: new Date(),
  });

  await complaint.save();

  return res.status(200).json({
    message: "Resolution verified. Thank you for your feedback!",
    complaint,
  });
}

// Student reopens an inadequate resolution with reason and optional proof photo
async function reopenComplaint(req, res) {
  if (!req.auth || req.auth.role !== "student") {
    return res.status(403).json({ message: "Only students can reopen complaints." });
  }

  const { complaintId } = req.params;
  const reason = (req.body?.reason || "").trim();

  if (!reason) {
    return res.status(400).json({ message: "Please explain why the issue is not resolved." });
  }

  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  if (String(complaint.user) !== String(req.auth.id)) {
    return res.status(403).json({ message: "Only the student who submitted this complaint can reopen it." });
  }

  if (complaint.status !== "Resolved") {
    return res.status(400).json({ message: "Can only reopen complaints currently marked as Resolved." });
  }

  let reopenProofUrl = null;
  if (req.file) {
    try {
      const uploadResult = await uploadFile(req.file.buffer, `reopen_${complaintId}`);
      reopenProofUrl = uploadResult?.url || null;
    } catch {
      // Allow proceeding even if cloud storage upload fails or mock
      reopenProofUrl = null;
    }
  }

  complaint.status = "In_Progress";
  complaint.resolutionVerified = false;
  complaint.reopenedCount = (complaint.reopenedCount || 0) + 1;
  complaint.reopenedAt = new Date();
  complaint.reopenReason = reason.slice(0, 1000);
  if (reopenProofUrl) {
    complaint.reopenProofUrl = reopenProofUrl;
  }

  complaint.statusHistory.push({
    status: "In_Progress",
    note: `Reopened by student: ${reason}`,
    changedBy: req.auth.id,
    changedByRole: "student",
    changedBySnapshot: {
      name: req.user?.fullName || req.auth.name || "Student",
      campusId: req.user?.campusId || req.auth.campusId || "",
    },
    changedAt: new Date(),
  });

  await complaint.save();

  return res.status(200).json({
    message: "Complaint reopened. Staff has been notified.",
    complaint,
  });
}

module.exports = {
  createComplaint,
  getComplaint,
  getSimilarComplaints,
  toggleUpvoteComplaint,
  verifyComplaintResolution,
  reopenComplaint,
};
