const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const sessionModel = require("../models/session.model");
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
  
      const sessions = await sessionModel.find({
        user: decoded.id || decoded._id,
        userRef: decoded.role,
        revoked: false,
      });

      if(!sessions || sessions.length === 0){
        return res.status(401).json({
          message:"Unauthorized"
        })
      }

      req.sessions = sessions;
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
