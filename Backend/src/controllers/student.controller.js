const complaintModel = require("../models/complaint.model");
const uploadFile = require("../services/storage.service");
const studentModel = require("../models/student.model");
const { getSlaPolicy, makeComplaintSlaDates } = require("../services/sla.service");
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

  const result = await uploadFile(req.file.buffer, title.trim());

  if (!result?.url) {
    return res.status(502).json({
      message: "Could not upload the complaint photo. Please try again.",
    });
  }

  const submittedAt = new Date();
  const slaPolicy = await getSlaPolicy(category);
  const complaint = await complaintModel.create({
    user: user._id,
    userRef: user.role,
    complaintPictureUrl: result.url,
    complaintTitle: title.trim(),
    complaintDescription: description.trim(),
    category,
    ...makeComplaintSlaDates(slaPolicy, submittedAt),
    location: {
      building: building.trim(),
      room: room.trim(),
    },
  });

  return res.status(201).json({
    message: "Complaint created successfully",
    complaint: {
      user: complaint.user,
      complaintImage: complaint.complaintPictureUrl,
      title: complaint.complaintTitle,
      description: complaint.complaintDescription,
      createdAt: complaint.createdAt,
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
