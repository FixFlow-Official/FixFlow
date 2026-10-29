const mongoose = require("mongoose");
const config = require("./config");
const { migrateLegacyDirectoryFilesToMongo } = require("../services/campusDirectoryMigration.service");

function waitBeforeRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new Error("Database connection was cancelled."));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    function onAbort() {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason || new Error("Database connection was cancelled."));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function connectDB({
  signal,
  mongooseClient = mongoose,
  migrate = migrateLegacyDirectoryFilesToMongo,
  wait = waitBeforeRetry,
} = {}) {
  let attempt = 0;

  while (!signal?.aborted) {
    try {
      if (mongooseClient.connection.readyState !== 1) {
        await mongooseClient.connect(config.MONGO_URI);
        console.log("Connected to Database");
      }

      await migrate();
      console.log("Campus directory migration is ready");
      return;
    } catch (error) {
      const delayMs = Math.min(1000 * 2 ** attempt, 30000);
      attempt += 1;
      console.error(
        `Database startup attempt ${attempt} failed. Retrying in ${Math.ceil(delayMs / 1000)}s:`,
        error.message,
      );

      try {
        await wait(delayMs, signal);
      } catch (retryError) {
        if (!signal?.aborted) throw retryError;
      }
    }
  }

  if (signal?.aborted) return;
}

module.exports = connectDB;
module.exports.waitBeforeRetry = waitBeforeRetry;
