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

module.exports = router;
