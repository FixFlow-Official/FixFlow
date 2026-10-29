const app = require("./src/app");
const connectDB = require("./src/config/database");
const mongoose = require("mongoose");

const shutdownController = new AbortController();

// Serve readiness responses immediately; regular API requests receive 503 until
// MongoDB and the campus directory migration are ready.
const server = app.listen(3000, "127.0.0.1", () => {
  console.log("Server is running on port 3000");
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
