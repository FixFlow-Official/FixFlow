const mongoose = require("mongoose");
const config = require("./config");
const { syncRegisteredAccountsToDirectories } = require("../services/directorySync.service");

async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to Database");
    await syncRegisteredAccountsToDirectories();
    console.log("Campus directory files synchronized with registered accounts");
  } catch (err) {
    console.error("Database connection or directory synchronization failed:", err);
  }
}

module.exports = connectDB;
