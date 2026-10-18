const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const staffController = require("../controllers/staff.controller");

const router = express.Router();

router.get(
  "/assigned-complaints",
  verifyAccessToken,
  staffController.getAssignedComplaints,
);

router.patch(
  "/complaints/:complaintId/status",
  verifyAccessToken,
  staffController.updateComplaintStatus,
);

module.exports = router;