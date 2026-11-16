const studentModel = require("../models/student.model");
const complaintModel = require("../models/complaint.model");

/**
 * Extracts a privacy-safe first name from a user's display name or username.
 * Never leaks surname, email, roll number, or phone numbers in public contexts.
 */
function getFirstName(username) {
  if (!username) return "Student";
  const raw = String(username).trim();
  // Strip email domain if username is an email address
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  // Get the first word token
  const token = beforeAt.split(/[\s._-]+/)[0] || beforeAt;
  if (!token) return "Student";
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Calculates reputation points for a verified complaint resolution.
 * Rules:
 *  - Base: +10 verified points
 *  - P1 or Safety hazard: +25 points
 *  - Community trending / upvotes >= 5: +5 points
 */
function calculateReputationPoints(complaint) {
  let points = 10; // Base: +10 verified

  const isP1 =
    complaint.aiTriage?.priority === "P1" ||
    complaint.priority === "P1";

  const isSafety = Boolean(
    complaint.aiTriage?.safetyConcern ||
    complaint.safetyConcern
  );

  const isP1OrSafety = isP1 || isSafety;
  if (isP1OrSafety) {
    points += 25; // +25 P1/safety
  }

  const upvoteCount = typeof complaint.upvoteCount === "number"
    ? complaint.upvoteCount
    : (Array.isArray(complaint.upvotes) ? complaint.upvotes.length : 0);

  const isUpvoted5 = upvoteCount >= 5;
  if (isUpvoted5) {
    points += 5; // +5 if upvoted by >= 5
  }

  return {
    points,
    isP1OrSafety,
    isUpvoted5,
  };
}

/**
 * Evaluates earned reputation badges.
 * Rules:
 *  - Campus Guardian: awarded at 5 verified reports
 *  - Early Hazard Spotter: awarded on first P1/safety report
 *  - Reliable Reporter: awarded at 50 points
 */
function evaluateBadges({ currentBadges = [], currentPoints = 0, verifiedReports = 0, isP1OrSafety = false }) {
  const updatedBadges = Array.isArray(currentBadges) ? [...currentBadges] : [];
  const newlyEarned = [];

  // Campus Guardian at 5 verified
  if (verifiedReports >= 5 && !updatedBadges.includes("Campus Guardian")) {
    updatedBadges.push("Campus Guardian");
    newlyEarned.push("Campus Guardian");
  }

  // Early Hazard Spotter on first P1
  if (isP1OrSafety && !updatedBadges.includes("Early Hazard Spotter")) {
    updatedBadges.push("Early Hazard Spotter");
    newlyEarned.push("Early Hazard Spotter");
  }

  // Reliable Reporter at 50 points
  if (currentPoints >= 50 && !updatedBadges.includes("Reliable Reporter")) {
    updatedBadges.push("Reliable Reporter");
    newlyEarned.push("Reliable Reporter");
  }

  return {
    badges: updatedBadges,
    newlyEarned,
  };
}

/**
 * Awards reputation to the student who submitted the complaint upon verified resolution.
 * Guaranteed to run ONCE per complaint (complaint.reputationAwarded flag).
 * Never awards points on submission.
 */
async function awardReputation(complaint, { saveComplaint = true } = {}) {
  if (!complaint) return null;

  // Once per complaint only
  if (complaint.reputationAwarded) {
    return {
      awarded: false,
      reason: "Reputation already awarded for this complaint.",
    };
  }

  // Points only for verified student reports
  if (complaint.userRef !== "student" || !complaint.user) {
    return {
      awarded: false,
      reason: "Complaint not submitted by a student.",
    };
  }

  const student = await studentModel.findById(complaint.user);
  if (!student) {
    return {
      awarded: false,
      reason: "Student not found.",
    };
  }

  // Initialize reputation structure if missing
  if (!student.reputation) {
    student.reputation = {
      points: 0,
      badges: [],
      verifiedReports: 0,
      leaderboardOptIn: true,
    };
  }

  const { points: pointsEarned, isP1OrSafety } = calculateReputationPoints(complaint);

  const updatedVerifiedReports = (student.reputation.verifiedReports || 0) + 1;
  const updatedPoints = (student.reputation.points || 0) + pointsEarned;

  const { badges: updatedBadges, newlyEarned } = evaluateBadges({
    currentBadges: student.reputation.badges,
    currentPoints: updatedPoints,
    verifiedReports: updatedVerifiedReports,
    isP1OrSafety,
  });

  student.reputation.points = updatedPoints;
  student.reputation.verifiedReports = updatedVerifiedReports;
  student.reputation.badges = updatedBadges;
  if (student.reputation.leaderboardOptIn === undefined) {
    student.reputation.leaderboardOptIn = true;
  }

  // Save student reputation
  if (typeof student.save === "function") {
    await student.save();
  } else if (studentModel.findByIdAndUpdate) {
    await studentModel.findByIdAndUpdate(student._id, {
      $set: { reputation: student.reputation },
    });
  }

  // Mark complaint reputation as awarded
  complaint.reputationAwarded = true;
  if (saveComplaint && typeof complaint.save === "function") {
    await complaint.save();
  }

  return {
    awarded: true,
    pointsAwarded: pointsEarned,
    newBadges: newlyEarned,
    reputation: student.reputation,
  };
}

/**
 * Retrieves the opt-in student reputation leaderboard.
 * Exposes ONLY rank, privacy-safe firstName, points, badges, and verifiedReports.
 * Never exposes email, phone number, student roll number, or IDs.
 */
async function getLeaderboard({ limit = 10 } = {}) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

  const students = await studentModel
    .find({
      "reputation.leaderboardOptIn": { $ne: false },
      "reputation.points": { $gt: 0 },
    })
    .sort({ "reputation.points": -1, "reputation.verifiedReports": -1 })
    .limit(safeLimit)
    .select("username reputation")
    .lean();

  return students.map((s, index) => ({
    rank: index + 1,
    firstName: getFirstName(s.username),
    points: s.reputation?.points || 0,
    badges: s.reputation?.badges || [],
    verifiedReports: s.reputation?.verifiedReports || 0,
  }));
}

module.exports = {
  getFirstName,
  calculateReputationPoints,
  evaluateBadges,
  awardReputation,
  getLeaderboard,
};
