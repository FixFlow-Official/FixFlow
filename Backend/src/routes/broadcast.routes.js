const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const broadcastController = require("../controllers/broadcast.controller");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can perform this action." });
  }
  return next();
}

// Admin broadcast management
router.post("/admin/broadcasts", verifyAccessToken, requireAdmin, broadcastController.createBroadcast);
router.get("/admin/broadcasts", verifyAccessToken, requireAdmin, broadcastController.getAllBroadcasts);
router.patch("/admin/broadcasts/:id", verifyAccessToken, requireAdmin, broadcastController.updateBroadcast);
router.delete("/admin/broadcasts/:id", verifyAccessToken, requireAdmin, broadcastController.deleteBroadcast);

// Public / Authenticated broadcast queries
router.get("/broadcasts/active", verifyAccessToken, broadcastController.getActiveBroadcasts);
router.get("/broadcasts/match", verifyAccessToken, broadcastController.getMatchingBroadcasts);

// In case mounted under /api/broadcasts directly:
router.get("/active", verifyAccessToken, broadcastController.getActiveBroadcasts);
router.get("/match", verifyAccessToken, broadcastController.getMatchingBroadcasts);

module.exports = router;
