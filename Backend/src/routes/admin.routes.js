const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");
const adminReportsController = require("../controllers/adminReports.controller");
const slaController = require("../controllers/sla.controller");
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
  "/accounts/:accountId/password",
  verifyAccessToken,
  adminController.resetAccountPasswordByAdmin,
);

router.get("/reports/complaints", verifyAccessToken, adminReportsController.getComplaintReports);
router.get("/reports/executive", verifyAccessToken, adminReportsController.getExecutiveReports);
router.post("/reports/digest/send-now", verifyAccessToken, adminReportsController.sendDigestNow);
router.get("/sla", verifyAccessToken, slaController.getSlaOverview);
router.put("/sla/policies", verifyAccessToken, slaController.updateSlaPolicies);
router.get("/sla/complaints/:complaintId/history", verifyAccessToken, slaController.getComplaintSlaHistory);

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
  "/complaints/:complaintId/verify-override",
  verifyAccessToken,
  adminController.verifyOverrideComplaint,
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

function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can perform this action." });
  }
  return next();
}

router.get("/audit-queue", verifyAccessToken, requireAdmin, adminController.getAuditQueue);
router.patch(
  "/complaints/:complaintId/audit",
  verifyAccessToken,
  requireAdmin,
  adminController.resolveComplaintAudit,
);

module.exports = router;
