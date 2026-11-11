const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const otpModel = require("../src/models/otp.model");
const studentModel = require("../src/models/student.model");
const { requestPhoneOtp, verifyPhoneOtp } = require("../src/controllers/auth.controller");

function createMockRes() {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  return res;
}

test("requestPhoneOtp rejects invalid phone numbers", async () => {
  const req = {
    auth: { id: "student_1", role: "student" },
    body: { phoneNumber: "123" }, // too short
  };
  const res = createMockRes();

  const originalFindById = studentModel.findById;
  studentModel.findById = async () => ({ _id: "student_1", email: "student@example.edu" });

  try {
    await requestPhoneOtp(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.payload.message, /valid phone number/);
  } finally {
    studentModel.findById = originalFindById;
  }
});

test("requestPhoneOtp normalizes number, enforces cooldown, and creates OTP document", async () => {
  const originalStudentFind = studentModel.findById;
  const originalOtpFindOne = otpModel.findOne;
  const originalOtpFindOneAndUpdate = otpModel.findOneAndUpdate;

  studentModel.findById = async () => ({ _id: "student_1", email: "student@campus.edu" });

  // 1. First request succeeds
  otpModel.findOne = async () => null; // no previous cooldown
  let upsertedDoc = null;
  otpModel.findOneAndUpdate = async (filter, update) => {
    upsertedDoc = update;
    return update;
  };

  const req = {
    auth: { id: "student_1", role: "student" },
    body: { phoneNumber: "98765 43210" },
  };
  const res = createMockRes();

  try {
    await requestPhoneOtp(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.phoneNumber, "+919876543210");
    assert.equal(res.payload.retryAfterSeconds, 60);
    assert.ok(upsertedDoc);
    assert.equal(upsertedDoc.phoneNumber, "+919876543210");
    assert.equal(upsertedDoc.purpose, "phone-link");
    assert.ok(upsertedDoc.otpHash);

    // 2. Second immediate request hits 60s cooldown
    otpModel.findOne = async () => ({
      updatedAt: new Date(Date.now() - 10 * 1000), // 10s ago
    });
    const cooldownRes = createMockRes();
    await requestPhoneOtp(req, cooldownRes);

    assert.equal(cooldownRes.statusCode, 429);
    assert.match(cooldownRes.payload.message, /wait \d+ seconds/);
  } finally {
    studentModel.findById = originalStudentFind;
    otpModel.findOne = originalOtpFindOne;
    otpModel.findOneAndUpdate = originalOtpFindOneAndUpdate;
  }
});

test("verifyPhoneOtp enforces 6-digit format, increments attempts, and links phone on valid code", async () => {
  const originalOtpFindOne = otpModel.findOne;
  const originalOtpDelete = otpModel.findByIdAndDelete;
  const originalStudentFindAndUpdate = studentModel.findByIdAndUpdate;

  const validOtp = "729145";
  const otpHash = await bcrypt.hash(validOtp, 10);

  const mockOtpDoc = {
    _id: "otp_doc_1",
    userId: "student_1",
    userType: "student",
    purpose: "phone-link",
    phoneNumber: "+919876543210",
    otpHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    save: async function () {
      return this;
    },
  };

  otpModel.findOne = async () => mockOtpDoc;
  let deletedId = null;
  otpModel.findByIdAndDelete = async (id) => {
    deletedId = id;
    return mockOtpDoc;
  };

  let updatedUserFields = null;
  studentModel.findByIdAndUpdate = async (id, update) => {
    updatedUserFields = update.$set;
    return {
      _id: id,
      username: "Kohinoor",
      email: "student@campus.edu",
      role: "student",
      ...updatedUserFields,
    };
  };

  try {
    // 1. Rejects malformed OTP
    const invalidFormatReq = {
      auth: { id: "student_1", role: "student" },
      body: { otp: "abc" },
    };
    const res1 = createMockRes();
    await verifyPhoneOtp(invalidFormatReq, res1);
    assert.equal(res1.statusCode, 400);

    // 2. Rejects incorrect OTP and increments attempt
    const wrongCodeReq = {
      auth: { id: "student_1", role: "student" },
      body: { otp: "000000" },
    };
    const res2 = createMockRes();
    await verifyPhoneOtp(wrongCodeReq, res2);
    assert.equal(res2.statusCode, 400);
    assert.equal(mockOtpDoc.attempts, 1);
    assert.match(res2.payload.message, /4 attempts remaining/);

    // 3. Accepts correct OTP, deletes OTP document, and verifies user phone
    const correctReq = {
      auth: { id: "student_1", role: "student" },
      body: { otp: validOtp },
    };
    const res3 = createMockRes();
    await verifyPhoneOtp(correctReq, res3);
    assert.equal(res3.statusCode, 200);
    assert.equal(deletedId, "otp_doc_1");
    assert.ok(updatedUserFields);
    assert.equal(updatedUserFields.phoneNumber, "+919876543210");
    assert.equal(updatedUserFields.phoneNumberVerified, true);
    assert.equal(res3.payload.user.phoneNumberVerified, true);
  } finally {
    otpModel.findOne = originalOtpFindOne;
    otpModel.findByIdAndDelete = originalOtpDelete;
    studentModel.findByIdAndUpdate = originalStudentFindAndUpdate;
  }
});
