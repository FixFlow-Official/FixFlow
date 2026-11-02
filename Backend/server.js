const config = require("./src/config/config");
const mongoose = require("mongoose");

// Validate deployment configuration before loading routes and external services.
config.validateConfig();

const app = require("./src/app");
const connectDB = require("./src/config/database");

const shutdownController = new AbortController();

// Serve readiness responses immediately; regular API requests receive 503 until
// MongoDB and the campus directory migration are ready.
const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`FixFlow backend is listening on ${config.HOST}:${config.PORT}`);
});

connectDB({ signal: shutdownController.signal }).catch((error) => {
  console.error("Database startup stopped unexpectedly:", error.message);
});

async function shutdown(signalName) {
  console.log(`${signalName} received. Shutting down FixFlow backend.`);
  shutdownController.abort();

  server.close(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      process.exit(0);
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
