const { body, validationResult } = require("express-validator");

async function validateResult(req, res, next) {
  const error = validationResult(req);

  if (!error.isEmpty()) {
    return res.status(400).json({ error: error.array() });
  }

  next();
}

const otpValidatorRule = [
  body("otp")
    .isNumeric()
    .withMessage("Id must be a number")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be of six digits"),

  validateResult,
];

const otpPurposeValidatorRule = [
  body("purpose")
    .optional()
    .isIn(["registration", "password-reset"])
    .withMessage("Purpose must be registration or password-reset"),

  validateResult,
];

const idValidatorRule = [
  body("id")
    .isNumeric()
    .withMessage("Id must be a number")
    .isLength({ min: 10, max: 10 })
    .withMessage("Length must be of 10 digit long"),

  validateResult,
];

// Campus directory IDs differ by role: staff IDs may be shorter than student IDs.
const directoryIdValidatorRule = [
  body("id")
    .isString()
    .withMessage("ID must be a string of digits")
    .isNumeric()
    .withMessage("ID must contain only digits")
    .isLength({ min: 1, max: 10 })
    .withMessage("ID must be between 1 and 10 digits"),

  validateResult,
];

const typeValidatorRule = [
  body("type")
    .isString()
    .withMessage("Role must be String")
    .isIn(["student", "staff", "admin"])
    .withMessage("Role must be either : student,staff or admin"),

  validateResult,
];

const passwordValidatorRule = [
  body("password")
    .isString()
    .withMessage("Password must be String")
    .isLength({ min: 8, max: 20 })
    .withMessage("Password must be between 8 to 20 characters"),

  validateResult,
];

module.exports = {
  typeValidatorRule,
  passwordValidatorRule,
  idValidatorRule,
  directoryIdValidatorRule,
  otpValidatorRule,
  otpPurposeValidatorRule,
};
