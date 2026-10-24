const mongoose = require("mongoose");
const complaintModel = require("../models/complaint.model");
const studentModel = require("../models/student.model");
const uploadFile = require("../services/storage.service");
const {
  findStudentIdsBySearch,
  getPageMetadata,
  getPageOptions,
  makeSearchRegex,
} = require("../utils/complaintPagination");

const staffStatuses = [
  "Under_Review",
  "In_Progress",
  "On_Hold",
  "Resolved",
];

const terminalStatuses = new Set([
  "Resolved",
  "Rejected",
  "Closed",
  "Withdrawn",
]);
const currentStaffStatuses = [
  "Assigned",
  "Under_Review",
  "In_Progress",
  "On_Hold",
  "Rejected",
  "Closed",
  "Withdrawn",
];

const allowedStatusTransitions = {
  Assigned: ["Under_Review", "In_Progress", "On_Hold", "Resolved"],
  Under_Review: ["In_Progress", "On_Hold", "Resolved"],
  In_Progress: ["On_Hold", "Resolved"],
  On_Hold: ["In_Progress", "Resolved"],
};

async function getAssignedComplaints(req, res) {
  if (req.auth?.role !== "staff") {
    return res.status(403).json({
      message: "Only staff members can view assigned complaints.",
    });
  }

  try {
    const pageOptions = getPageOptions(req.query);
    if (pageOptions.error) {
      return res.status(400).json({ message: pageOptions.error });
    }

    const view = req.query.view || "all";
    if (!["all", "current", "resolved"].includes(view)) {
      return res.status(400).json({
        message: "Choose a valid complaint view.",
      });
    }

    const allowedCurrentStatuses = [
      "Assigned",
      "Under_Review",
      "In_Progress",
      "On_Hold",
    ];
    const requestedStatus = req.query.status;
    if (
      requestedStatus &&
      (view !== "current" || !allowedCurrentStatuses.includes(requestedStatus))
    ) {
      return res.status(400).json({
        message: "Choose a valid current complaint status.",
      });
    }

    const baseFilter = {
      userRef: "student",
      assignedStaff: req.auth.id,
    };
    const searchRegex = makeSearchRegex(req.query.search);
    let searchFilter = {};

    if (searchRegex) {
      const studentIds = await findStudentIdsBySearch(
        req.query.search,
        studentModel,
      );
      searchFilter = {
        $or: [
          { complaintTitle: searchRegex },
          { complaintDescription: searchRegex },
          { category: searchRegex },
          { "location.building": searchRegex },
          { "location.room": searchRegex },
          { user: { $in: studentIds } },
        ],
      };
    }

    const statusFilter =
      requestedStatus
        ? { status: requestedStatus }
        : view === "current"
          ? { status: { $in: currentStaffStatuses } }
          : view === "resolved"
            ? { status: "Resolved" }
            : {};
    const filter = { ...baseFilter, ...searchFilter, ...statusFilter };
    const countFilter = searchFilter;
    const statusCountQueries = allowedCurrentStatuses.map((status) =>
      complaintModel.countDocuments({
        ...baseFilter,
        ...countFilter,
        status,
      }),
    );
    const [complaints, total, currentCount, resolvedCount, ...statusCounts] = await Promise.all([
      complaintModel
        .find(filter)
        .populate("user", "username rollno")
        .populate("resolvedBy", "username staffId department")
        .sort({ updatedAt: -1 })
        .skip(pageOptions.skip)
        .limit(pageOptions.limit),
      complaintModel.countDocuments(filter),
      complaintModel.countDocuments({
        ...baseFilter,
        ...countFilter,
        status: { $in: currentStaffStatuses },
      }),
      complaintModel.countDocuments({
        ...baseFilter,
        ...countFilter,
        status: "Resolved",
      }),
      ...statusCountQueries,
    ]);

    return res.status(200).json({
      complaints,
      pagination: getPageMetadata(pageOptions.page, pageOptions.limit, total),
      counts: {
        current: currentCount,
        resolved: resolvedCount,
        statuses: Object.fromEntries(
          allowedCurrentStatuses.map((status, index) => [status, statusCounts[index]]),
        ),
      },
    });
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

    if (terminalStatuses.has(complaint.status)) {
      return res.status(409).json({
        message: "This complaint is already closed and cannot be updated.",
      });
    }

    const nextStatuses = allowedStatusTransitions[complaint.status] || [];

    if (!nextStatuses.includes(status)) {
      return res.status(409).json({
        message: `Cannot change complaint status from ${complaint.status} to ${status}.`,
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
