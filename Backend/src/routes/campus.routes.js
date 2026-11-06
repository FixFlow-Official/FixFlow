const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const campusController = require("../controllers/campus.controller");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can modify campus layouts." });
  }
  return next();
}

// Public / Authenticated read for complaint creation dropdowns
router.get("/blocks", campusController.getCampusBlocks);

// Authenticated Heatmap & Spatial GIS overview
router.get("/heatmap", verifyAccessToken, campusController.getCampusHeatmap);

// Admin-only Layout Management
router.post("/blocks", verifyAccessToken, requireAdmin, campusController.createCampusBlock);
router.put("/blocks/:id", verifyAccessToken, requireAdmin, campusController.updateCampusBlock);
router.delete("/blocks/:id", verifyAccessToken, requireAdmin, campusController.deleteCampusBlock);
router.post("/preset-karnal", verifyAccessToken, requireAdmin, campusController.initKarnalPreset);

module.exports = router;
