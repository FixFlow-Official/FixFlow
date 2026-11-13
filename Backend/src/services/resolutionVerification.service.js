const config = require("../config/config");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB cap
const FETCH_TIMEOUT_MS = 10_000; // 10s timeout
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Pure decision rule for AI visual resolution verification.
 * - VERIFIED: same asset AND visible evidence of fix AND confidence >= 70
 * - MISMATCH: different asset OR confidence < 40
 * - INCONCLUSIVE: everything else (e.g. uncertain angle, ambiguous fix, confidence 40-69)
 */
function decideVerdict({ sameAsset, visibleFixEvidence, confidenceScore }) {
  const score = Math.max(0, Math.min(100, Number(confidenceScore) || 0));

  if (!sameAsset || score < 40) {
    return "MISMATCH";
  }

  if (sameAsset && visibleFixEvidence && score >= 70) {
    return "VERIFIED";
  }

  return "INCONCLUSIVE";
}

/**
 * Safely fetches an image from URL and returns base64 and mimeType.
 */
async function fetchImageBuffer(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const rawMime = response.headers.get("content-type") || "";
    const mimeType = rawMime.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    return {
      mimeType,
      base64: Buffer.from(arrayBuffer).toString("base64"),
      byteLength: arrayBuffer.byteLength,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Verifies that a staff resolution photo matches the original complaint photo.
 *
 * @param {Object} params
 * @param {string} params.beforeImageUrl - The original complaint photo URL.
 * @param {string} params.afterImageUrl - The newly uploaded resolution proof URL.
 * @param {string} [params.title] - Complaint title for context.
 * @param {string} [params.description] - Complaint description for context.
 * @param {string} [params.category] - Complaint category.
 * @param {string} [params.apiKey] - Optional override for Gemini API Key.
 * @param {string} [params.model] - Optional override for Gemini model.
 * @param {Function} [params.fetchImpl] - Optional fetch implementation for testing.
 * @returns {Promise<{
 *   verdict: "VERIFIED" | "INCONCLUSIVE" | "MISMATCH",
 *   confidenceScore: number,
 *   reasons: string[],
 *   observedAsset: string,
 *   observedIssueFixed: string,
 *   provider: "gemini" | "rules" | "none",
 *   checkedAt: Date,
 *   checkedBy: string
 * }>}
 */
async function verifyResolution({
  beforeImageUrl,
  afterImageUrl,
  title = "Campus equipment",
  description = "",
  category = "Other",
  apiKey = config.GEMINI_API_KEY,
  model = config.GEMINI_MODEL || "gemini-3.5-flash-lite",
  fetchImpl = fetch,
} = {}) {
  const [beforeImage, afterImage] = await Promise.all([
    fetchImageBuffer(beforeImageUrl, { fetchImpl }),
    fetchImageBuffer(afterImageUrl, { fetchImpl }),
  ]);

  if (!beforeImage || !afterImage) {
    return {
      verdict: "INCONCLUSIVE",
      confidenceScore: 0,
      provider: "none",
      reasons: ["Could not load one of the photos for verification."],
      observedAsset: String(title).slice(0, 120),
      observedIssueFixed: "",
      checkedAt: new Date(),
      checkedBy: "AI Visual Auditor",
    };
  }

  if (!apiKey?.trim()) {
    console.warn("[Resolution Verification] GEMINI_API_KEY not configured. Falling back to INCONCLUSIVE.");
    return {
      verdict: "INCONCLUSIVE",
      confidenceScore: 50,
      provider: "rules",
      reasons: ["AI service not configured; manual inspection required."],
      observedAsset: String(title).slice(0, 120),
      observedIssueFixed: "",
      checkedAt: new Date(),
      checkedBy: "AI Visual Auditor",
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const prompt = [
    "You are an expert campus facility quality inspector auditing a maintenance repair.",
    "You are provided with two images:",
    "Image 1: The BEFORE photo submitted by the student showing the damaged or malfunctioning asset.",
    "Image 2: The AFTER photo submitted by the technician claiming the issue is resolved.",
    `Complaint context: Category: ${category} | Title: "${title}" | Description: "${description.slice(0, 300)}"`,
    "",
    "Inspect both images carefully to evaluate:",
    "1. Is Image 2 showing the SAME physical fixture, asset, room, or equipment as Image 1? (sameAsset: true/false)",
    "2. Does Image 2 show visible evidence that the reported defect or damage has been repaired/rectified? (visibleFixEvidence: true/false)",
    "3. How confident are you in this visual audit? (confidenceScore: 0-100 integer)",
    "4. Up to 3 concise reasons explaining your evaluation (max 180 chars each).",
    "5. Brief description of the observed asset (max 120 chars).",
    "6. Brief description of the observed fix or lack thereof (max 180 chars).",
    "",
    "Return ONLY valid JSON with this exact schema:",
    "{",
    '  "sameAsset": boolean,',
    '  "visibleFixEvidence": boolean,',
    '  "confidenceScore": number,',
    '  "reasons": string[],',
    '  "observedAsset": string,',
    '  "observedIssueFixed": string',
    "}",
  ].join("\n");

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: beforeImage.mimeType,
                  data: beforeImage.base64,
                },
              },
              {
                inlineData: {
                  mimeType: afterImage.mimeType,
                  data: afterImage.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.warn(`[Resolution Verification] Gemini API returned status ${response.status}`);
      return {
        verdict: "INCONCLUSIVE",
        confidenceScore: 50,
        provider: "rules",
        reasons: ["AI visual inspection temporarily unavailable."],
        observedAsset: String(title).slice(0, 120),
        observedIssueFixed: "",
        checkedAt: new Date(),
        checkedBy: "AI Visual Auditor",
      };
    }

    const payload = await response.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
    if (!rawText) {
      return {
        verdict: "INCONCLUSIVE",
        confidenceScore: 50,
        provider: "rules",
        reasons: ["AI provided no response text."],
        observedAsset: String(title).slice(0, 120),
        observedIssueFixed: "",
        checkedAt: new Date(),
        checkedBy: "AI Visual Auditor",
      };
    }

    const cleanedText = rawText.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleanedText);

    const sameAsset = Boolean(parsed.sameAsset);
    const visibleFixEvidence = Boolean(parsed.visibleFixEvidence);
    const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(parsed.confidenceScore) || 0)));
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r) => typeof r === "string" && r.trim()).slice(0, 3).map((r) => r.trim().slice(0, 180))
      : [];
    const observedAsset = typeof parsed.observedAsset === "string" ? parsed.observedAsset.trim().slice(0, 120) : "";
    const observedIssueFixed = typeof parsed.observedIssueFixed === "string" ? parsed.observedIssueFixed.trim().slice(0, 180) : "";

    const verdict = decideVerdict({
      sameAsset,
      visibleFixEvidence,
      confidenceScore,
    });

    return {
      verdict,
      confidenceScore,
      reasons: reasons.length > 0 ? reasons : [verdict === "VERIFIED" ? "Visual evidence confirms the repair of the same asset." : verdict === "MISMATCH" ? "Resolution photo does not show the reported asset or fix." : "Verification was inconclusive."],
      observedAsset: observedAsset || String(title).slice(0, 120),
      observedIssueFixed,
      provider: "gemini",
      checkedAt: new Date(),
      checkedBy: "AI Visual Auditor",
    };
  } catch (err) {
    console.error("[Resolution Verification Error]", err);
    return {
      verdict: "INCONCLUSIVE",
      confidenceScore: 50,
      provider: "rules",
      reasons: ["AI visual verification encountered an unexpected error."],
      observedAsset: String(title).slice(0, 120),
      observedIssueFixed: "",
      checkedAt: new Date(),
      checkedBy: "AI Visual Auditor",
    };
  }
}

module.exports = {
  decideVerdict,
  verifyResolution,
};
