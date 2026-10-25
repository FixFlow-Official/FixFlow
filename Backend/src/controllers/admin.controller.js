const mongoose = require("mongoose");
const fs = require("node:fs");
const path = require("node:path");
const complaintModel = require("../models/complaint.model");
const staffModel = require("../models/staff.model");
const studentModel = require("../models/student.model");
const adminModel = require("../models/admin.model");
const sessionModel = require("../models/session.model");
const { createNotifications, complaintNotification } = require("../services/notification.service");
const studentData = require("../data/officialStudentData.json");
const staffData = require("../data/staffData.json");
const {
  findStudentIdsBySearch,
  getPageMetadata,
  getPageOptions,
  makeSearchRegex,
} = require("../utils/complaintPagination");

const currentAssignedStatuses = [
  "Assigned",
  "Under_Review",
  "In_Progress",
  "On_Hold",
];
const resolvedAssignedStatuses = ["Resolved"];
const closedAssignedStatuses = ["Rejected", "Closed", "Withdrawn"];

function getAssignedViewStatuses(view) {
  if (view === "current") return currentAssignedStatuses;
  if (view === "resolved") return resolvedAssignedStatuses;
  if (view === "closed") return closedAssignedStatuses;
  if (view === "all") return null;
  return undefined;
}

async function buildComplaintSearchFilter(search) {
  const searchRegex = makeSearchRegex(search);
  if (!searchRegex) return {};

  const studentIds = await findStudentIdsBySearch(search, studentModel);
  return {
    $or: [
      { complaintTitle: searchRegex },
      { complaintDescription: searchRegex },
      { category: searchRegex },
      { "location.building": searchRegex },
      { "location.room": searchRegex },
      { "assignedDepartment": searchRegex },
      { "userSnapshot.name": searchRegex },
      { "userSnapshot.campusId": searchRegex },
      { user: { $in: studentIds } },
    ],
  };
}

const studentFilePath = path.join(__dirname, "../data/officialStudentData.json");
const staffFilePath = path.join(__dirname, "../data/staffData.json");

function persistDirectory(filePath, records) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(records, null, 2), "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getUnassignedComplaints(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view the complaint queue.",
    });
  }

  try {
    const pageOptions = getPageOptions(req.query);
    if (pageOptions.error) {
      return res.status(400).json({ message: pageOptions.error });
    }

    const baseFilter = {
      userRef: "student",
      assignedStaff: null,
      status: { $in: ["Submitted", "Under_Review"] },
    };
    const searchFilter = await buildComplaintSearchFilter(req.query.search);
    const filter = { ...baseFilter, ...searchFilter };
    const [complaints, total] = await Promise.all([
      complaintModel
        .find(filter)
        .populate("user", "username rollno email")
        .sort({ createdAt: -1 })
        .skip(pageOptions.skip)
        .limit(pageOptions.limit),
      complaintModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      complaints,
      pagination: getPageMetadata(pageOptions.page, pageOptions.limit, total),
    });
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

// List registered student or staff accounts for the admin account directory.
async function getRegisteredAccounts(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view registered accounts.",
    });
  }

  const type = req.query.type || "student";
  if (!["student", "staff"].includes(type)) {
    return res.status(400).json({ message: "Choose student or staff accounts." });
  }

  try {
    const pageOptions = getPageOptions(req.query);
    if (pageOptions.error) {
      return res.status(400).json({ message: pageOptions.error });
    }

    const searchRegex = makeSearchRegex(req.query.search);
    const model = type === "student" ? studentModel : staffModel;
    const idField = type === "student" ? "rollno" : "staffId";
    const detailField = type === "student" ? "course" : "department";
    const filter = searchRegex
      ? {
          $or: [
            { username: searchRegex },
            { email: searchRegex },
            { [detailField]: searchRegex },
            ...(typeof req.query.search === "string" && /^\d+$/.test(req.query.search.trim())
              ? [{ [idField]: Number(req.query.search.trim()) }]
              : []),
          ],
        }
      : {};

    const [accounts, total] = await Promise.all([
      model
        .find(filter)
        .select(`username ${idField} email ${detailField}`)
        .sort({ username: 1, _id: 1 })
        .skip(pageOptions.skip)
        .limit(pageOptions.limit)
        .lean(),
      model.countDocuments(filter),
    ]);

    return res.status(200).json({
      type,
      accounts: accounts.map((account) => ({
        id: String(account._id),
        campusId: account[idField],
        name: account.username,
        email: account.email,
        detail: account[detailField],
      })),
      pagination: getPageMetadata(pageOptions.page, pageOptions.limit, total),
    });
  } catch (err) {
    console.error("getRegisteredAccounts failed:", err);
    return res.status(500).json({ message: "Could not load registered accounts." });
  }
}

async function getAssignedComplaints(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view assigned complaints.",
    });
  }

  try {
    const pageOptions = getPageOptions(req.query);
    if (pageOptions.error) {
      return res.status(400).json({ message: pageOptions.error });
    }

    const view = req.query.view || "all";
    const viewStatuses = getAssignedViewStatuses(view);
    if (view !== "all" && !viewStatuses) {
      return res.status(400).json({
        message: "Choose a valid assigned complaint view.",
      });
    }

    const sort = req.query.sort || "updated";
    if (!["created", "updated"].includes(sort)) {
      return res.status(400).json({
        message: "Choose a valid complaint sort order.",
      });
    }

    const order = req.query.order || "desc";
    if (!["asc", "desc"].includes(order)) {
      return res.status(400).json({
        message: "Choose a valid complaint sort direction.",
      });
    }

    const baseFilter = {
      userRef: "student",
      assignedStaff: { $ne: null },
    };
    const searchFilter = await buildComplaintSearchFilter(req.query.search);
    const filter = {
      ...baseFilter,
      ...searchFilter,
      ...(viewStatuses ? { status: { $in: viewStatuses } } : {}),
    };
    const countForView = (statuses) =>
      complaintModel.countDocuments({
        ...baseFilter,
        ...searchFilter,
        status: { $in: statuses },
      });

    const [complaints, total, currentCount, resolvedCount, closedCount] =
      await Promise.all([
        complaintModel
          .find(filter)
          .populate("user", "username rollno email")
          .populate("assignedStaff", "staffId username department")
          .populate("resolvedBy", "staffId username department")
          .sort({ [sort === "created" ? "createdAt" : "updatedAt"]: order === "asc" ? 1 : -1 })
          .skip(pageOptions.skip)
          .limit(pageOptions.limit),
        complaintModel.countDocuments(filter),
        countForView(currentAssignedStatuses),
        countForView(resolvedAssignedStatuses),
        countForView(closedAssignedStatuses),
      ]);

    return res.status(200).json({
      complaints,
      pagination: getPageMetadata(pageOptions.page, pageOptions.limit, total),
      counts: {
        current: currentCount,
        resolved: resolvedCount,
        closed: closedCount,
      },
    });
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

    await createNotifications([
      complaintNotification({
        recipient: complaint.user,
        recipientRef: "student",
        complaint,
        type: "assigned",
        title: "Your complaint was assigned",
        message: `Your complaint is assigned to ${staff.username} (${staff.department}).`,
      }),
      complaintNotification({
        recipient: staff._id,
        recipientRef: "staff",
        complaint,
        type: "assigned",
        title: "New complaint assigned",
        message: `A complaint has been assigned to you in ${staff.department}.`,
      }),
    ]);

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

    await createNotifications([
      complaintNotification({
        recipient: complaint.user,
        recipientRef: "student",
        complaint,
        type: "reassigned",
        title: "Your complaint was reassigned",
        message: `Your complaint is now assigned to ${staff.username} (${staff.department}).`,
      }),
      complaintNotification({
        recipient: staff._id,
        recipientRef: "staff",
        complaint,
        type: "assigned",
        title: "Complaint assigned to you",
        message: `A complaint has been assigned to you in ${staff.department}.`,
      }),
      ...(previousStaff
        ? [
            complaintNotification({
              recipient: previousStaff._id,
              recipientRef: "staff",
              complaint,
              type: "reassigned",
              title: "Complaint reassigned",
              message: "This complaint has been reassigned to another staff member.",
            }),
          ]
        : []),
    ]);

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

async function addUserToDirectoryByAdmin(req, res) {
  try {
    if (req.auth?.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create users",
      });
    }

    const { id, name, email, course, type } = req.body;
    const cleanId = typeof id === "string" ? id.trim() : String(id ?? "");
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanCourse = typeof course === "string" ? course.trim() : "";

    if (!cleanId || !cleanName || !cleanEmail || !cleanCourse || !type) {
      return res.status(400).json({
        message: "ID, name, email, course or department, and account type are required.",
      });
    }

    if (!new Set(["student", "staff"]).has(type)) {
      return res.status(400).json({
        message: "Only student and staff directory records can be created here.",
      });
    }

    if (!/^\d{1,10}$/.test(cleanId)) {
      return res.status(400).json({ message: "Enter a numeric ID with up to 10 digits." });
    }

    if (cleanName.length > 100 || cleanEmail.length > 254 || cleanCourse.length > 100) {
      return res.status(400).json({
        message: "Name, email, or course/department exceeds the allowed length.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const userData = type === "student" ? studentData : staffData;
    const idField = type === "student" ? "rollno" : "staffId";
    const model = type === "student" ? studentModel : staffModel;
    const emailPattern = new RegExp(`^${escapeRegex(cleanEmail)}$`, "i");
    const canonicalId = String(Number(cleanId));
    const hasSameId = (entry, field) => String(Number(entry[field])) === canonicalId;
    const directoryIdExists = userData.some((entry) => hasSameId(entry, idField));
    const directoryEmailExists = userData.some(
      (entry) => String(entry.email || "").trim().toLowerCase() === cleanEmail,
    );

    // IDs and emails are unique within each account type. Historical campus
    // data may reuse the same values across roles, so compare the selected role.
    if (directoryIdExists) {
      return res.status(409).json({
        message: "That campus ID is already used by an existing account or directory entry.",
      });
    }

    if (directoryEmailExists) {
      return res.status(409).json({
        message: "That email is already used by an existing account or directory entry.",
      });
    }

    const [idAccount, emailAccount] = await Promise.all([
      model.findOne({ [idField]: Number(cleanId) }).select("_id"),
      model.findOne({ email: emailPattern }).select("_id"),
    ]);

    if (idAccount) {
      return res.status(409).json({
        message: "That campus ID is already used by an existing account or directory entry.",
      });
    }

    if (emailAccount) {
      return res.status(409).json({
        message: "That email is already used by an existing account or directory entry.",
      });
    }

    const record = type === "student"
      ? { rollno: Number(cleanId), name: cleanName, course: cleanCourse, email: cleanEmail }
      : { staffId: Number(cleanId), name: cleanName, department: cleanCourse, email: cleanEmail };
    const filePath = type === "student" ? studentFilePath : staffFilePath;
    // Recheck the in-memory directories after the database reads so concurrent
    // admin requests cannot append the same ID or email twice in this process.
    const idNowExists = userData.some((entry) => hasSameId(entry, idField));
    const emailNowExists = userData.some(
      (entry) => String(entry.email || "").trim().toLowerCase() === cleanEmail,
    );
    if (idNowExists || emailNowExists) {
      return res.status(409).json({
        message: idNowExists
          ? "That campus ID is already used by an existing account or directory entry."
          : "That email is already used by an existing account or directory entry.",
      });
    }

    userData.push(record);

    try {
      persistDirectory(filePath, userData);
    } catch (error) {
      userData.pop();
      throw error;
    }

    return res.status(201).json({
      message: "Campus directory entry added. The user must complete email OTP verification and set their own password before signing in.",
    });
  } catch (err) {
    console.error("addUserToDirectoryByAdmin failed:", err);
    return res.status(500).json({
      message: "Could not add the user to the campus directory.",
    });
  }
}

async function deleteUserByAdmin(req, res) {
  try {
    if (req.auth?.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can delete a user",
      });
    }

    const { id, type } = req.body;
    const cleanId = typeof id === "string" ? id.trim() : "";

    if (!cleanId || !type) {
      return res.status(400).json({
        message: "Id and type is required",
      });
    }

    if (!new Set(["student", "staff"]).has(type)) {
      return res.status(400).json({
        message: "Only student and staff accounts can be removed here.",
      });
    }

    const isStudent = type === "student";
    const directory = isStudent ? studentData : staffData;
    const filePath = isStudent ? studentFilePath : staffFilePath;
    const idField = isStudent ? "rollno" : "staffId";
    const model = isStudent ? studentModel : staffModel;
    const directoryIndex = directory.findIndex(
      (entry) => String(entry[idField]) === cleanId,
    );
    const account = await model.findOne({ [idField]: Number(cleanId) });

    if (!account && directoryIndex === -1) {
      return res.status(404).json({
        message: `No ${type} account or directory entry was found for that ID.`,
      });
    }

    // Store identity snapshots before deleting the account so historical
    // complaints remain readable after their populated references disappear.
    if (account) {
      const identitySnapshot = {
        name: account.username,
        campusId: cleanId,
        email: account.email,
        role: type,
      };
      const actorSnapshot = { name: account.username, campusId: cleanId };
      const updates = [
        complaintModel.updateMany(
          { user: account._id, userRef: type },
          { $set: { userSnapshot: identitySnapshot } },
        ),
        complaintModel.updateMany(
          {
            statusHistory: {
              $elemMatch: { changedBy: account._id, changedByRole: type },
            },
          },
          {
            $set: {
              "statusHistory.$[event].changedBySnapshot": actorSnapshot,
            },
          },
          {
            arrayFilters: [
              { "event.changedBy": account._id, "event.changedByRole": type },
            ],
          },
        ),
        complaintModel.updateMany(
          {
            comments: {
              $elemMatch: { author: account._id, authorRole: type },
            },
          },
          { $set: { "comments.$[comment].authorSnapshot": actorSnapshot } },
          {
            arrayFilters: [
              { "comment.author": account._id, "comment.authorRole": type },
            ],
          },
        ),
      ];

      if (!isStudent) {
        const staffSnapshot = {
          name: account.username,
          campusId: cleanId,
          department: account.department,
        };
        updates.push(
          complaintModel.updateMany(
            { assignedStaff: account._id },
            { $set: { assignedStaffSnapshot: staffSnapshot } },
          ),
          complaintModel.updateMany(
            { resolvedBy: account._id },
            { $set: { resolvedBySnapshot: staffSnapshot } },
          ),
        );
      }

      await Promise.all(updates);
    }

    const [removedDirectoryEntry] = directoryIndex >= 0
      ? directory.splice(directoryIndex, 1)
      : [];

    try {
      if (removedDirectoryEntry) persistDirectory(filePath, directory);

      if (account) {
        await sessionModel.updateMany(
          { user: account._id, userRef: type, revoked: false },
          { $set: { revoked: true } },
        );

        const deletion = await model.deleteOne({ _id: account._id });
        if (deletion.deletedCount !== 1) {
          throw new Error("The account could not be removed from the database.");
        }
      }
    } catch (error) {
      if (removedDirectoryEntry) {
        directory.splice(directoryIndex, 0, removedDirectoryEntry);
        try {
          persistDirectory(filePath, directory);
        } catch (restoreError) {
          console.error("Could not restore the user directory after a failed deletion:", restoreError);
        }
      }
      throw error;
    }

    return res.status(200).json({
      message: account
        ? "User account removed, active sessions revoked, and complaint history retained."
        : "User removed from the campus registration directory.",
    });
  } catch (err) {
    console.error("deleteUserByAdmin failed:", err);
    return res.status(500).json({
      message: "Could not remove the user account.",
    });
  }
}

module.exports = {
  getUnassignedComplaints,
  getStaffByDepartment,
  getRegisteredAccounts,
  getAssignedComplaints,
  assignComplaint,
  reassignComplaint,
  addUserToDirectoryByAdmin,
  deleteUserByAdmin,
};
