const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");
const {
  directoryIdValidatorRule,
  typeValidatorRule,
} = require("../middlewares/validator.middleware");
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

router.get("/accounts", verifyAccessToken, adminController.getRegisteredAccounts);

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
  "/directory/users",
  verifyAccessToken,
  directoryIdValidatorRule,
  typeValidatorRule,
  adminController.addUserToDirectoryByAdmin,
);

router.post(
  "/delete-user-by-admin",
  verifyAccessToken,
  directoryIdValidatorRule,
  typeValidatorRule,
  adminController.deleteUserByAdmin,
);

module.exports = router;
