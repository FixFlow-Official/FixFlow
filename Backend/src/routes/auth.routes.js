const express = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleWare = require("../middlewares/auth.middleware");

const router = express.Router();

/**
 * @route api/auth/verify-user
 * @description verify user by id and send OTP to registered email
 * @access public
 */

router.post(
  "/verify-user",
  authMiddleWare.registerMiddleware,
  authController.verifyUserAndSendEmail,
);

/**
 * @route api/auth/verify-email
 * @description verify user through OTP on their register Email
 * @access public
 */

router.post(
  "/verify-email",
  authMiddleWare.registerMiddleware,
  authController.verifyEmail,
);

/**
 * @route api/auth/create-user
 * @description create user after successfull user verification
 * @access public
 */

router.post(
  "/create-user",
  authMiddleWare.registerMiddleware,
  authController.createUser,
);

/**
 * @route api/auth/login
 * @description login user by email,password
 * @access public
 */

router.post(
  "/login",
  authMiddleWare.registerMiddleware,
  authController.loginController,
);

/**
 * @route api/auth/getMe
 * @description finds the current user
 * @access public
 */

router.get("/getMe", authController.getMe);

/**
 * @route api/auth/logout
 * @description logout the current user
 * @access public
 */

router.get("/logout", authMiddleWare.logoutMiddleware, authController.logout);

/**
 * @route api/auth/logoutAll
 * @description logout the current user from all devices
 * @access public
 */

router.get(
  "/logoutAll",
  authMiddleWare.logoutMiddleware,
  authController.logoutAll,
);

/**
 * @route api/auth/token-recreate
 * @description recreate the access token
 * @access public
 */

router.get(
  "/token-recreate",
  authMiddleWare.logoutMiddleware,
  authController.tokenRecreate,
);

module.exports = router;
