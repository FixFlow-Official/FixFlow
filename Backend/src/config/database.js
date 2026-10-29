const mongoose = require("mongoose");
const config = require("./config");
const { migrateLegacyDirectoryFilesToMongo } = require("../services/campusDirectoryMigration.service");

async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to Database");
    await migrateLegacyDirectoryFilesToMongo();
    console.log("Campus directory migration is ready");
  } catch (err) {
    console.error("Database connection or campus directory migration failed:", err);
  }
}

module.exports = connectDB;
