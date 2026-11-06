const config = require("../config/config");

// Canonical facility concepts and synonym dictionaries
const CONCEPT_SYNONYMS = {
  wifi: [
    "wifi",
    "wi-fi",
    "internet",
    "net",
    "network",
    "router",
    "hotspot",
    "connection",
    "lan",
    "ethernet",
    "broadband",
    "signal",
    "connectivity",
  ],
  water: [
    "water",
    "tap",
    "pipe",
    "pipeline",
    "leak",
    "leaking",
    "leakage",
    "flush",
    "toilet",
    "washroom",
    "drain",
    "drainage",
    "sewage",
    "basin",
    "sink",
    "tank",
    "plumbing",
    "faucet",
    "overflow",
  ],
  power: [
    "electricity",
    "power",
    "current",
    "light",
    "lighting",
    "bulb",
    "tube",
    "tubelight",
    "fan",
    "switch",
    "socket",
    "wire",
    "wiring",
    "spark",
    "sparking",
    "shock",
    "blackout",
    "circuit",
    "breaker",
    "short",
    "plug",
    "generator",
  ],
  ac: [
    "ac",
    "air conditioner",
    "air conditioning",
    "cooling",
    "cool",
    "heater",
    "heating",
    "hvac",
    "temperature",
    "chiller",
    "remote",
  ],
  furniture: [
    "chair",
    "desk",
    "table",
    "bench",
    "podium",
    "door",
    "window",
    "handle",
    "blackboard",
    "whiteboard",
    "board",
    "glass",
    "lock",
    "hinge",
    "furniture",
  ],
  cleaning: [
    "clean",
    "cleaning",
    "dirty",
    "garbage",
    "trash",
    "dustbin",
    "waste",
    "litter",
    "smell",
    "stink",
    "foul",
    "odor",
    "pest",
    "rodent",
    "spider",
    "mess",
    "hygiene",
    "dust",
  ],
  av: [
    "projector",
    "screen",
    "display",
    "hdmi",
    "vga",
    "speaker",
    "sound",
    "audio",
    "mic",
    "microphone",
    "podium mic",
  ],
};

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "is",
  "are",
  "was",
  "were",
  "it",
  "its",
  "my",
  "our",
  "there",
  "this",
  "that",
  "from",
  "please",
  "kindly",
  "check",
  "solve",
  "help",
]);

/**
 * Normalizes room/facility identifiers:
 * "Room number e28" -> "e28"
 * "Room E28" -> "e28"
 * "E-28" -> "e28"
 * "Physics Lab 204" -> "physics204"
 */
function normalizeRoom(roomStr) {
  if (!roomStr || typeof roomStr !== "string") return "";
  return roomStr
    .toLowerCase()
    .replace(/\b(room\s*no\.?|room\s*number|room|rm\.?|lab|no\.?|number|#)\b/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

/**
 * Normalizes building string for comparison.
 */
function normalizeBuilding(buildingStr) {
  if (!buildingStr || typeof buildingStr !== "string") return "";
  return buildingStr.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
}

/**
 * Extracts normalized tokens and identifies primary facility concepts.
 */
function extractConcepts(text) {
  if (!text || typeof text !== "string") return { tokens: new Set(), concepts: new Set() };

  const rawTokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

  const tokens = new Set(rawTokens);
  const concepts = new Set();

  for (const [conceptKey, synonyms] of Object.entries(CONCEPT_SYNONYMS)) {
    for (const syn of synonyms) {
      if (text.toLowerCase().includes(syn)) {
        concepts.add(conceptKey);
        break;
      }
    }
  }

  return { tokens, concepts };
}

/**
 * Computes Jaccard token overlap between two token sets.
 */
function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount += 1;
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Calculates heuristic duplicate score between new draft and candidate complaint.
 * Returns a score between 0 and 1.
 */
function calculateDuplicateScore(draft, candidate) {
  const draftBuilding = normalizeBuilding(draft.building);
  const candBuilding = normalizeBuilding(candidate.location?.building);

  // Different buildings cannot be facility duplicates
  if (draftBuilding && candBuilding && draftBuilding !== candBuilding) {
    return { score: 0, isDuplicate: false, reason: "Different building" };
  }

  const draftCategory = draft.category?.trim();
  const candCategory = candidate.category?.trim();
  const categoryMatch = draftCategory && candCategory && draftCategory.toLowerCase() === candCategory.toLowerCase();

  const draftRoom = normalizeRoom(draft.room);
  const candRoom = normalizeRoom(candidate.location?.room);
  const roomMatch = Boolean(draftRoom && candRoom && draftRoom === candRoom);

  const draftText = `${draft.title || ""} ${draft.description || ""}`.trim();
  const candText = `${candidate.complaintTitle || candidate.title || ""} ${candidate.complaintDescription || candidate.description || ""}`.trim();

  const draftAnalysis = extractConcepts(draftText);
  const candAnalysis = extractConcepts(candText);

  // Check concept overlap (e.g. both describe wifi or water or power)
  let sharedConcepts = 0;
  for (const c of draftAnalysis.concepts) {
    if (candAnalysis.concepts.has(c)) sharedConcepts += 1;
  }

  const tokenSim = jaccardSimilarity(draftAnalysis.tokens, candAnalysis.tokens);

  // Base score computation
  let score = 0;
  const reasons = [];

  // Exact room match in same building
  if (roomMatch) {
    score += 0.35;
    reasons.push(`Same room (${draftRoom})`);
  } else if (!draftRoom || !candRoom) {
    // One or both did not specify room; if category is facility-wide (Internet / Power / Water), give partial room credit
    if (["Internet", "Electrical", "Plumbing"].includes(draftCategory)) {
      score += 0.20;
      reasons.push("Building-wide infrastructure facility");
    }
  }

  // Category match
  if (categoryMatch) {
    score += 0.25;
    reasons.push(`Matching category (${draftCategory})`);
  }

  // Concept match (e.g. both refer to wifi, or water, or power)
  if (sharedConcepts > 0) {
    score += 0.35;
    reasons.push("Identical issue concept");
  }

  // Token / keyword similarity
  if (tokenSim > 0.4) {
    score += 0.25;
  } else if (tokenSim > 0.2) {
    score += 0.15;
  }

  // Clamp score between 0 and 1
  const finalScore = Math.min(1.0, Math.round(score * 100) / 100);
  const isDuplicate = finalScore >= 0.65;

  return {
    score: finalScore,
    isDuplicate,
    reason: reasons.join(", ") || "General facility similarity",
  };
}

/**
 * Optional Gemini AI verification when API key is available and score is borderline.
 */
async function verifyWithGemini(draft, candidate, { fetchImpl = fetch, apiKey = config.GEMINI_API_KEY, model = config.GEMINI_MODEL } = {}) {
  if (!apiKey?.trim()) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const prompt = [
      "You are an AI assistant for a campus facilities complaint portal.",
      "Determine whether the NEW draft complaint describes the SAME physical incident or broken equipment as the EXISTING active complaint.",
      "Consider synonyms (e.g., 'Problem In wifi', 'Wifi Problem', 'My Wi-Fi is not working' are the exact same issue).",
      "Return ONLY JSON with keys: isDuplicate (boolean), confidence (0.0 to 1.0), reason (short string).",
      "",
      `NEW DRAFT: Title: "${draft.title}", Category: "${draft.category}", Location: "${draft.building} ${draft.floor || ""} ${draft.room || ""}", Description: "${draft.description}"`,
      `EXISTING COMPLAINT: Title: "${candidate.complaintTitle || candidate.title}", Category: "${candidate.category}", Location: "${candidate.location?.building} ${candidate.location?.floor || ""} ${candidate.location?.room || ""}", Description: "${candidate.complaintDescription || candidate.description}"`,
    ].join("\n");

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 150, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Assesses a new complaint against a list of active complaints in the same location.
 * Returns { isDuplicate: boolean, topDuplicate: object | null, duplicates: array }.
 */
async function findDuplicates(draft, activeComplaints = [], options = {}) {
  if (!draft || !activeComplaints.length) {
    return { isDuplicate: false, topDuplicate: null, duplicates: [] };
  }

  const evaluated = [];

  for (const cand of activeComplaints) {
    const heuristic = calculateDuplicateScore(draft, cand);

    let finalIsDuplicate = heuristic.isDuplicate;
    let finalScore = heuristic.score;
    let finalReason = heuristic.reason;

    // If score is borderline (between 0.50 and 0.85) and Gemini is available, verify with AI
    if (heuristic.score >= 0.50 && heuristic.score < 0.85 && options.useAi !== false) {
      const aiResult = await verifyWithGemini(draft, cand, options);
      if (aiResult && typeof aiResult.isDuplicate === "boolean") {
        finalIsDuplicate = aiResult.isDuplicate;
        finalScore = Math.max(finalScore, aiResult.confidence || finalScore);
        if (aiResult.reason) finalReason = aiResult.reason;
      }
    }

    if (finalIsDuplicate) {
      evaluated.push({
        complaint: cand,
        score: finalScore,
        reason: finalReason,
      });
    }
  }

  evaluated.sort((a, b) => b.score - a.score);

  if (evaluated.length > 0) {
    const top = evaluated[0];
    return {
      isDuplicate: true,
      topDuplicate: top.complaint,
      topScore: top.score,
      topReason: top.reason,
      duplicates: evaluated.map((e) => ({
        ...e.complaint,
        duplicateScore: e.score,
        duplicateReason: e.reason,
      })),
    };
  }

  return { isDuplicate: false, topDuplicate: null, duplicates: [] };
}

module.exports = {
  CONCEPT_SYNONYMS,
  normalizeRoom,
  normalizeBuilding,
  extractConcepts,
  calculateDuplicateScore,
  verifyWithGemini,
  findDuplicates,
};
