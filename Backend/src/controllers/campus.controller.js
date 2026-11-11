const campusBlockModel = require("../models/campusBlock.model");
const complaintModel = require("../models/complaint.model");
const karnalPreset = require("../config/karnalCampusPreset");

const activeComplaintStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
  "Reopened",
];

// Ensure default Pt. CLS Govt College Karnal preset exists if database is empty
async function ensureDefaultKarnalPreset() {
  const count = await campusBlockModel.countDocuments();
  if (count === 0) {
    await campusBlockModel.insertMany(karnalPreset);
  }
}

// GET /api/campus/blocks - retrieve all active campus blocks
async function getCampusBlocks(req, res) {
  await ensureDefaultKarnalPreset();
  const blocks = await campusBlockModel
    .find({ isActive: true })
    .sort({ name: 1 })
    .lean();

  return res.status(200).json({ blocks });
}

// POST /api/campus/blocks - Admin creates a new building/block
async function createCampusBlock(req, res) {
  const {
    name,
    shortName = "",
    code = "",
    category = "Academic",
    accentColor = "emerald",
    floors = [],
    departments = [],
  } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Building name is required." });
  }

  // Format floors safely
  const formattedFloors = Array.isArray(floors)
    ? floors.map((f) => ({
        name: typeof f === "string" ? f : f?.name || "Ground Floor",
        rooms: Array.isArray(f?.rooms) ? f.rooms.map((r) => String(r).trim()).filter(Boolean) : [],
      }))
    : [{ name: "Ground Floor", rooms: [] }];

  const block = await campusBlockModel.create({
    name: name.trim(),
    shortName: shortName.trim(),
    code: code.trim().toUpperCase(),
    category,
    accentColor,
    floors: formattedFloors,
    departments: Array.isArray(departments) ? departments : [],
  });

  return res.status(201).json({
    message: "Building added to campus successfully.",
    block,
  });
}

// PUT /api/campus/blocks/:id - Admin updates building, floors, or rooms
async function updateCampusBlock(req, res) {
  const { id } = req.params;
  const block = await campusBlockModel.findById(id);

  if (!block) {
    return res.status(404).json({ message: "Building not found." });
  }

  const {
    name,
    shortName,
    code,
    category,
    accentColor,
    floors,
    departments,
    isActive,
  } = req.body;

  if (name !== undefined) block.name = name.trim();
  if (shortName !== undefined) block.shortName = shortName.trim();
  if (code !== undefined) block.code = code.trim().toUpperCase();
  if (category !== undefined) block.category = category;
  if (accentColor !== undefined) block.accentColor = accentColor;
  if (isActive !== undefined) block.isActive = Boolean(isActive);

  if (Array.isArray(floors)) {
    block.floors = floors.map((f) => ({
      name: typeof f === "string" ? f : f?.name || "Ground Floor",
      rooms: Array.isArray(f?.rooms) ? f.rooms.map((r) => String(r).trim()).filter(Boolean) : [],
    }));
  }

  if (Array.isArray(departments)) {
    block.departments = departments;
  }

  await block.save();

  return res.status(200).json({
    message: "Building updated successfully.",
    block,
  });
}

// DELETE /api/campus/blocks/:id - Admin deletes a building
async function deleteCampusBlock(req, res) {
  const { id } = req.params;
  const deleted = await campusBlockModel.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json({ message: "Building not found." });
  }

  return res.status(200).json({ message: "Building removed from campus layout." });
}

// POST /api/campus/preset-karnal - Reset / re-seed Pt. CLS Govt College Karnal layout
async function initKarnalPreset(req, res) {
  await campusBlockModel.deleteMany({});
  const created = await campusBlockModel.insertMany(karnalPreset);

  return res.status(200).json({
    message: "Initialized Pt. Chiranjilal Sharma Govt. College, Karnal campus layout.",
    count: created.length,
    blocks: created,
  });
}

// GET /api/campus/heatmap - Real-time building cards with floor and room-level complaints
async function getCampusHeatmap(req, res) {
  await ensureDefaultKarnalPreset();

  const [blocks, activeComplaints] = await Promise.all([
    campusBlockModel.find({ isActive: true }).lean(),
    complaintModel
      .find({ status: { $in: activeComplaintStatuses } })
      .select("_id complaintTitle category location aiTriage status createdAt")
      .lean(),
  ]);

  let totalSystemicIncidents = 0;

  // Enrich each block with live complaints matched to its name or code
  const enrichedBlocks = blocks.map((block) => {
    const blockNames = [
      block.name.toLowerCase(),
      (block.shortName || "").toLowerCase(),
      (block.code || "").toLowerCase(),
    ].filter(Boolean);

    // Match active complaints belonging to this building
    const matched = activeComplaints.filter((c) => {
      const building = (c.location?.building || "").toLowerCase();
      if (!building) return false;
      return blockNames.some(
        (alias) => building === alias || building.includes(alias) || alias.includes(building),
      );
    });

    const totalActive = matched.length;
    let criticalCount = 0;
    const categoryCounts = {};
    const floorBreakdown = {};

    // Initialize registered floors and their pre-configured room maps
    (block.floors || []).forEach((floor) => {
      const roomMap = {};
      (floor.rooms || []).forEach((r) => {
        roomMap[r] = {
          roomNumber: r,
          complaints: [],
        };
      });

      floorBreakdown[floor.name] = {
        name: floor.name,
        roomMap,
        count: 0,
        categories: {},
      };
    });

    matched.forEach((c) => {
      if (
        c.aiTriage?.urgency === "Critical" ||
        c.aiTriage?.urgency === "High" ||
        c.aiTriage?.priority === "P1"
      ) {
        criticalCount += 1;
      }

      const cat = c.category || "Other";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const floorName = c.location?.floor || "Ground Floor";
      if (!floorBreakdown[floorName]) {
        floorBreakdown[floorName] = {
          name: floorName,
          roomMap: {},
          count: 0,
          categories: {},
        };
      }
      floorBreakdown[floorName].count += 1;
      floorBreakdown[floorName].categories[cat] =
        (floorBreakdown[floorName].categories[cat] || 0) + 1;

      // Attach complaint to the specific room
      const rawRoom = (c.location?.room || "").trim();
      const roomKey = rawRoom || "General / Corridor";

      if (!floorBreakdown[floorName].roomMap[roomKey]) {
        floorBreakdown[floorName].roomMap[roomKey] = {
          roomNumber: roomKey,
          complaints: [],
        };
      }

      floorBreakdown[floorName].roomMap[roomKey].complaints.push({
        _id: c._id,
        title: c.complaintTitle,
        category: c.category,
        status: c.status,
        urgency: c.aiTriage?.urgency || "Normal",
        createdAt: c.createdAt,
      });
    });

    // Detect systemic anomaly: if >= 3 complaints in the same category on a floor or whole building
    let systemicHotspot = null;
    for (const [floorName, floorData] of Object.entries(floorBreakdown)) {
      for (const [cat, count] of Object.entries(floorData.categories)) {
        if (count >= 3) {
          systemicHotspot = {
            category: cat,
            floor: floorName,
            count,
            message: `Systemic ${cat} failure: ${count} active reports on ${floorName}`,
          };
          totalSystemicIncidents += 1;
          break;
        }
      }
      if (systemicHotspot) break;
    }

    if (!systemicHotspot) {
      for (const [cat, count] of Object.entries(categoryCounts)) {
        if (count >= 4) {
          systemicHotspot = {
            category: cat,
            floor: "Multiple Floors",
            count,
            message: `Building-wide ${cat} disruption (${count} active reports)`,
          };
          totalSystemicIncidents += 1;
          break;
        }
      }
    }

    // Determine heat level
    const heatLevel =
      systemicHotspot || totalActive >= 6 || criticalCount >= 2
        ? "danger"
        : totalActive >= 3
          ? "warning"
          : "normal";

    const formattedFloorBreakdown = Object.values(floorBreakdown).map((f) => ({
      name: f.name,
      count: f.count,
      categories: f.categories,
      rooms: Object.values(f.roomMap).map((r) => ({
        roomNumber: r.roomNumber,
        complaintsCount: r.complaints.length,
        complaints: r.complaints,
      })),
    }));

    return {
      ...block,
      totalActive,
      criticalCount,
      categoryCounts,
      floorBreakdown: formattedFloorBreakdown,
      systemicHotspot,
      heatLevel,
    };
  });

  return res.status(200).json({
    collegeName: "Pt. Chiranjilal Sharma Govt. College",
    campusLocation: "Sector 14, Karnal, Haryana",
    totalActiveComplaints: activeComplaints.length,
    systemicIncidentsCount: totalSystemicIncidents,
    blocks: enrichedBlocks,
  });
}

module.exports = {
  getCampusBlocks,
  createCampusBlock,
  updateCampusBlock,
  deleteCampusBlock,
  initKarnalPreset,
  getCampusHeatmap,
  ensureDefaultKarnalPreset,
};
