const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const controller = require("../controllers/complaintConversation.controller");

const router = express.Router();

router.get("/:complaintId", verifyAccessToken, controller.getComplaintDetails);
router.get("/:complaintId/comments", verifyAccessToken, controller.getComplaintComments);
router.post("/:complaintId/comments", verifyAccessToken, controller.addComplaintComment);

module.exports = router;
