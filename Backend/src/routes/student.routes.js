const express = require("express");
const {
  uploadSingleImage,
  validateImageSignature,
} = require("../middlewares/multer.middleware");
const {
  registerMiddleware,
  verifyAccessToken,
} = require("../middlewares/auth.middleware");

const studentController = require("../controllers/student.controller");

const router = express.Router();

/**
 *
 * @route api/student/create-complaint
 * @description accepts a Image,title,description to create a complaint
 * @access public
 */

router.post(
  "/create-complaint",
  verifyAccessToken,
  uploadSingleImage("complaintImage"),
  validateImageSignature,
  studentController.createComplaint,
);

/**
 *
 * @route api/student/get-complaint
 * @description get all the complaint created by a user
 * @access public
 */

router.get("/get-complaint", verifyAccessToken, studentController.getComplaint);

/**
 * @route api/student/similar-complaints
 * @description search open complaints in the same location to avoid duplicates
 */
router.get("/similar-complaints", verifyAccessToken, studentController.getSimilarComplaints);

/**
 * @route api/student/trending-complaints
 * @description active public campus issues sorted by upvote count to prevent duplicate tickets
 */
router.get("/trending-complaints", verifyAccessToken, studentController.getTrendingComplaints);

/**
 * @route api/student/complaints/:complaintId/upvote
 * @description toggle "Me Too" upvote for an existing complaint
 */
router.post("/complaints/:complaintId/upvote", verifyAccessToken, studentController.toggleUpvoteComplaint);

/**
 * @route api/student/complaints/:complaintId/verify-resolution
 * @description student confirms resolution with 1-5 star CSAT rating
 */
router.post(
  "/complaints/:complaintId/verify-resolution",
  verifyAccessToken,
  studentController.verifyComplaintResolution,
);

/**
 * @route api/student/complaints/:complaintId/csat
 * @description student submits CSAT satisfaction rating (1-5) and feedback
 */
router.post(
  "/complaints/:complaintId/csat",
  verifyAccessToken,
  studentController.submitCsat,
);

/**
 * @route api/student/complaints/:complaintId/reopen
 * @description student reopens inadequate repair with explanation and optional proof photo
 */
router.post(
  "/complaints/:complaintId/reopen",
  verifyAccessToken,
  uploadSingleImage("image"),
  studentController.reopenComplaint,
);

/**
 * @route api/student/complaints/:complaintId/verification
 * @description student views resolution AI verification status
 */
router.get(
  "/complaints/:complaintId/verification",
  verifyAccessToken,
  studentController.getComplaintVerification,
);

/**
 * @route GET /api/student/reputation
 * @description student views points, badges, verified reports count, and rank
 */
router.get("/reputation", verifyAccessToken, studentController.getStudentReputation);

/**
 * @route PATCH /api/student/reputation
 * @description student updates reputation preferences (e.g. opt in/out of public leaderboard)
 */
router.patch("/reputation", verifyAccessToken, studentController.updateStudentReputation);

/**
 * @route GET /api/student/reputation/leaderboard
 * @route GET /api/student/leaderboard
 * @description opt-in student reputation leaderboard (first name only, no email/phone)
 */
router.get("/reputation/leaderboard", verifyAccessToken, studentController.getStudentLeaderboard);
router.get("/leaderboard", verifyAccessToken, studentController.getStudentLeaderboard);

module.exports = router;
