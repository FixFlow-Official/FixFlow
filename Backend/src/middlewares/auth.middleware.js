const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const sessionModel = require("../models/session.model");
const bcrypt = require("bcrypt");
const campusDirectoryModel = require("../models/campusDirectory.model");
const config = require("../config/config");
const jwt = require("jsonwebtoken");
const { REFRESH_ROTATION_GRACE_MS } = require("../services/session.service");

async function registerMiddleware(req, res, next) {
  const { type } = req.body;

  const findIdField = {
    student: "rollno",
    staff: "staffId",
    admin: "adminId",
  };

  const userModels = {
    student: studentModel,
    staff: staffModel,
    admin: adminModel,
  };

  if (!Object.hasOwn(findIdField, type)) {
    return res.status(400).json({
      message: "Invalid user type",
    });
  }

  req.idField = findIdField[type];
  req.model = userModels[type];

  // Login only needs the account model. Registration and password recovery
  // also provide a campus ID, which must resolve against MongoDB's directory.
  if (req.body.id !== undefined && req.body.id !== null) {
    req.directoryEntry = await campusDirectoryModel.findOne({
      type,
      campusId: String(req.body.id).trim(),
    }).lean();
  }

  return next();
}

async function verifySessionMiddleware(req, res, next) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const userId = decoded.id || decoded._id;
    const activeFilter = {
      user: userId,
      userRef: decoded.role,
      revoked: false,
      expiresAt: { $gt: new Date() },
    };
    let matchingSession = null;
    let isGraceToken = false;

    if (decoded.sessionId) {
      matchingSession = await sessionModel.findOne({
        ...activeFilter,
        _id: decoded.sessionId,
      });
      if (matchingSession) {
        const matchesCurrent = await bcrypt.compare(refreshToken, matchingSession.refreshTokenHash);
        if (!matchesCurrent) {
          const now = Date.now();
          const rotatedAtMs = matchingSession.rotatedAt
            ? new Date(matchingSession.rotatedAt).getTime()
            : 0;
          const isWithinGrace =
            matchingSession.previousRefreshTokenHash &&
            rotatedAtMs > 0 &&
            now - rotatedAtMs <= REFRESH_ROTATION_GRACE_MS;

          if (
            isWithinGrace &&
            (await bcrypt.compare(refreshToken, matchingSession.previousRefreshTokenHash))
          ) {
            isGraceToken = true;
          } else {
            matchingSession = null;
          }
        }
      }
    } else {
      // Transitional compatibility for refresh cookies issued before
      // sessionId was added to refresh-token claims.
      const legacySessions = await sessionModel.find(activeFilter);
      for (const session of legacySessions) {
        if (await bcrypt.compare(refreshToken, session.refreshTokenHash)) {
          matchingSession = session;
          break;
        }
      }
    }

    if (!matchingSession) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.session = matchingSession;
    req.refreshToken = refreshToken;
    req.decoded = decoded;
    req.isGraceToken = isGraceToken;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null

  if (!accessToken) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  let decoded;
  try {
    decoded = jwt.verify(accessToken, config.JWT_SECRET);
  } catch (error) {
    const isExpired = error?.name === "TokenExpiredError";
    return res.status(401).json({
      message: isExpired ? "Access token has expired." : "Unauthorized",
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    });
  }

  if (!decoded.id || !decoded.role || !decoded.sessionId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const activeSession = await sessionModel.findOne({
      _id: decoded.sessionId,
      user: decoded.id,
      userRef: decoded.role,
      revoked: false,
      expiresAt: { $gt: new Date() },
    })

    if (!activeSession) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    req.auth = decoded
    req.accessToken = accessToken

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerMiddleware,
  verifySessionMiddleware,
  logoutMiddleware: verifySessionMiddleware,
  verifyAccessToken,
};
