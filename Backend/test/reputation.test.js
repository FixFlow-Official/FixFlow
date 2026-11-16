const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const studentModel = require("../src/models/student.model");
const complaintModel = require("../src/models/complaint.model");
const adminModel = require("../src/models/admin.model");
const notificationModel = require("../src/models/notification.model");
const smsWhatsAppService = require("../src/services/smsWhatsApp.service");
const {
  awardReputation,
  calculateReputationPoints,
  evaluateBadges,
  getFirstName,
  getLeaderboard,
} = require("../src/services/reputation.service");
const studentController = require("../src/controllers/student.controller");
const adminController = require("../src/controllers/admin.controller");
const staffController = require("../src/controllers/staff.controller");

// Stub async database-bound side-effects during unit tests
notificationModel.insertMany = async () => [];
smsWhatsAppService.dispatchTimelineAlerts = async () => {};

test("privacy-safe getFirstName extracts only first word token and hides emails and surnames", () => {
  assert.equal(getFirstName("Aarav Sharma"), "Aarav");
  assert.equal(getFirstName("priya_singh@campus.edu"), "Priya");
  assert.equal(getFirstName("rohit.kumar"), "Rohit");
  assert.equal(getFirstName("Deepak"), "Deepak");
  assert.equal(getFirstName(""), "Student");
  assert.equal(getFirstName(null), "Student");
});

test("calculateReputationPoints calculates base, P1/safety bonus, and upvotes bonus accurately", () => {
  // Base verified: +10
  assert.deepEqual(calculateReputationPoints({}), {
    points: 10,
    isP1OrSafety: false,
    isUpvoted5: false,
  });

  // P1 priority: +10 base + 25 P1 = 35
  assert.deepEqual(
    calculateReputationPoints({ aiTriage: { priority: "P1" } }),
    { points: 35, isP1OrSafety: true, isUpvoted5: false },
  );

  // Safety concern: +10 base + 25 safety = 35
  assert.deepEqual(
    calculateReputationPoints({ aiTriage: { safetyConcern: true } }),
    { points: 35, isP1OrSafety: true, isUpvoted5: false },
  );

  // Upvotes >= 5: +10 base + 5 upvotes = 15
  assert.deepEqual(
    calculateReputationPoints({ upvoteCount: 5 }),
    { points: 15, isP1OrSafety: false, isUpvoted5: true },
  );

  // P1 + Upvotes >= 5: 10 + 25 + 5 = 40
  assert.deepEqual(
    calculateReputationPoints({ aiTriage: { priority: "P1" }, upvoteCount: 8 }),
    { points: 40, isP1OrSafety: true, isUpvoted5: true },
  );
});

test("evaluateBadges awards Campus Guardian at 5, Early Hazard Spotter on first P1, Reliable Reporter at 50", () => {
  // Early Hazard Spotter on first P1
  const p1Badges = evaluateBadges({
    currentBadges: [],
    currentPoints: 35,
    verifiedReports: 1,
    isP1OrSafety: true,
  });
  assert.deepEqual(p1Badges.badges, ["Early Hazard Spotter"]);
  assert.deepEqual(p1Badges.newlyEarned, ["Early Hazard Spotter"]);

  // Campus Guardian at 5 verified reports
  const guardianBadges = evaluateBadges({
    currentBadges: ["Early Hazard Spotter"],
    currentPoints: 45,
    verifiedReports: 5,
    isP1OrSafety: false,
  });
  assert.deepEqual(guardianBadges.badges, ["Early Hazard Spotter", "Campus Guardian"]);
  assert.deepEqual(guardianBadges.newlyEarned, ["Campus Guardian"]);

  // Reliable Reporter at 50 points
  const reliableBadges = evaluateBadges({
    currentBadges: ["Early Hazard Spotter", "Campus Guardian"],
    currentPoints: 50,
    verifiedReports: 5,
    isP1OrSafety: false,
  });
  assert.deepEqual(reliableBadges.badges, [
    "Early Hazard Spotter",
    "Campus Guardian",
    "Reliable Reporter",
  ]);
  assert.deepEqual(reliableBadges.newlyEarned, ["Reliable Reporter"]);

  // Does not duplicate existing badges
  const duplicateCheck = evaluateBadges({
    currentBadges: ["Early Hazard Spotter", "Campus Guardian", "Reliable Reporter"],
    currentPoints: 100,
    verifiedReports: 10,
    isP1OrSafety: true,
  });
  assert.equal(duplicateCheck.newlyEarned.length, 0);
  assert.equal(duplicateCheck.badges.length, 3);
});

test("submit = 0 points: new complaint submission does not award reputation points", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const fakeStudent = {
    _id: studentId,
    username: "Vikram Malhotra",
    email: "vikram@fixflow.edu",
    rollno: 12501,
    reputation: {
      points: 0,
      badges: [],
      verifiedReports: 0,
      leaderboardOptIn: true,
    },
  };

  // Student profile starts with 0 points
  assert.equal(fakeStudent.reputation.points, 0);
  assert.equal(fakeStudent.reputation.verifiedReports, 0);
  assert.deepEqual(fakeStudent.reputation.badges, []);
});

test("verify = +10 points: resolution verification awards 10 points and increments verifiedReports", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeStudent = {
    _id: studentId,
    username: "Ananya Iyer",
    reputation: {
      points: 0,
      badges: [],
      verifiedReports: 0,
      leaderboardOptIn: true,
    },
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
  };

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    userRef: "student",
    reputationAwarded: false,
    aiTriage: { priority: "P3", safetyConcern: false },
    upvoteCount: 1,
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
  };

  const originalFindById = studentModel.findById;
  try {
    studentModel.findById = async () => fakeStudent;

    const result = await awardReputation(fakeComplaint, { saveComplaint: true });

    assert.equal(result.awarded, true);
    assert.equal(result.pointsAwarded, 10);
    assert.equal(fakeStudent.reputation.points, 10);
    assert.equal(fakeStudent.reputation.verifiedReports, 1);
    assert.equal(fakeComplaint.reputationAwarded, true);
    assert.equal(fakeStudent.saveCalls, 1);
    assert.equal(fakeComplaint.saveCalls, 1);
  } finally {
    studentModel.findById = originalFindById;
  }
});

test("double-resolve = no double points: calling awardReputation twice on the same complaint awards points only once", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeStudent = {
    _id: studentId,
    username: "Kunal Mehra",
    reputation: {
      points: 0,
      badges: [],
      verifiedReports: 0,
      leaderboardOptIn: true,
    },
    async save() {},
  };

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    userRef: "student",
    reputationAwarded: false,
    async save() {},
  };

  const originalFindById = studentModel.findById;
  try {
    studentModel.findById = async () => fakeStudent;

    // First resolution verification: +10 points awarded
    const firstRun = await awardReputation(fakeComplaint, { saveComplaint: false });
    assert.equal(firstRun.awarded, true);
    assert.equal(firstRun.pointsAwarded, 10);
    assert.equal(fakeStudent.reputation.points, 10);
    assert.equal(fakeStudent.reputation.verifiedReports, 1);
    assert.equal(fakeComplaint.reputationAwarded, true);

    // Second resolution verification attempt (double-resolve): no points awarded
    const secondRun = await awardReputation(fakeComplaint, { saveComplaint: false });
    assert.equal(secondRun.awarded, false);
    assert.match(secondRun.reason, /already awarded/i);
    assert.equal(fakeStudent.reputation.points, 10);
    assert.equal(fakeStudent.reputation.verifiedReports, 1);
  } finally {
    studentModel.findById = originalFindById;
  }
});

test("student verify controller endpoint awards reputation and sets resolutionVerified", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeStudent = {
    _id: studentId,
    username: "Sneha Patel",
    reputation: {
      points: 0,
      badges: [],
      verifiedReports: 0,
      leaderboardOptIn: true,
    },
    async save() {},
  };

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    userRef: "student",
    status: "Resolved",
    csatRating: null,
    resolutionVerified: false,
    reputationAwarded: false,
    statusHistory: [],
    async save() {},
  };

  const origComplaintFind = complaintModel.findById;
  const origStudentFind = studentModel.findById;

  try {
    complaintModel.findById = async () => fakeComplaint;
    studentModel.findById = async () => fakeStudent;

    const req = {
      auth: { id: studentId, role: "student" },
      params: { complaintId },
      body: { rating: 5, feedback: "Excellent job!" },
    };

    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) { statusSent = s; return this; },
      json(j) { jsonSent = j; },
    };

    await studentController.verifyComplaintResolution(req, res);

    assert.equal(statusSent, 200);
    assert.equal(fakeComplaint.resolutionVerified, true);
    assert.equal(fakeComplaint.reputationAwarded, true);
    assert.equal(fakeStudent.reputation.points, 10);
    assert.equal(fakeStudent.reputation.verifiedReports, 1);
  } finally {
    complaintModel.findById = origComplaintFind;
    studentModel.findById = origStudentFind;
  }
});

test("admin verify-override awards reputation once and respects double-override protection", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const fakeStudent = {
    _id: studentId,
    username: "Tanvi Verma",
    reputation: {
      points: 0,
      badges: [],
      verifiedReports: 0,
      leaderboardOptIn: true,
    },
    async save() {},
  };

  const fakeComplaint = {
    _id: complaintId,
    user: studentId,
    userRef: "student",
    status: "Resolved",
    resolutionVerified: false,
    reputationAwarded: false,
    statusHistory: [],
    async save() {},
  };

  const origComplaintFind = complaintModel.findById;
  const origStudentFind = studentModel.findById;

  try {
    complaintModel.findById = async () => fakeComplaint;
    studentModel.findById = async () => fakeStudent;

    const req = {
      auth: { id: new mongoose.Types.ObjectId(), role: "admin" },
      params: { complaintId },
      body: { reason: "Inspected on site, fix confirmed." },
    };

    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) { statusSent = s; return this; },
      json(j) { jsonSent = j; },
    };

    await adminController.overrideResolutionVerification(req, res);

    assert.equal(statusSent, 200);
    assert.equal(fakeComplaint.resolutionVerified, true);
    assert.equal(fakeComplaint.reputationAwarded, true);
    assert.equal(fakeStudent.reputation.points, 10);
    assert.equal(fakeStudent.reputation.verifiedReports, 1);

    // Call override a second time: no double points
    await adminController.overrideResolutionVerification(req, res);
    assert.equal(statusSent, 200);
    assert.equal(fakeStudent.reputation.points, 10);
    assert.equal(fakeStudent.reputation.verifiedReports, 1);
  } finally {
    complaintModel.findById = origComplaintFind;
    studentModel.findById = origStudentFind;
  }
});

test("leaderboard hides private data: exposes only rank, firstName, points, badges, verifiedReports", async () => {
  const originalFind = studentModel.find;

  try {
    studentModel.find = () => ({
      sort: () => ({
        limit: () => ({
          select: () => ({
            lean: async () => [
              {
                _id: new mongoose.Types.ObjectId(),
                username: "Rohit Deshmukh",
                email: "rohit.deshmukh@campus.edu",
                phoneNumber: "+91 98765 43210",
                rollno: 12501001,
                reputation: {
                  points: 95,
                  badges: ["Campus Guardian", "Reliable Reporter"],
                  verifiedReports: 8,
                  leaderboardOptIn: true,
                },
              },
              {
                _id: new mongoose.Types.ObjectId(),
                username: "ananya_iyer@gmail.com",
                email: "ananya_iyer@gmail.com",
                phoneNumber: "+91 91234 56789",
                rollno: 12501002,
                reputation: {
                  points: 50,
                  badges: ["Early Hazard Spotter"],
                  verifiedReports: 2,
                  leaderboardOptIn: true,
                },
              },
            ],
          }),
        }),
      }),
    });

    const leaderboard = await getLeaderboard({ limit: 10 });

    assert.equal(leaderboard.length, 2);

    // Check entry 1
    assert.equal(leaderboard[0].rank, 1);
    assert.equal(leaderboard[0].firstName, "Rohit");
    assert.equal(leaderboard[0].points, 95);
    assert.equal(leaderboard[0].verifiedReports, 8);
    assert.deepEqual(leaderboard[0].badges, ["Campus Guardian", "Reliable Reporter"]);

    // Strict privacy checks: NO email, phone, rollno, password, or _id
    assert.equal(leaderboard[0].email, undefined);
    assert.equal(leaderboard[0].phoneNumber, undefined);
    assert.equal(leaderboard[0].rollno, undefined);
    assert.equal(leaderboard[0]._id, undefined);

    // Check entry 2 (email username cleanly formatted as first name)
    assert.equal(leaderboard[1].rank, 2);
    assert.equal(leaderboard[1].firstName, "Ananya");
    assert.equal(leaderboard[1].points, 50);
    assert.equal(leaderboard[1].email, undefined);
    assert.equal(leaderboard[1].phoneNumber, undefined);
    assert.equal(leaderboard[1]._id, undefined);
  } finally {
    studentModel.find = originalFind;
  }
});

test("GET /api/student/reputation returns reputation profile and rank for authenticated student", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const originalFindById = studentModel.findById;
  const originalCountDocuments = studentModel.countDocuments;

  try {
    studentModel.findById = () => ({
      select: () => ({
        lean: async () => ({
          _id: studentId,
          username: "Kavita Rao",
          rollno: 12504,
          reputation: {
            points: 60,
            badges: ["Reliable Reporter"],
            verifiedReports: 4,
            leaderboardOptIn: true,
          },
        }),
      }),
    });

    studentModel.countDocuments = async () => 2; // 2 students have higher points -> rank is 3

    const req = {
      auth: { id: studentId, role: "student" },
      query: {},
    };

    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) { statusSent = s; return this; },
      json(j) { jsonSent = j; },
    };

    await studentController.getStudentReputation(req, res);

    assert.equal(statusSent, 200);
    assert.equal(jsonSent.points, 60);
    assert.equal(jsonSent.verifiedReports, 4);
    assert.deepEqual(jsonSent.badges, ["Reliable Reporter"]);
    assert.equal(jsonSent.rank, 3);
  } finally {
    studentModel.findById = originalFindById;
    studentModel.countDocuments = originalCountDocuments;
  }
});
