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

async function createUserByAdmin(req, res) {
  try {
    if (req.auth?.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create users",
      });
    }

    const { id, name, email, course, type } = req.body;

    if (!id || !name || !email || !course || !type) {
      return res.status(400).json({
        message: "Please enter all the fields for creating a user",
      });
    }

    const userData = req.userData;
    const idField = req.idField;

    const user = userData.find((s) => s[idField] === id || s.email === email);

    if (user) {
      return res.status(400).json({
        message: "User already exists with id or email",
      });
    }

    if (type === "student") {
      studentData.push({
        rollno: id,
        name: name,
        course: course,
        email: email,
      });
      fs.writeFileSync(studentFilePath, JSON.stringify(studentData, null, 2));
    }

    if (type === "staff") {
      staffData.push({
        staffId: id,
        name: name,
        department: course,
        email: email,
      });
      fs.writeFileSync(staffFilePath, JSON.stringify(staffData, null, 2));
    }

    res.status(201).json({
      message: "User created successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "something went wrong",
      error: err.message,
    });
  }
}

async function deleteUserByAdmin(req, res) {
  try {
    if (req.auth?.role !== "admin") {
      return res.status(400).json({
        message: "Only admins can delete a user",
      });
    }

    const { id, type } = req.body;

    if (!id || !type) {
      return res.status(400).json({
        message: "Id and type is required",
      });
    }

    const model = req.model;
    const idField = req.idField;

    await model.findOneAndDelete({ [idField]: id });

    if (type === "student") {
      const index = studentData.findIndex((s) => s.rollno === Number(id));

      if (index === -1) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      studentData.splice(index, 1);

      fs.writeFileSync(studentFilePath, JSON.stringify(studentData, null, 2));
    } else if (type === "staff") {
      const index = staffData.findIndex((s) => s.staffId === Number(id));

      if (index === -1) {
        return res.status(404).json({
          message: "Staff not found",
        });
      }

      staffData.splice(index, 1);

      fs.writeFileSync(staffFilePath, JSON.stringify(staffData, null, 2));
    }

    return res.status(200).json({
      message: "User deleted and file updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
      error: err.message,
    });
  }
}

module.exports = {
  getUnassignedComplaints,
  getStaffByDepartment,
  getAssignedComplaints,
  assignComplaint,
  reassignComplaint,
  createUserByAdmin,
  deleteUserByAdmin,
};
