const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const staffController = require("../controllers/staff.controller");
const multerMiddleware = require("../middlewares/multer.middleware");

const router = express.Router();

router.get(
  "/assigned-complaints",
  verifyAccessToken,
  staffController.getAssignedComplaints,
);

router.patch(
  "/complaints/:complaintId/status",
  verifyAccessToken,
  multerMiddleware.single("resolutionProof"),
  staffController.updateComplaintStatus,
);

module.exports = router;