const { broadcastModel, broadcastCategories } = require("../models/broadcast.model");

/**
 * Creates a campus outage / maintenance broadcast.
 * @route POST /api/admin/broadcasts
 * @access requireAdmin
 */
async function createBroadcast(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can create campus broadcasts.",
    });
  }

  const { title, message, category, buildings, startsAt, endsAt, isActive } = req.body || {};

  if (!title?.trim()) {
    return res.status(400).json({ message: "Broadcast title is required." });
  }

  if (title.trim().length > 120) {
    return res.status(400).json({ message: "Broadcast title cannot exceed 120 characters." });
  }

  if (!message?.trim()) {
    return res.status(400).json({ message: "Broadcast message is required." });
  }

  if (message.trim().length > 500) {
    return res.status(400).json({ message: "Broadcast message cannot exceed 500 characters." });
  }

  if (!category || !broadcastCategories.includes(category)) {
    return res.status(400).json({
      message: `Invalid category. Must be one of: ${broadcastCategories.join(", ")}.`,
    });
  }

  if (!startsAt || isNaN(new Date(startsAt).getTime())) {
    return res.status(400).json({ message: "A valid start time is required." });
  }

  if (!endsAt || isNaN(new Date(endsAt).getTime())) {
    return res.status(400).json({ message: "A valid end time is required." });
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  if (endDate.getTime() <= startDate.getTime()) {
    return res.status(400).json({ message: "End time must be after start time." });
  }

  const cleanedBuildings = Array.isArray(buildings)
    ? buildings.map((b) => String(b).trim()).filter(Boolean)
    : [];

  const broadcast = await broadcastModel.create({
    title: title.trim(),
    message: message.trim(),
    category,
    buildings: cleanedBuildings,
    startsAt: startDate,
    endsAt: endDate,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    createdBy: req.auth.id,
  });

  return res.status(201).json({
    message: "Broadcast created successfully.",
    broadcast,
  });
}

/**
 * Lists all campus broadcasts including past/expired ones.
 * @route GET /api/admin/broadcasts
 * @access requireAdmin
 */
async function getAllBroadcasts(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can view full broadcast records.",
    });
  }

  const broadcasts = await broadcastModel
    .find()
    .populate("createdBy", "username email designation")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    broadcasts,
  });
}

/**
 * Updates or deactivates a campus broadcast.
 * @route PATCH /api/admin/broadcasts/:id
 * @access requireAdmin
 */
async function updateBroadcast(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can update campus broadcasts.",
    });
  }

  const { id } = req.params;
  const broadcast = await broadcastModel.findById(id);

  if (!broadcast) {
    return res.status(404).json({ message: "Broadcast not found." });
  }

  const { title, message, category, buildings, startsAt, endsAt, isActive } = req.body || {};

  if (title !== undefined) {
    if (!title.trim()) {
      return res.status(400).json({ message: "Broadcast title cannot be empty." });
    }
    if (title.trim().length > 120) {
      return res.status(400).json({ message: "Broadcast title cannot exceed 120 characters." });
    }
    broadcast.title = title.trim();
  }

  if (message !== undefined) {
    if (!message.trim()) {
      return res.status(400).json({ message: "Broadcast message cannot be empty." });
    }
    if (message.trim().length > 500) {
      return res.status(400).json({ message: "Broadcast message cannot exceed 500 characters." });
    }
    broadcast.message = message.trim();
  }

  if (category !== undefined) {
    if (!broadcastCategories.includes(category)) {
      return res.status(400).json({
        message: `Invalid category. Must be one of: ${broadcastCategories.join(", ")}.`,
      });
    }
    broadcast.category = category;
  }

  if (buildings !== undefined) {
    broadcast.buildings = Array.isArray(buildings)
      ? buildings.map((b) => String(b).trim()).filter(Boolean)
      : [];
  }

  let newStart = broadcast.startsAt;
  let newEnd = broadcast.endsAt;

  if (startsAt !== undefined) {
    if (isNaN(new Date(startsAt).getTime())) {
      return res.status(400).json({ message: "Invalid start time format." });
    }
    newStart = new Date(startsAt);
  }

  if (endsAt !== undefined) {
    if (isNaN(new Date(endsAt).getTime())) {
      return res.status(400).json({ message: "Invalid end time format." });
    }
    newEnd = new Date(endsAt);
  }

  if (newEnd.getTime() <= newStart.getTime()) {
    return res.status(400).json({ message: "End time must be after start time." });
  }

  broadcast.startsAt = newStart;
  broadcast.endsAt = newEnd;

  if (isActive !== undefined) {
    broadcast.isActive = Boolean(isActive);
  }

  await broadcast.save();

  return res.status(200).json({
    message: "Broadcast updated successfully.",
    broadcast,
  });
}

/**
 * Deletes a campus broadcast.
 * @route DELETE /api/admin/broadcasts/:id
 * @access requireAdmin
 */
async function deleteBroadcast(req, res) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can delete campus broadcasts.",
    });
  }

  const { id } = req.params;
  const broadcast = await broadcastModel.findByIdAndDelete(id);

  if (!broadcast) {
    return res.status(404).json({ message: "Broadcast not found." });
  }

  return res.status(200).json({
    message: "Broadcast deleted successfully.",
  });
}

/**
 * Returns currently active broadcasts (isActive=true and startsAt <= now <= endsAt).
 * @route GET /api/broadcasts/active
 * @access verifyAccessToken (any role)
 */
async function getActiveBroadcasts(req, res) {
  const now = new Date();

  const broadcasts = await broadcastModel
    .find({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    })
    .sort({ startsAt: 1 })
    .lean();

  return res.status(200).json({
    broadcasts,
  });
}

/**
 * Returns active broadcasts matching category and building (or whole campus).
 * @route GET /api/broadcasts/match?category=Internet&building=Central%20Library
 * @access verifyAccessToken (any role)
 */
async function getMatchingBroadcasts(req, res) {
  const { category, building } = req.query || {};

  if (!category?.trim() && !building?.trim()) {
    return res.status(200).json({
      matched: false,
      match: null,
      broadcasts: [],
    });
  }

  const now = new Date();
  const query = {
    isActive: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  };

  if (category?.trim()) {
    query.category = category.trim();
  }

  if (building?.trim()) {
    const buildingRegex = new RegExp(
      `^${building.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i",
    );
    query.$or = [
      { buildings: { $size: 0 } },
      { buildings: { $exists: false } },
      { buildings: buildingRegex },
    ];
  }

  const matches = await broadcastModel.find(query).sort({ startsAt: 1 }).lean();

  if (matches.length > 0) {
    const topMatch = matches[0];
    return res.status(200).json({
      matched: true,
      match: {
        _id: topMatch._id,
        title: topMatch.title,
        message: topMatch.message,
        category: topMatch.category,
        buildings: topMatch.buildings,
        startsAt: topMatch.startsAt,
        endsAt: topMatch.endsAt,
      },
      broadcasts: matches,
    });
  }

  return res.status(200).json({
    matched: false,
    match: null,
    broadcasts: [],
  });
}

module.exports = {
  createBroadcast,
  getAllBroadcasts,
  updateBroadcast,
  deleteBroadcast,
  getActiveBroadcasts,
  getMatchingBroadcasts,
};
