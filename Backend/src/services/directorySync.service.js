const fs = require("node:fs");
const path = require("node:path");
const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const studentDirectory = require("../data/officialStudentData.json");
const staffDirectory = require("../data/staffData.json");
const adminDirectory = require("../data/adminData.json");

const directoryConfigs = [
  {
    model: studentModel,
    idField: "rollno",
    directory: studentDirectory,
    filePath: path.join(__dirname, "../data/officialStudentData.json"),
    select: "username rollno course email",
    toRecord: (account) => ({
      rollno: account.rollno,
      name: account.username,
      course: account.course,
      email: account.email,
    }),
  },
  {
    model: staffModel,
    idField: "staffId",
    directory: staffDirectory,
    filePath: path.join(__dirname, "../data/staffData.json"),
    select: "username staffId department email",
    toRecord: (account) => ({
      staffId: account.staffId,
      name: account.username,
      department: account.department,
      email: account.email,
    }),
  },
  {
    model: adminModel,
    idField: "adminId",
    directory: adminDirectory,
    filePath: path.join(__dirname, "../data/adminData.json"),
    select: "username adminId designation email role",
    toRecord: (account) => ({
      adminId: account.adminId,
      name: account.username,
      designation: account.designation,
      email: account.email,
      role: account.role,
    }),
  },
];

function sameId(left, right) {
  if (String(left) === String(right)) return true;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
}

function writeDirectory(filePath, records) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(records, null, 2), "utf8");
  fs.renameSync(temporaryPath, filePath);
}

/**
 * Ensures every registered MongoDB account is reflected in its JSON directory.
 * Existing directory-only entries are retained so invited users can still
 * complete email OTP registration before a MongoDB account exists.
 */
async function syncRegisteredAccountsToDirectories() {
  for (const config of directoryConfigs) {
    const accounts = await config.model.find({}).select(config.select).lean();
    let changed = false;

    for (const account of accounts) {
      const record = config.toRecord(account);
      const existing = config.directory.find((entry) =>
        sameId(entry[config.idField], record[config.idField]),
      );

      if (existing) {
        const recordChanged = Object.entries(record).some(
          ([field, value]) => existing[field] !== value,
        );
        if (recordChanged) {
          Object.assign(existing, record);
          changed = true;
        }
      } else {
        config.directory.push(record);
        changed = true;
      }
    }

    if (changed) writeDirectory(config.filePath, config.directory);
  }
}

module.exports = { syncRegisteredAccountsToDirectories };
