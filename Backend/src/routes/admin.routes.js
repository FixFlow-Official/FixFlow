const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

router.get(
  "/complaints/unassigned",
  verifyAccessToken,
  adminController.getUnassignedComplaints,
);

router.get(
  "/complaints/assigned",
  verifyAccessToken,
  adminController.getAssignedComplaints,
);

router.get(
  "/staff",
  verifyAccessToken,
  adminController.getStaffByDepartment,
);

router.patch(
  "/complaints/:complaintId/assign",
  verifyAccessToken,
  adminController.assignComplaint,
);

module.exports = router;