const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const authRouter = require("./routes/auth.routes");
const studentRouter = require("./routes/student.routes");
const adminRouter = require("./routes/admin.routes");
const staffRouter = require("./routes/staff.routes");
const complaintConversationRouter = require("./routes/complaintConversation.routes");
const notificationRouter = require("./routes/notification.routes");
const assistantRouter = require("./routes/assistant.routes");
const campusRouter = require("./routes/campus.routes");
const broadcastRouter = require("./routes/broadcast.routes");
const { isCampusDirectoryReady } = require("./services/campusDirectoryMigration.service");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");
const {
  requestIdMiddleware,
  structuredRequestLog,
} = require("./middlewares/requestId.middleware");
const securityHeaders = require("./middlewares/securityHeaders.middleware");
const config = require("./config/config");

const app = express();
app.disable("x-powered-by");
// Trust only an explicitly configured number of reverse-proxy hops.
app.set("trust proxy", config.TRUST_PROXY_HOPS);

// Assign an ID before parsing or logging so every request, including malformed
// JSON requests, can be traced through the response and server logs.
app.use(requestIdMiddleware);
app.use(securityHeaders);
app.use(morgan(structuredRequestLog));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

// Keep health checks available while MongoDB or startup migration is unavailable.
app.get("/api/health", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const directoryReady = isCampusDirectoryReady();
  const ready = databaseReady && directoryReady;

  return res.status(ready ? 200 : 503).json({
    requestId: req.requestId,
    status: ready ? "ready" : "starting",
    database: databaseReady ? "connected" : "disconnected",
    campusDirectory: directoryReady ? "ready" : "initializing",
  });
});

// Return an actionable API response while MongoDB is connecting instead of
// leaving Mongoose queries buffered until the Vite proxy times out.
app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState !== 1 || !isCampusDirectoryReady()) {
    return res.status(503).json({
      message: "The database is still connecting. Please retry in a moment.",
      requestId: req.requestId,
    });
  }

  return next();
});

//Routes used with prefix

app.use("/api/staff", staffRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/student", studentRouter);
app.use("/api/complaints", complaintConversationRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/campus", campusRouter);
app.use("/api", broadcastRouter);
app.use("/api/broadcasts", broadcastRouter);

// Keep unknown API paths and unexpected failures in the same JSON format.
app.use("/api", notFoundHandler);
app.use(errorHandler);

module.exports = app;
