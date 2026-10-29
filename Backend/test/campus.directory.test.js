const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const config = require("../src/config/config");
const campusDirectoryModel = require("../src/models/campusDirectory.model");
const directoryMigrationModel = require("../src/models/directoryMigration.model");
const studentModel = require("../src/models/student.model");
const staffModel = require("../src/models/staff.model");
const adminModel = require("../src/models/admin.model");
const { registerMiddleware } = require("../src/middlewares/auth.middleware");
const { idValidatorRule } = require("../src/middlewares/validator.middleware");
const { validationResult } = require("express-validator");
const {
  addUserToDirectoryByAdmin,
  deleteUserByAdmin,
} = require("../src/controllers/admin.controller");
const { createUser } = require("../src/controllers/auth.controller");
const { migrateLegacyDirectoryFilesToMongo } = require("../src/services/campusDirectoryMigration.service");

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function withStubs(stubs, callback) {
  const originals = stubs.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, value] of stubs) target[key] = value;
  try {
    await callback();
  } finally {
    for (const [target, key, original] of originals) target[key] = original;
  }
}

test("imports legacy directory JSON once and does not repeat after migration marker exists", async () => {
  let migrated = false;
  let bulkWriteCallCount = 0;
  let importedOperations = [];
  const emptyAccounts = () => ({ select: () => ({ lean: async () => [] }) });

  await withStubs([
    [campusDirectoryModel, "init", async () => {}],
    [campusDirectoryModel, "bulkWrite", async (operations) => {
      bulkWriteCallCount += 1;
      importedOperations = operations;
    }],
    [directoryMigrationModel, "exists", async () => migrated],
    [directoryMigrationModel, "create", async () => { migrated = true; }],
    [studentModel, "find", emptyAccounts],
    [staffModel, "find", emptyAccounts],
    [adminModel, "find", emptyAccounts],
  ], async () => {
    await migrateLegacyDirectoryFilesToMongo();
    await migrateLegacyDirectoryFilesToMongo();
  });

  assert.equal(bulkWriteCallCount, 1);
  assert.equal(importedOperations.length, 19);
  assert.ok(importedOperations.some((operation) =>
    operation.updateOne.filter.type === "student" &&
    operation.updateOne.filter.campusId === "103" &&
    operation.updateOne.update.$setOnInsert.email === "pastsepaastak@gmail.com",
  ));
  assert.ok(importedOperations.every((operation) => operation.updateOne.upsert));
});

test("registration middleware resolves campus identity from MongoDB", async () => {
  let query;
  const expectedEntry = { type: "student", campusId: "103", name: "Past" };

  await withStubs([
    [campusDirectoryModel, "findOne", (filter) => {
      query = filter;
      return { lean: async () => expectedEntry };
    }],
  ], async () => {
    const req = { body: { type: "student", id: "103" } };
    let nextCalled = false;
    await registerMiddleware(req, makeResponse(), () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.directoryEntry, expectedEntry);
    assert.equal(req.idField, "rollno");
    assert.deepEqual(query, { type: "student", campusId: "103" });
  });
});

test("campus ID validation supports the shorter staff IDs in the directory", async () => {
  const req = { body: { id: "200" } };
  await idValidatorRule[0].run(req);
  assert.equal(validationResult(req).isEmpty(), true);

  const tooLongReq = { body: { id: "12345678901" } };
  await idValidatorRule[0].run(tooLongReq);
  assert.equal(validationResult(tooLongReq).isEmpty(), false);
});

test("registration creates an account using the MongoDB directory record", async () => {
  const secret = config.JWT_SECRET || "directory-test-secret";
  const token = jwt.sign(
    { id: "103", type: "student", purpose: "registration" },
    secret,
  );
  const directoryEntry = {
    name: "Past",
    email: "past@example.edu",
    course: "BCA",
  };
  let createdAccount;
  let cookieCleared = false;

  await withStubs([
    [campusDirectoryModel, "findOne", () => ({ lean: async () => directoryEntry })],
  ], async () => {
    const response = makeResponse();
    response.clearCookie = () => { cookieCleared = true; };
    await createUser(
      {
        body: { password: "a-secure-password", type: "student", termsAccepted: true },
        cookies: { token },
        model: {
          create: async (account) => {
            createdAccount = account;
            return { username: account.username, email: account.email, role: account.role };
          },
        },
        idField: "rollno",
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(cookieCleared, true);
    assert.equal(createdAccount.username, "Past");
    assert.equal(createdAccount.rollno, "103");
    assert.equal(createdAccount.email, "past@example.edu");
    assert.equal(createdAccount.course, "BCA");
    assert.equal(createdAccount.role, "student");
    assert.match(createdAccount.password, /^\$2[aby]\$/);
  });
});

test("admin directory additions write a registration entry to MongoDB", async () => {
  let createdRecord;
  const noMatch = () => ({ select: async () => null });

  await withStubs([
    [campusDirectoryModel, "findOne", noMatch],
    [campusDirectoryModel, "create", async (record) => { createdRecord = record; }],
    [studentModel, "findOne", noMatch],
  ], async () => {
    const response = makeResponse();
    await addUserToDirectoryByAdmin(
      {
        auth: { role: "admin" },
        body: {
          id: "123",
          name: "New Student",
          email: "NEW.STUDENT@example.edu",
          course: "BCA",
          type: "student",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(createdRecord, {
      type: "student",
      campusId: "123",
      name: "New Student",
      email: "new.student@example.edu",
      course: "BCA",
    });
  });
});

test("admin removal deletes an unregistered user's MongoDB directory entry", async () => {
  let deletedFilter;
  const directoryEntry = { _id: "directory-record" };
  const noAccount = async () => null;

  await withStubs([
    [campusDirectoryModel, "findOne", async () => directoryEntry],
    [campusDirectoryModel, "deleteOne", async (filter) => {
      deletedFilter = filter;
      return { deletedCount: 1 };
    }],
    [studentModel, "findOne", noAccount],
  ], async () => {
    const response = makeResponse();
    await deleteUserByAdmin(
      {
        auth: { role: "admin" },
        body: { id: "123", type: "student" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(deletedFilter, { _id: "directory-record" });
  });
});
