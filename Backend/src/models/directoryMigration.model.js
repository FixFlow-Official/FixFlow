const mongoose = require("mongoose");

const directoryMigrationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    completedAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "system_migrations" },
);

module.exports = mongoose.model("directoryMigration", directoryMigrationSchema);
