const campusBlockModel = require("../models/campusBlock.model");
const complaintModel = require("../models/complaint.model");
const karnalPreset = require("../config/karnalCampusPreset");

const activeComplaintStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
];

// Helper to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    .sort({ "position.y": 1, "position.x": 1 })
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
    position = { x: 10, y: 10, width: 25, height: 25 },
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
    position: {
      x: Number(position?.x ?? 10),
      y: Number(position?.y ?? 10),
      width: Number(position?.width ?? 25),
      height: Number(position?.height ?? 25),
    },
    floors: formattedFloors,
    departments: Array.isArray(departments) ? departments : [],
  });

  return res.status(201).json({
    message: "Building added to campus layout successfully.",
    block,
  });
}

// PUT /api/campus/blocks/:id - Admin updates building layout, floors, or rooms
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
    position,
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

  if (position) {
    block.position = {
      x: Number(position.x ?? block.position.x),
      y: Number(position.y ?? block.position.y),
      width: Number(position.width ?? block.position.width),
      height: Number(position.height ?? block.position.height),
    };
  }

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
    message: "Building layout updated successfully.",
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

// GET /api/campus/heatmap - Real-time spatial complaint density and systemic hotspot detection
async function getCampusHeatmap(req, res) {
  await ensureDefaultKarnalPreset();

  const [blocks, activeComplaints] = await Promise.all([
    campusBlockModel.find({ isActive: true }).lean(),
    complaintModel
      .find({ status: { $in: activeComplaintStatuses } })
      .select("complaintTitle category location aiTriage status createdAt")
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

    // Initialize registered floors for consistent structure
    (block.floors || []).forEach((floor) => {
      floorBreakdown[floor.name] = {
        name: floor.name,
        rooms: floor.rooms || [],
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
          rooms: [],
          count: 0,
          categories: {},
        };
      }
      floorBreakdown[floorName].count += 1;
      floorBreakdown[floorName].categories[cat] =
        (floorBreakdown[floorName].categories[cat] || 0) + 1;
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

    return {
      ...block,
      totalActive,
      criticalCount,
      categoryCounts,
      floorBreakdown: Object.values(floorBreakdown),
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
