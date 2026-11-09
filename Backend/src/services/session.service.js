const sessionModel = require("../models/session.model");

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_ROTATION_GRACE_MS = 30 * 1000; // 30-second grace window for concurrent requests
const MAX_ACTIVE_SESSIONS = 5;

// Existing sessions predate expiresAt. Derive their expiry from the last
// refresh/update time so deploying this change does not immediately sign out
// users who still have a valid seven-day refresh token.
async function migrateSessionExpirations() {
  await sessionModel.updateMany(
    { expiresAt: { $exists: false } },
    [
      {
        $set: {
          expiresAt: {
            $add: [{ $ifNull: ["$updatedAt", "$createdAt"] }, REFRESH_TOKEN_TTL_MS],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
}

async function enforceActiveSessionLimit({ user, userRef, keepSessionId }) {
  const sessions = await sessionModel
    .find({ user, userRef, revoked: false, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id createdAt")
    .limit(MAX_ACTIVE_SESSIONS + 1)
    .lean();

  if (sessions.length <= MAX_ACTIVE_SESSIONS) return;
  const keepIndex = sessions.findIndex((session) => String(session._id) === String(keepSessionId));
  const orderedSessions = keepIndex > 0
    ? [sessions[keepIndex], ...sessions.slice(0, keepIndex), ...sessions.slice(keepIndex + 1)]
    : sessions;
  const expiredSessionIds = orderedSessions.slice(MAX_ACTIVE_SESSIONS).map((session) => session._id);

  if (expiredSessionIds.length) {
    await sessionModel.updateMany(
      { _id: { $in: expiredSessionIds }, revoked: false },
      { $set: { revoked: true, expiresAt: new Date() } },
    );
  }
}

module.exports = {
  REFRESH_TOKEN_TTL_MS,
  REFRESH_ROTATION_GRACE_MS,
  MAX_ACTIVE_SESSIONS,
  migrateSessionExpirations,
  enforceActiveSessionLimit,
};
