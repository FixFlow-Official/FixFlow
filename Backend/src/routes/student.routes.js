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
 * @route api/student/complaints/:complaintId/reopen
 * @description student reopens inadequate repair with explanation and optional proof photo
 */
router.post(
  "/complaints/:complaintId/reopen",
  verifyAccessToken,
  uploadSingleImage("image"),
  studentController.reopenComplaint,
);

module.exports = router;
