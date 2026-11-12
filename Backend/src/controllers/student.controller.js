const complaintModel = require("../models/complaint.model");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const uploadFile = require("../services/storage.service");
const studentModel = require("../models/student.model");
const adminModel = require("../models/admin.model");
const { broadcastModel } = require("../models/broadcast.model");
const { createNotifications, complaintNotification } = require("../services/notification.service");
const smsWhatsAppService = require("../services/smsWhatsApp.service");
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
  "Reopened",
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

  // Check if an active campus outage broadcast matches this complaint's category + location
  let broadcastMatch = null;
  try {
    const now = new Date();
    const matchedBroadcast = await broadcastModel.findOne({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
      category,
      $or: [
        { buildings: { $size: 0 } },
        { buildings: { $exists: false } },
        { buildings: exactBuilding },
      ],
    }).sort({ startsAt: 1 }).lean();

    if (matchedBroadcast) {
      broadcastMatch = {
        title: matchedBroadcast.title,
        message: matchedBroadcast.message,
        endsAt: matchedBroadcast.endsAt,
      };
    }
  } catch (err) {
    console.error("Could not check active broadcast matches:", err.message);
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
    ...(broadcastMatch ? { broadcastMatch } : {}),
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
  const { rating, feedback } = req.body || {};

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

  if (complaint.csatRating != null) {
    return res.status(400).json({ message: "Rating has already been submitted for this resolution." });
  }

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: "A rating between 1 and 5 stars is required." });
  }

  complaint.resolutionVerified = true;
  complaint.resolutionVerifiedAt = new Date();
  complaint.csatRating = numRating;
  complaint.csatFeedback = feedback ? String(feedback).trim().slice(0, 1000) : "";

  if (numRating <= 2) {
    complaint.adminAuditRequired = true;
    try {
      const admins = await adminModel.find({}).select("_id").lean();
      if (admins.length > 0) {
        await createNotifications(admins.map((admin) => complaintNotification({
          recipient: admin._id,
          recipientRef: "admin",
          complaint,
          type: "status",
          title: "Low CSAT Rating — Audit Required",
          message: `Complaint #${complaint.ticketNumber || ""} received a low rating (${numRating}/5). Audit required.`,
        })));
      }
    } catch (notifErr) {
      console.error("Could not notify admins of low CSAT rating:", notifErr);
    }
  }

  complaint.statusHistory.push({
    status: "Resolved",
    note: `Student verified fix: ${numRating}/5 stars.${feedback ? ` Feedback: "${feedback.trim()}"` : ""}${numRating <= 2 ? " [Flagged for admin audit]" : ""}`,
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

// POST /api/student/complaints/:complaintId/csat
// verifyAccessToken + student owns the complaint + status is Resolved or Closed.
// Body { rating: 1-5 required, feedback?: max 1000 }.
// One rating per resolution: if csatRating is already set for this resolution, return 400.
// Save csatRating + csatFeedback. If rating <= 2, set adminAuditRequired: true and create an in-app notification for admins.
async function submitCsat(req, res) {
  if (!req.auth || req.auth.role !== "student") {
    return res.status(403).json({ message: "Only students can submit resolution ratings." });
  }

  const { complaintId } = req.params;
  const { rating, feedback } = req.body || {};

  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  if (String(complaint.user) !== String(req.auth.id)) {
    return res.status(403).json({ message: "Only the student who submitted this complaint can rate it." });
  }

  if (!["Resolved", "Closed"].includes(complaint.status)) {
    return res.status(400).json({ message: "Can only rate complaints currently marked as Resolved or Closed." });
  }

  if (complaint.csatRating != null) {
    return res.status(400).json({ message: "Rating has already been submitted for this resolution." });
  }

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: "A rating between 1 and 5 stars is required." });
  }

  complaint.csatRating = numRating;
  complaint.csatFeedback = feedback ? String(feedback).trim().slice(0, 1000) : "";
  complaint.resolutionVerified = true;
  complaint.resolutionVerifiedAt = new Date();

  if (numRating <= 2) {
    complaint.adminAuditRequired = true;
    try {
      const admins = await adminModel.find({}).select("_id").lean();
      if (admins.length > 0) {
        await createNotifications(admins.map((admin) => complaintNotification({
          recipient: admin._id,
          recipientRef: "admin",
          complaint,
          type: "status",
          title: "Low CSAT Rating — Audit Required",
          message: `Complaint #${complaint.ticketNumber || ""} received a low rating (${numRating}/5). Audit required.`,
        })));
      }
    } catch (notifErr) {
      console.error("Could not notify admins of low CSAT rating:", notifErr);
    }
  }

  complaint.statusHistory.push({
    status: complaint.status,
    note: `Student CSAT rating: ${numRating}/5 stars.${complaint.csatFeedback ? ` Feedback: "${complaint.csatFeedback}"` : ""}${numRating <= 2 ? " [Flagged for admin audit]" : ""}`,
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
    message: "Thank you for your feedback.",
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

  // 48-hour reopen window check
  const resolvedTimestamp = complaint.resolvedAt
    ? new Date(complaint.resolvedAt).getTime()
    : (complaint.updatedAt ? new Date(complaint.updatedAt).getTime() : Date.now());
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  if (Date.now() - resolvedTimestamp > FORTY_EIGHT_HOURS_MS) {
    return res.status(400).json({
      message: "Reopen window has expired (48 hours after resolution). Contact the admin.",
    });
  }

  let reopenProofUrl = req.body?.proofUrl || null;
  if (req.file) {
    try {
      const uploadResult = await uploadFile(req.file.buffer, `reopen_${complaintId}`);
      reopenProofUrl = uploadResult?.url || null;
    } catch {
      // Allow proceeding even if cloud storage upload fails or mock
      reopenProofUrl = null;
    }
  }

  const previousCsatRating = complaint.csatRating;
  complaint.status = "Reopened";
  complaint.resolutionVerified = false;
  complaint.reopenedCount = (complaint.reopenedCount || 0) + 1;
  complaint.reopenedAt = new Date();
  complaint.reopenReason = reason.slice(0, 1000);
  if (reopenProofUrl) {
    complaint.reopenProofUrl = reopenProofUrl;
  }
  complaint.csatRating = null;

  complaint.statusHistory.push({
    status: "Reopened",
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

  try {
    const notifications = [];
    const admins = await adminModel.find({}).select("_id email").lean();

    // If reopened within 48h AND csatRating was <= 2, notify department head directly via the admin notification path
    const isEscalated = previousCsatRating != null && previousCsatRating <= 2;
    const adminTitle = isEscalated
      ? `[DEPT HEAD ACTION] Reopened Low-CSAT Ticket (${complaint.assignedDepartment || complaint.category})`
      : "Complaint Reopened";
    const adminMessage = isEscalated
      ? `Complaint #${complaint.ticketNumber || ""} was rated ${previousCsatRating}/5 stars and was REOPENED by student: "${reason.slice(0, 140)}". Department head intervention required.`
      : `Complaint #${complaint.ticketNumber || ""} was reopened by student: "${reason.slice(0, 140)}".`;

    for (const admin of admins) {
      notifications.push(complaintNotification({
        recipient: admin._id,
        recipientRef: "admin",
        complaint,
        type: "status",
        title: adminTitle,
        message: adminMessage,
      }));
    }

    if (complaint.assignedStaff) {
      notifications.push(complaintNotification({
        recipient: complaint.assignedStaff,
        recipientRef: "staff",
        complaint,
        type: "status",
        title: "Assigned Complaint Reopened",
        message: `Ticket #${complaint.ticketNumber || ""} assigned to you was reopened: "${reason.slice(0, 140)}".`,
      }));
    }

    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  } catch (notifErr) {
    console.error("Could not dispatch reopen notifications:", notifErr);
  }

  void smsWhatsAppService.dispatchTimelineAlerts({
    complaint,
    event: "reopened",
    actorName: req.user?.fullName || req.auth.name || "Student",
    note: reason,
  });

  return res.status(200).json({
    message: "Complaint reopened. Staff has been notified.",
    complaint,
  });
}

// Surface active campus issues sorted by upvote count to eliminate duplicate tickets
async function getTrendingComplaints(req, res) {
  if (!req.auth || req.auth.role !== "student") {
    return res.status(403).json({ message: "Only students can view campus trending issues." });
  }

  const activeStatuses = [
    "Submitted",
    "Under_Review",
    "Assigned",
    "In_Progress",
    "On_Hold",
    "Reopened",
  ];

  const filter = {
    status: { $in: activeStatuses },
  };

  if (req.query.building) {
    filter["location.building"] = req.query.building;
  }
  if (req.query.category) {
    filter.category = req.query.category;
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

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const complaints = await complaintModel
    .find(filter)
    .sort({ upvoteCount: -1, createdAt: -1 })
    .limit(limit)
    .select(
      "complaintTitle complaintDescription category location status upvotes upvoteCount createdAt aiTriage user userSnapshot ticketNumber"
    );

  const studentId = String(req.auth.id);
  const formatted = complaints.map((doc) => {
    const hasUpvoted = (doc.upvotes || []).some((u) => String(u.user) === studentId);
    const isOwner = String(doc.user) === studentId;
    const obj = doc.toObject();
    delete obj.upvotes;
    return {
      ...obj,
      hasUpvoted,
      isOwner,
    };
  });

  return res.status(200).json({
    complaints: formatted,
    total: formatted.length,
  });
}

async function getComplaintVerification(req, res) {
  if (req.auth?.role !== "student") {
    return res.status(403).json({
      message: "Only students can view complaint verification.",
    });
  }

  const { complaintId } = req.params;
  if (!mongoose.isValidObjectId(complaintId)) {
    return res.status(400).json({
      message: "Invalid complaint ID.",
    });
  }

  try {
    const complaint = await complaintModel.findOne({
      _id: complaintId,
      user: req.auth.id,
      userRef: "student",
    }).select("aiResolutionVerification resolutionVerified resolutionProofUrl complaintPictureUrl status");

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    return res.status(200).json({
      verification: complaint.aiResolutionVerification || null,
      resolutionVerified: Boolean(complaint.resolutionVerified),
      status: complaint.status,
    });
  } catch (err) {
    console.error("getComplaintVerification failed", { requestId: req.requestId, error: err });
    return res.status(500).json({
      message: "Could not load complaint verification.",
    });
  }
}

module.exports = {
  createComplaint,
  getComplaint,
  getSimilarComplaints,
  toggleUpvoteComplaint,
  verifyComplaintResolution,
  submitCsat,
  reopenComplaint,
  getTrendingComplaints,
  getComplaintVerification,
};
