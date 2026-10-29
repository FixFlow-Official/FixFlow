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
const { isCampusDirectoryReady } = require("./services/campusDirectoryMigration.service");

const app = express();

// Middlewares

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

// Keep health checks available while MongoDB or startup migration is unavailable.
app.get("/api/health", (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const directoryReady = isCampusDirectoryReady();
  const ready = databaseReady && directoryReady;

  return res.status(ready ? 200 : 503).json({
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


module.exports = app;
