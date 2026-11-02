const studentDirectory = require("../data/officialStudentData.json");
const staffDirectory = require("../data/staffData.json");
const adminDirectory = require("../data/adminData.json");
const campusDirectoryModel = require("../models/campusDirectory.model");
const directoryMigrationModel = require("../models/directoryMigration.model");
const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");

const migrationKey = "campus-directory-json-to-mongodb-v1";
let campusDirectoryReady = false;

const directoryConfigs = [
  {
    type: "student",
    idField: "rollno",
    directory: studentDirectory,
    detailField: "course",
    accountModel: studentModel,
    accountSelect: "username rollno course email",
    accountToRecord: (account) => ({
      rollno: account.rollno,
      name: account.username,
      course: account.course,
      email: account.email,
    }),
  },
  {
    type: "staff",
    idField: "staffId",
    directory: staffDirectory,
    detailField: "department",
    accountModel: staffModel,
    accountSelect: "username staffId department email",
    accountToRecord: (account) => ({
      staffId: account.staffId,
      name: account.username,
      department: account.department,
      email: account.email,
    }),
  },
  {
    type: "admin",
    idField: "adminId",
    directory: adminDirectory,
    detailField: "designation",
    accountModel: adminModel,
    accountSelect: "username adminId designation email",
    accountToRecord: (account) => ({
      adminId: account.adminId,
      name: account.username,
      designation: account.designation,
      email: account.email,
    }),
  },
];

function toDirectoryRecord(config, entry) {
  const campusId = String(entry[config.idField] ?? "").trim();
  const name = String(entry.name ?? "").trim();
  const email = String(entry.email ?? "").trim().toLowerCase();

  if (!campusId || !name || !email) return null;

  return {
    type: config.type,
    campusId,
    name,
    email,
    [config.detailField]: String(entry[config.detailField] ?? "").trim(),
  };
}

/**
 * Imports the checked-in directory JSON files and any registered accounts
 * once, then leaves MongoDB as the sole runtime source of truth. $setOnInsert
 * makes an interrupted import safe to resume without resurrecting later deletes.
 */
async function migrateLegacyDirectoryFilesToMongo() {
  await campusDirectoryModel.init();

  const alreadyMigrated = await directoryMigrationModel.exists({ _id: migrationKey });
  if (alreadyMigrated) {
    campusDirectoryReady = true;
    return;
  }

  const operations = [];
  for (const config of directoryConfigs) {
    const registeredAccounts = await config.accountModel
      .find({})
      .select(config.accountSelect)
      .lean();
    const entries = [
      ...registeredAccounts.map(config.accountToRecord),
      ...config.directory,
    ];

    for (const entry of entries) {
      const record = toDirectoryRecord(config, entry);
      if (!record) continue;
      operations.push({
        updateOne: {
          filter: { type: record.type, campusId: record.campusId },
          update: { $setOnInsert: record },
          upsert: true,
        },
      });
    }
  }

  if (operations.length) {
    await campusDirectoryModel.bulkWrite(operations, { ordered: true });
  }

  try {
    await directoryMigrationModel.create({ _id: migrationKey, completedAt: new Date() });
  } catch (error) {
    // Multiple backend instances may complete the same idempotent import.
    if (error?.code !== 11000) throw error;
  }

  campusDirectoryReady = true;
}

function isCampusDirectoryReady() {
  return campusDirectoryReady;
}

module.exports = { migrateLegacyDirectoryFilesToMongo, isCampusDirectoryReady };
