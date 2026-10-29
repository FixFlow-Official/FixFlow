const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const otpModel = require("../models/otp.model");
const { getOtp, getHtml } = require("../utils/utils");
const sendEmail = require("../services/email.service");
const sessionModel = require("../models/session.model");
const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const campusDirectoryModel = require("../models/campusDirectory.model");
const blackListTokenModel = require("../models/blackListToken.model");
const uploadFile = require("../services/storage.service");

function serializeCurrentUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    role: user.role,
    campusId: user.rollno ?? user.staffId ?? user.adminId ?? null,
    detail: user.course ?? user.department ?? user.designation ?? null,
    profilePictureUrl: user.profilePictureUrl || null,
  };
}

const accountModels = {
  student: studentModel,
  staff: staffModel,
  admin: adminModel,
};

async function updateProfile(req, res) {
  const model = accountModels[req.auth?.role];
  if (!model) return res.status(403).json({ message: "This account cannot update a profile." });

  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  if (username.length < 2 || username.length > 60) {
    return res.status(400).json({ message: "Name must be between 2 and 60 characters." });
  }

  try {
    const update = { username };
    if (req.file) {
      const uploadResult = await uploadFile(
        req.file.buffer,
        `profile-${req.auth.role}-${req.auth.id}-${Date.now()}`,
        "/profiles",
      );
      if (!uploadResult?.url) {
        return res.status(502).json({ message: "Could not upload the profile photo." });
      }
      update.profilePictureUrl = uploadResult.url;
    } else if (req.body.removeProfilePicture === "true") {
      update.profilePictureUrl = null;
    }

    // Use a targeted update so legacy accounts missing newer required fields
    // (for example adminId/designation) can still update their profile.
    const user = await model.findByIdAndUpdate(
      req.auth.id,
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!user) return res.status(404).json({ message: "Account not found." });

    return res.status(200).json({
      message: "Profile updated successfully.",
      user: serializeCurrentUser(user),
    });
  } catch (err) {
    console.error("updateProfile failed:", err);
    return res.status(500).json({ message: "Could not update your profile." });
  }
}

async function changePassword(req, res) {
  const model = accountModels[req.auth?.role];
  if (!model) return res.status(403).json({ message: "This account cannot change its password." });

  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ message: "Enter your current password." });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 20) {
    return res.status(400).json({ message: "New password must be between 8 and 20 characters." });
  }

  try {
    const user = await model.findById(req.auth.id);
    if (!user) return res.status(404).json({ message: "Account not found." });

    const currentMatches = await bcrypt.compare(currentPassword, user.password);
    if (!currentMatches) return res.status(400).json({ message: "Current password is incorrect." });

    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) return res.status(400).json({ message: "Choose a password you have not used for this account." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Keep the current device signed in and revoke the other sessions.
    await sessionModel.updateMany(
      { user: user._id, userRef: req.auth.role, revoked: false, _id: { $ne: req.auth.sessionId } },
      { $set: { revoked: true } },
    );

    return res.status(200).json({ message: "Password changed. Other active sessions have been signed out." });
  } catch (err) {
    console.error("changePassword failed:", err);
    return res.status(500).json({ message: "Could not change your password." });
  }
}

/**
 *
 * @route verifyUserAndSendEmail
 * @description accepts id,type to verify user and send OTP
 * @access public
 */

async function verifyUserAndSendEmail(req, res) {
  const { id, type } = req.body;

  const userFound = req.directoryEntry;
  const idField = req.idField;

  if (!userFound) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const model = req.model;
  const isUserAlreadyExists = await model.findOne({ [idField]: id });

  if (isUserAlreadyExists) {
    return res.status(409).json({
      message: "User alredy exists",
    });
  }

  const previousOtp = await otpModel.findOne({
    userId: String(id),
    userType: type,
    purpose: "registration",
  });

  if (previousOtp?.updatedAt) {
    const secondsLeft = Math.ceil(
      (60_000 - (Date.now() - previousOtp.updatedAt.getTime())) / 1000,
    );

    if (secondsLeft > 0) {
      return res.status(429).json({
        message: `Please wait ${secondsLeft} seconds before requesting another code.`,
        retryAfterSeconds: secondsLeft,
      });
    }
  }

  const otp = getOtp();
  const html = getHtml(otp);
  const otpHash = await bcrypt.hash(String(otp), 10);

  await otpModel.findOneAndUpdate(
    {
      userId: id,
      userType: type,
      purpose: "registration",
    },
    {
      userId: id,
      userType: type,
      purpose: "registration",
      email: userFound.email,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    },
  );

  try {
    await sendEmail(
      userFound.email,
      "OTP Verification",
      `Your OTP is ${otp}`,
      html,
    );
  } catch {
    await otpModel.deleteOne({
      userId: String(id),
      userType: type,
      purpose: "registration",
    });

    return res.status(500).json({
      message: "Could not send the verification email. Please try again.",
    });
  }

  return res.status(200).json({
    message:
      "User found successfully. Verification OTP has been sent to your registered email",
  });
}

/**
 *
 * @route verifyEmail
 * @description accepts OTP,id,type to verify email
 * @access public
 */

async function verifyEmail(req, res) {
  const { otp, id, type, purpose = "registration" } = req.body;

  const userFound = req.directoryEntry;

  if (!userFound) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const otpDoc = await otpModel.findOne({
    userId: id,
    userType: type,
    purpose,
  });

  if (!otpDoc || otpDoc.expiresAt <= new Date()) {
    return res.status(401).json({
      message: "OTP not found or expired",
    });
  }

  if (otpDoc.attempts >= 5) {
    await otpModel.findByIdAndDelete(otpDoc._id);
    return res.status(429).json({
      message: "Too many incorrect attempts. Request a new code.",
    });
  }

  const isOtpValid = await bcrypt.compare(String(otp), otpDoc.otpHash);

  if (!isOtpValid) {
    otpDoc.attempts += 1;

    if (otpDoc.attempts >= 5) {
      await otpModel.findByIdAndDelete(otpDoc._id);
      return res.status(429).json({
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    await otpDoc.save();

    return res.status(401).json({
      message: "Invalid OTP",
    });
  }

  const token = jwt.sign(
    {
      id: String(id),
      type,
      purpose,
    },
    config.JWT_SECRET,
    {
      expiresIn: "10m",
    },
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1000 * 60 * 10,
  });

  await otpModel.findByIdAndDelete(otpDoc._id);

  return res.status(200).json({
    message: "OTP verified successfully",
  });
}

/**
 *
 * @route createUser
 * @description accepts password,type to create user
 * @access public
 */

async function createUser(req, res) {
  const { password, type, termsAccepted } = req.body;

  if (termsAccepted !== true) {
    return res.status(400).json({
      message: "You must accept the Terms and Conditions to create an account.",
    });
  }
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    if (decoded.type !== type || decoded.purpose !== "registration") {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const model = req.model;
    const idField = req.idField;
    const userFound = await campusDirectoryModel.findOne({
      type,
      campusId: String(decoded.id),
    }).lean();

    const depField = {
      student: "course",
      staff: "department",
      admin: "designation",
    };

    if (!userFound) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const dep = depField[type];

    if (!model || !idField || !dep) {
      return res.status(400).json({
        message: "Invalid user role",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await model.create({
      username: userFound.name,
      [idField]: decoded.id,
      email: userFound.email,
      [dep]: userFound[dep],
      password: passwordHash,
      role: type,
      termsAcceptedAt: new Date(),
      termsVersion: "1.0",
    });

    res.clearCookie("token");

    return res.status(201).json({
      message: "User created successfully",
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(401).json({
      message: "Invalid Token",
      err,
    });
  }
}

/**
 *
 * @route loginController
 * @description accepts email,password,role to login
 * @access public
 */

async function loginController(req, res) {
  const { email, password, type } = req.body;
  const model = req.model;

  const user = await model.findOne({ email, role: type });
  // Keep password verification work similar for known and unknown accounts.
  const dummyPasswordHash =
    "$2b$10$eByht8xocCeuHHt8b/WIfOUO5cOTqaPMHdrwbKbPrQWJKXdlwT3vi";
  const isPasswordCorrect = await bcrypt.compare(
    password,
    user?.password || dummyPasswordHash,
  );

  if (!user || !isPasswordCorrect) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  const refreshToken = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  const session = await sessionModel.create({
    user: user.id,
    userRef: user.role,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const accessToken = jwt.sign(
    {
      id: user.id,
      sessionId: session.id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  return res.status(200).json({
    message: "User logged in successfully",
    user: serializeCurrentUser(user),
    accessToken,
  });
}

/**
 *
 * @route getMe
 * @description access the current user
 * @access public
 */

async function getMe(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userModels = {
    student: studentModel,
    staff: staffModel,
    admin: adminModel,
  };

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    const model = userModels[decoded.role];

    if (!model) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const activeSessions = await sessionModel.find({
      user: decoded.id,
      userRef: decoded.role,
      revoked: false,
    });

    let hasMatchingSession = false;

    for (const session of activeSessions) {
      const matches = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );

      if (matches) {
        hasMatchingSession = true;
        break;
      }
    }

    if (!hasMatchingSession) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await model.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json({ user: serializeCurrentUser(user) });
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

/**
 *
 * @route logout
 * @description logout the current user
 * @access public
 */

async function logout(req, res) {
  try {
    const sessions = req.sessions;
    const refreshToken = req.refreshToken;
    const decoded = req.decoded;

    let targetSession = null;

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );

      if (isMatch) {
        targetSession = session;
        break;
      }
    }

    if (!targetSession) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    targetSession.revoked = true;
    await targetSession.save();

    const authHeader = req.headers.authorization;
    const accessToken =
      req.accessToken || (authHeader && authHeader.split(" ")[1]);

    if (!accessToken) {
      return res.status(400).json({
        message: "Access token is required",
      });
    }

    const accessTokenHash = await bcrypt.hash(accessToken, 10);

    await blackListTokenModel.create({
      user: decoded.id || decoded._id,
      userRef: decoded.role,
      accessTokenHash,
      expiresAt: new Date(decoded.exp * 1000),
    });

    res.clearCookie("refreshToken");

    return res.status(200).json({
      message: "User logged out successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "something went wrong",
      error: err.message,
    });
  }
}

/**
 *
 * @route logoutAll
 * @description logout the current user from all devices
 * @access public
 */

async function logoutAll(req, res) {
  try {
    const sessions = req.sessions;
    const decoded = req.decoded;

    for (const session of sessions) {
      session.revoked = true;
      await session.save();
    }

    const authHeader = req.headers.authorization;
    const accessToken =
      req.accessToken || (authHeader && authHeader.split(" ")[1]);

    if (!accessToken) {
      return res.status(400).json({
        message: "Access token is required",
      });
    }

    const accessTokenHash = await bcrypt.hash(accessToken, 10);

    await blackListTokenModel.create({
      user: decoded.id || decoded._id,
      userRef: decoded.role,
      accessTokenHash,
      expiresAt: new Date(decoded.exp * 1000),
    });

    res.clearCookie("refreshToken");

    return res.status(200).json({
      message: "User logged out from all devices successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "something went wrong",
      err,
    });
  }
}

/**
 *
 * @route tokenRecreate
 * @description recreate the access token
 * @access public
 */

async function tokenRecreate(req, res) {
  try {
    const sessions = req.sessions;
    const refreshToken = req.refreshToken;
    const decoded = req.decoded;

    let targetSession = null;

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );

      if (isMatch) {
        targetSession = session;
        break;
      }
    }

    if (!targetSession) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const accessToken = jwt.sign(
      {
        id: decoded.id || decoded._id,
        sessionId: targetSession.id,
        role: decoded.role,
      },
      config.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    const newRefreshToken = jwt.sign(
      {
        id: decoded.id || decoded._id,
        role: decoded.role,
      },
      config.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await sessionModel.findOneAndUpdate(
      { _id: targetSession._id },
      { refreshTokenHash: newRefreshTokenHash },
    );

    await targetSession.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(200).json({
      message: "Token refreshed successfully",
      accessToken,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
      err,
    });
  }
}

/**
 *
 * @route verifyUser
 * @description verify User for password change
 * @access public
 */

async function verifyUser(req, res) {
  const { id, type } = req.body;
  const idField = req.idField;

  const userFound = req.directoryEntry;

  if (!userFound) {
    return res.status(404).json({
      message: "No account found for that campus ID.",
    });
  }

  const existingAccount = await req.model.findOne({
    [idField]: id,
  });

  if (!existingAccount) {
    return res.status(404).json({
      message: "No account found for that campus ID.",
    });
  }

  const previousOtp = await otpModel.findOne({
    userId: String(id),
    userType: type,
    purpose: "password-reset",
  });

  if (previousOtp?.updatedAt) {
    const secondsLeft = Math.ceil(
      (60_000 - (Date.now() - previousOtp.updatedAt.getTime())) / 1000,
    );

    if (secondsLeft > 0) {
      return res.status(429).json({
        message: `Please wait ${secondsLeft} seconds before requesting another code.`,
        retryAfterSeconds: secondsLeft,
      });
    }
  }

  const otp = getOtp();
  const html = getHtml(otp, "password-reset");
  const otpHash = await bcrypt.hash(String(otp), 10);

  await otpModel.findOneAndUpdate(
    {
      userId: String(id),
      userType: type,
      purpose: "password-reset",
    },
    {
      userId: String(id),
      userType: type,
      purpose: "password-reset",
      email: userFound.email,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    },
  );

  try {
    await sendEmail(
      userFound.email,
      "Password reset code",
      `Your password reset code is ${otp}`,
      html,
    );
  } catch {
    await otpModel.deleteOne({
      userId: String(id),
      userType: type,
      purpose: "password-reset",
    });

    return res.status(500).json({
      message: "Could not send the password reset email. Please try again.",
    });
  }

  return res.status(200).json({
    message: "A password reset code has been sent to your registered email.",
  });
}

/**
 *
 * @route forgotPasswordChange
 * @description Change the previous password
 * @access public
 */

async function forgotPasswordChange(req, res) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const { password, id, type } = req.body;

    if (
      String(decoded.id) !== String(id) ||
      decoded.type !== type ||
      decoded.purpose !== "password-reset"
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const model = req.model;
    const idField = req.idField;

    const user = await model.findOne({ [idField]: decoded.id });

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    await model.findOneAndUpdate(
      { [idField]: decoded.id },
      { password: passwordHash },
    );

    await sessionModel.updateMany(
      {
        user: user._id,
        userRef: type,
        revoked: false,
      },
      {
        revoked: true,
      },
    );

    res.clearCookie("token");

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized",
      error: err.message,
    });
  }
}

module.exports = {
  updateProfile,
  changePassword,
  verifyUserAndSendEmail,
  verifyEmail,
  createUser,
  loginController,
  getMe,
  logout,
  logoutAll,
  tokenRecreate,
  verifyUser,
  forgotPasswordChange,
};
