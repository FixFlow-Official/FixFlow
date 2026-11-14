const config = require("./src/config/config");
const mongoose = require("mongoose");

// Validate deployment configuration before loading routes and external services.
config.validateConfig();

const app = require("./src/app");
const connectDB = require("./src/config/database");
const {
  backfillComplaintSlaDates,
  backfillComplaintUserSnapshots,
  ensureSlaPolicies,
  startSlaMonitor,
} = require("./src/services/sla.service");

const shutdownController = new AbortController();
const SHUTDOWN_TIMEOUT_MS = 15_000;
let shutdownStarted = false;
let stopSlaMonitor = null;
let stopWeeklyDigestCron = null;

if (String(process.env.ENABLE_WEEKLY_DIGEST).toLowerCase() === "true" || config.ENABLE_WEEKLY_DIGEST === true) {
  try {
    const cron = require("node-cron");
    const { sendWeeklyDigest } = require("./scripts/sendWeeklyDigest");
    const digestTask = cron.schedule(
      "0 9 * * 1",
      async () => {
        try {
          const result = await sendWeeklyDigest();
          console.log(`Weekly digest sent to ${result?.sentTo?.length || 0} recipients`);
        } catch (error) {
          console.error("Weekly digest failed:", error.message || error);
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );
    stopWeeklyDigestCron = () => digestTask.stop();
    console.log("Weekly executive facility digest cron is scheduled (every Monday 09:00 Asia/Kolkata)");
  } catch (cronError) {
    console.error("Could not initialize weekly digest cron:", cronError.message || cronError);
  }
}

// Serve readiness responses immediately; regular API requests receive 503 until
// MongoDB and the campus directory migration are ready.
const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`FixFlow backend is listening on ${config.HOST}:${config.PORT}`);
});

connectDB({ signal: shutdownController.signal })
  .then(async () => {
    if (shutdownController.signal.aborted) return;
    await ensureSlaPolicies();
    await backfillComplaintSlaDates();
    await backfillComplaintUserSnapshots();
    if (shutdownController.signal.aborted) return;
    stopSlaMonitor = startSlaMonitor();
    console.log("Complaint SLA monitoring is ready");
  })
  .catch((error) => {
    console.error("Database startup stopped unexpectedly:", error.message);
  });

async function shutdown(signalName) {
  if (shutdownStarted) return;
  shutdownStarted = true;

  console.log(`${signalName} received. Shutting down FixFlow backend.`);
  shutdownController.abort();
  stopSlaMonitor?.();
  stopWeeklyDigestCron?.();

  // Finish active requests first, but do not let a stuck client block shutdown forever.
  const forceCloseTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out; closing remaining connections.");
    server.closeAllConnections?.();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceCloseTimer.unref();

  server.close(async (error) => {
    if (error) {
      console.error("Could not close the HTTP server cleanly:", error.message);
      process.exitCode = 1;
    }

    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error("Could not close the database connection cleanly:", disconnectError.message);
      process.exitCode = 1;
    } finally {
      clearTimeout(forceCloseTimer);
    }
  });
}

server.on("error", (error) => {
  console.error("FixFlow backend server error:", error.message);
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection detected:", {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
  });
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception detected:", {
    message: error.message,
    stack: error.stack,
  });
  shutdown("uncaughtException");
});

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
