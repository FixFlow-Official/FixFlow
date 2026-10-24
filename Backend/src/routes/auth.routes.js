const express = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleWare = require("../middlewares/auth.middleware");
const authValidatorMiddleware = require("../middlewares/validator.middleware");
const {
  otpRequestLimiter,
  otpVerifyLimiter,
} = require("../middlewares/otpRateLimit.middleware");
const { loginLimiter } = require("../middlewares/loginRateLimit.middleware");

const router = express.Router();

/**
 * @route api/auth/verify-user
 * @description verify user by id and send OTP to registered email
 * @access public
 */

router.post(
  "/verify-user",
  otpRequestLimiter,
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.idValidatorRule,
  authController.verifyUserAndSendEmail,
);

/**
 * @route api/auth/verify-email
 * @description verify user through OTP on their register Email
 * @access public
 */

router.post(
  "/verify-email",
  otpVerifyLimiter,
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.otpPurposeValidatorRule,
  authValidatorMiddleware.otpValidatorRule,
  authController.verifyEmail,
);

/**
 * @route api/auth/create-user
 * @description create user after successful user verification
 * @access public
 */

router.post(
  "/create-user",
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.passwordValidatorRule,
  authController.createUser,
);

/**
 * @route api/auth/login
 * @description login user by email and password
 * @access public
 */

router.post(
  "/login",
  loginLimiter,
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

router.post("/logout", authMiddleWare.logoutMiddleware, authController.logout);

/**
 * @route api/auth/logoutAll
 * @description logout the current user from all devices
 * @access public
 */

router.post(
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

/**
 * @route api/auth/verify-user-for-password
 * @description verify user for password change
 * @access public
 */

router.post(
  "/verify-user-for-password",
  otpRequestLimiter,
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.idValidatorRule,
  authController.verifyUser,
);

// Use /api/auth/verify-email after /verify-user-for-password,
// then continue to /api/auth/forgot-password.

/**
 * @route api/auth/forgot-password
 * @description change the previous password
 * @access public
 */

router.post(
  "/forgot-password",
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.passwordValidatorRule,
  authController.forgotPasswordChange,
);

module.exports = router;
