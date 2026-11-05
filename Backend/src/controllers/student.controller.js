const complaintModel = require("../models/complaint.model");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const uploadFile = require("../services/storage.service");
const studentModel = require("../models/student.model");
const adminModel = require("../models/admin.model");
const { createNotifications, complaintNotification } = require("../services/notification.service");
const { getSlaPolicy, makeComplaintSlaDates } = require("../services/sla.service");
const { triageComplaint, fingerprintComplaint } = require("../services/complaintTriage.service");
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

  const result = await uploadFile(req.file.buffer, title.trim());
  if (!result?.url) {
    return res.status(502).json({
      message: "Could not upload the complaint photo. Please try again.",
    });
  }

  const slaPolicy = await getSlaPolicy(category);
  const complaint = await complaintModel.create({
    user: user._id,
    userRef: user.role,
    complaintPictureUrl: result.url,
    complaintTitle: title.trim(),
    complaintDescription: description.trim(),
    category,
    aiTriage,
    ...makeComplaintSlaDates(slaPolicy, submittedAt),
    location: {
      building: building.trim(),
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

module.exports = { createComplaint , getComplaint};
