const express = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleWare = require("../middlewares/auth.middleware");
const authValidatorMiddleware = require("../middlewares/validator.middleware");

const router = express.Router();

/**
 * @route api/auth/verify-user
 * @description verify user by id and send OTP to registered email
 * @access public
 */

router.post(
  "/verify-user",
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
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.otpValidatorRule,
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
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.passwordValidatorRule,
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

router.post(
  "/verify-user-for-password",
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.typeValidatorRule,
  authValidatorMiddleware.idValidatorRule,
  authController.verifyUser,
);

router.post(
  "/forgot-password",
  authMiddleWare.registerMiddleware,
  authValidatorMiddleware.passwordValidatorRule,
  authController.forgotPasswordChange,
);

module.exports = router;
