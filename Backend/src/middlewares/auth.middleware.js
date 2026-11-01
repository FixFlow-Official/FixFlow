const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const sessionModel = require("../models/session.model");
const bcrypt = require("bcrypt");
const campusDirectoryModel = require("../models/campusDirectory.model");
const config = require("../config/config");
const jwt = require("jsonwebtoken");

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

async function logoutMiddleware(req,res,next){
  
  const refreshToken = req.cookies.refreshToken;
  
    if (!refreshToken) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }
  
    try {
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

      const userId = decoded.id || decoded._id;
      const activeFilter = {
        user: userId,
        userRef: decoded.role,
        revoked: false,
        expiresAt: { $gt: new Date() },
      };
      let matchingSession = null;

      if (decoded.sessionId) {
        matchingSession = await sessionModel.findOne({
          ...activeFilter,
          _id: decoded.sessionId,
        });
        if (
          matchingSession &&
          !(await bcrypt.compare(refreshToken, matchingSession.refreshTokenHash))
        ) {
          matchingSession = null;
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
        return res.status(401).json({
          message:"Unauthorized"
        })
      }

      req.session = matchingSession;
      req.refreshToken = refreshToken;
      req.decoded = decoded;

      next();
  
    } catch (err) {
      return res.status(401).json({
        message: "Unauthorized",
        err,
      });
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

  try {
    const decoded = jwt.verify(accessToken, config.JWT_SECRET)

    if (!decoded.id || !decoded.role || !decoded.sessionId) {
      return res.status(401).json({ message: "Unauthorized" })
    }

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

    next()
  } catch {
    return res.status(401).json({ message: "Unauthorized" })
  }
}

module.exports = { registerMiddleware , logoutMiddleware , verifyAccessToken };
