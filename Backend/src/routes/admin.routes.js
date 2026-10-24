const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");
const {
  idValidatorRule,
  typeValidatorRule,
} = require("../middlewares/validator.middleware");
const { registerMiddleware } = require("../middlewares/auth.middleware");
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

router.get("/staff", verifyAccessToken, adminController.getStaffByDepartment);

router.patch(
  "/complaints/:complaintId/assign",
  verifyAccessToken,
  adminController.assignComplaint,
);

router.patch(
  "/complaints/:complaintId/reassign",
  verifyAccessToken,
  adminController.reassignComplaint,
);

router.post(
  "/create-user-by-admin",
  verifyAccessToken,
  idValidatorRule,
  typeValidatorRule,
  registerMiddleware,
  adminController.createUserByAdmin,
);

router.post(
  "/delete-user-by-admin",
  verifyAccessToken,
  idValidatorRule,
  typeValidatorRule,
  registerMiddleware,
  adminController.deleteUserByAdmin
);

module.exports = router;
