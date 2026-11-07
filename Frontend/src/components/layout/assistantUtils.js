export const navigationAliases = {
  complaints: [
    "complaint",
    "complaints",
    "all complaints",
    "complaint list",
    "issues",
    "tickets",
    "view complaints",
    "complaints page",
    "ticket page",
  ],
  campusMap: [
    "campus map",
    "campus map & gis",
    "campus map gis",
    "map",
    "gis",
    "facility map",
    "live map",
    "buildings",
    "campus layout",
    "campus facilities",
    "live campus map",
    "campus map page",
    "show campus map",
    "view campus map",
    "open map",
    "see campus map",
    "college map",
  ],
  users: [
    "user access",
    "users",
    "directory",
    "user management",
    "manage users",
    "staff accounts",
    "user access page",
  ],
  accounts: [
    "accounts",
    "registered accounts",
    "all accounts",
    "user accounts",
    "accounts page",
  ],
  sla: [
    "sla",
    "sla tracking",
    "escalations",
    "service level",
    "resolution times",
    "sla policy",
    "sla page",
    "sla tracking page",
  ],
  reports: [
    "reports",
    "analytics",
    "statistics",
    "report overview",
    "insights",
    "reports page",
  ],
  profile: [
    "profile",
    "my profile",
    "profile settings",
    "account settings",
    "my account",
    "profile page",
    "my profile page",
    "user profile",
    "take me to profile",
    "take me to my profile",
    "go to profile",
    "go to my profile",
  ],
  newComplaint: [
    "new complaint",
    "submit complaint",
    "submit a complaint",
    "create complaint",
    "create a complaint",
    "report issue",
    "report an issue",
    "report problem",
    "report a problem",
    "file complaint",
    "file a complaint",
    "raise complaint",
    "raise a complaint",
    "new issue",
    "lodge complaint",
    "lodge a complaint",
    "make a complaint",
    "complain",
  ],
  myComplaints: [
    "my complaints",
    "complaint history",
    "track complaints",
    "track complaint",
    "track a complaint",
    "track my complaints",
    "check complaints",
    "view my complaints",
    "see my complaints",
    "my issues",
    "my tickets",
    "my complaints page",
  ],
  activeComplaints: [
    "active complaints",
    "open complaints",
    "pending complaints",
    "in progress complaints",
    "assigned complaints",
  ],
  resolvedComplaints: [
    "resolved complaints",
    "completed complaints",
    "closed complaints",
    "resolution history",
  ],
  assignedStatus: [
    "assigned complaints",
    "assigned status",
    "assigned issues",
    "show assigned",
  ],
  inProgressStatus: [
    "in progress complaints",
    "in progress issues",
    "in progress status",
    "show in progress",
  ],
  underReviewStatus: [
    "under review complaints",
    "under review issues",
    "under review status",
    "show under review",
  ],
  onHoldStatus: [
    "on hold complaints",
    "on hold issues",
    "on hold status",
    "show on hold",
  ],
};

export function getUserDisplayName(user) {
  if (!user || typeof user !== "object") return "";
  const name = typeof user.username === "string" ? user.username.trim() : "";
  if (!name) return "";
  const parts = name.split(/\s+/);
  return parts[0] || name;
}

export function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isQuestion(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Question / informational inquiry starters that must not trigger navigation
  if (
    /^(?:what|how|why|who|when|where|which|is\s+there|are\s+there|tell\s+me|explain|help\s+me|show\s+me\s+how|show\s+me\s+what|can\s+you\s+check|do\s+i\s+have)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Polite action requests phrased with question words (e.g., "can you open campus map?")
  if (
    /^(?:please\s+)?(?:can\s+you|could\s+you|would\s+you)?\s*(?:please\s+)?(?:open|go\s+to|navigate\s+to|switch\s+to|take\s+me\s+to|bring\s+up|show\s+me|display|view)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  // If query ends in '?' and wasn't a polite request, treat as question
  if (trimmed.endsWith("?")) {
    return true;
  }

  return false;
}

export function splitIntoSentences(text) {
  if (!text || typeof text !== "string") return [];
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Protect common abbreviations and numeric patterns from sentence splitting
  const protectedText = cleaned
    .replace(/\b(no|dr|mr|ms|mrs|prof|sr|jr|vs|etc|i\.e|e\.g|approx|dept)\./gi, (m) => m.slice(0, -1) + "\u2024")
    .replace(/(\d+)\.(\d+)/g, "$1\u2024$2");

  const rawParts = protectedText.split(/(?<=[.!?])\s+|\n+/);
  const result = [];
  for (const part of rawParts) {
    const restored = part.replace(/\u2024/g, ".").trim();
    if (restored) result.push(restored);
  }
  return result.length > 0 ? result : [cleaned];
}

export function stripRepetitiveGreeting(text, name) {
  if (!text || typeof text !== "string") return "";
  let res = text.trim();

  const names = [];
  if (name && typeof name === "string") {
    const trimmed = name.trim();
    if (trimmed) {
      names.push(trimmed);
      const first = trimmed.split(/\s+/)[0];
      if (first && first !== trimmed) names.push(first);
    }
  }

  const namePattern =
    names.length > 0
      ? `(?:\\s+(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))?`
      : "(?:\\s+there)?";

  const greetingRegex = new RegExp(
    `^(?:hello|hi|hey|good\\s+morning|good\\s+afternoon|good\\s+evening|greetings|welcome\\s+back)${namePattern}\\s*[,!.]*\\s*`,
    "i",
  );

  res = res.replace(greetingRegex, "").trim();
  res = res.replace(/^[,!.\s]+/, "").trim();

  return res || text.trim();
}

export function extractNavigationFromReply(text, navItems) {
  if (!text || !Array.isArray(navItems)) return null;
  const value = normalize(text);

  const match = value.match(
    /\b(?:navigating|navigate|opening|open|taking\s+you\s+to|i\s+will\s+take\s+you\s+to|switching\s+to|heading\s+to|redirecting\s+you\s+to|showing\s+you|here\s+is|i\s+have\s+opened|let\s+me\s+open)\s+(?:you\s+to\s+)?(?:the\s+|your\s+)?(.+?)(?:\s+right\s+away|\s+now|\s+for\s+you|\s+page|\.|$)/i,
  );
  if (!match) return null;

  const candidate = normalize(match[1]);
  if (!candidate) return null;

  for (const item of navItems) {
    if (!item || item.disabled) continue;
    const aliases = [
      item.id,
      item.label,
      ...(navigationAliases[item.id] || []),
    ].map(normalize);
    if (
      aliases.some(
        (a) =>
          a && (candidate === a || candidate.includes(a) || a.includes(candidate)),
      )
    ) {
      return item;
    }
  }
  return null;
}

export function findNavigationTarget(text, navItems) {
  if (!text || !Array.isArray(navItems) || isQuestion(text)) return null;
  const value = normalize(text);

  let target = value.match(
    /\b(?:open|go\s+to|navigate\s+to|switch\s+to|take\s+me\s+to|bring\s+up|show\s+me|display|view)\s+(?:the\s+)?(.+)$/i,
  )?.[1];

  if (!target) {
    target = value.match(
      /\b(?:show|view|display)\s+(?:the\s+)?(campus\s+map|map|gis|facility\s+map|live\s+map|my\s+complaints|complaints?|all\s+complaints|reports?|analytics|sla(?:\s+tracking)?|escalations|profile|users?|user\s+access|accounts?|active\s+complaints|resolved\s+complaints|assigned\s+complaints|in\s+progress|under\s+review|on\s+hold)$/i,
    )?.[1];
  }

  if (!target) {
    target = value.match(/(?:^|.*?\b)(.+?)\s+(?:kholo|khol\s+do|kholiye|dikhao|dikhaiye|par\s+jao|par\s+chalo|le\s+chalo|chalo)$/i)?.[1];
  }

  const isExplicit = Boolean(target);
  const candidate = target ? normalize(target) : value;

  const matches = navItems.flatMap((item) => {
    if (!item || item.disabled) return [];
    const aliases = [
      item.id,
      item.label,
      ...(navigationAliases[item.id] || []),
    ].map(normalize);

    return aliases
      .filter((alias) => {
        if (!alias) return false;
        if (candidate === alias) return true;
        if (isExplicit) {
          return candidate.includes(alias) || alias.includes(candidate);
        }
        return false;
      })
      .map((alias) => ({
        item,
        score: candidate === alias ? 100 : alias.length,
      }));
  });

  if (!matches.length) return null;
  matches.sort((a, b) => b.score - a.score);
  return matches[0].item;
}

export function extractComplaintFields(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const fields = {};

  const titleMatch = trimmed.match(/\btitle\s*[:=]\s*([^,\n]+)/i);
  if (titleMatch) fields.title = titleMatch[1].trim();

  const catMatch = trimmed.match(/\bcategory\s*[:=]\s*([a-zA-Z]+)/i);
  if (catMatch) {
    const rawCat = catMatch[1].trim().toLowerCase();
    const catMap = {
      electrical: "Electrical",
      plumbing: "Plumbing",
      cleaning: "Cleaning",
      internet: "Internet",
      furniture: "Furniture",
      other: "Other",
    };
    if (catMap[rawCat]) fields.category = catMap[rawCat];
  }

  const buildingMatch = trimmed.match(/\bbuilding\s*[:=]\s*([^,\n]+)/i);
  if (buildingMatch) fields.building = buildingMatch[1].trim();

  const floorMatch = trimmed.match(/\bfloor\s*[:=]\s*([^,\n]+)/i);
  if (floorMatch) fields.floor = floorMatch[1].trim();

  const roomMatch = trimmed.match(/\broom\s*[:=]\s*([^,\n]+)/i);
  if (roomMatch) fields.room = roomMatch[1].trim();

  const descMatch = trimmed.match(/\b(?:desc|description)\s*[:=]\s*(.+)$/i);
  if (descMatch) fields.description = descMatch[1].trim();

  if (!fields.category) {
    if (
      /\b(wifi|wi-fi|internet|network|lan|router|ethernet|slow internet|connection)\b/i.test(
        trimmed,
      )
    ) {
      fields.category = "Internet";
    } else if (
      /\b(water|leak|leakage|pipe|tap|drain|washroom|toilet|sink|flush|plumbing)\b/i.test(
        trimmed,
      )
    ) {
      fields.category = "Plumbing";
    } else if (
      /\b(fan|light|tube|bulb|ac|air conditioner|switch|socket|plug|electricity|power|short circuit|wire|fuse|spark|cooling)\b/i.test(
        trimmed,
      )
    ) {
      fields.category = "Electrical";
    } else if (
      /\b(clean|dirty|dust|garbage|trash|waste|sweep|mop|stink|smell|dustbin|cleaning)\b/i.test(
        trimmed,
      )
    ) {
      fields.category = "Cleaning";
    } else if (
      /\b(bench|desk|chair|table|door|window|blackboard|whiteboard|podium|furniture|handle|lock)\b/i.test(
        trimmed,
      )
    ) {
      fields.category = "Furniture";
    }
  }

  if (!fields.building) {
    const bldRegex =
      /\b(PG Block|Commerce Block|Science Block|IT Labs?|Computer Labs?|Administrative Block|Admin Block|College Canteen|Canteen|Sports Complex|Gymnasium|Central Library|Library|Mass Communication Center|Mass Comm)\b/i;
    const bld = trimmed.match(bldRegex);
    if (bld) fields.building = bld[0];
  }

  if (!fields.floor) {
    const floorRegex =
      /\b(ground|1st|2nd|3rd|4th|first|second|third|fourth)\s+floor\b/i;
    const fl = trimmed.match(floorRegex);
    if (fl) {
      const norm = fl[1].toLowerCase();
      if (norm === "ground") fields.floor = "Ground Floor";
      else if (norm === "1st" || norm === "first") fields.floor = "1st Floor";
      else if (norm === "2nd" || norm === "second") fields.floor = "2nd Floor";
      else if (norm === "3rd" || norm === "third") fields.floor = "3rd Floor";
      else fields.floor = `${fl[1]} Floor`;
    }
  }

  if (!fields.room) {
    const roomRegex =
      /\b(?:room|hall|lab)\b\s*(?:number|no\.?)?\s*[:#-]?\s*([A-Za-z0-9-]+)/i;
    const rm = trimmed.match(roomRegex);
    if (rm && rm[1] && !/^(floor|block|number|no)$/i.test(rm[1])) {
      fields.room = rm[1].toUpperCase();
    } else {
      const chipMatch = trimmed.match(/\b([A-Z]\d{1,3})\b/);
      if (chipMatch) fields.room = chipMatch[1];
    }
  }

  if (!fields.category && !fields.building && !fields.room && !fields.title) {
    return null;
  }

  if (!fields.title) {
    if (fields.category === "Internet") fields.title = "Wi-Fi connectivity issue";
    else if (fields.category === "Plumbing")
      fields.title = "Water leakage and plumbing issue";
    else if (fields.category === "Electrical") fields.title = "Electrical fault";
    else if (fields.category === "Cleaning")
      fields.title = "Cleaning and sanitation request";
    else if (fields.category === "Furniture") fields.title = "Damaged furniture";
    else if (trimmed.length < 80)
      fields.title = trimmed
        .replace(/^(please\s+)?(fill\s+|complain\s+about\s+|report\s+)/i, "")
        .trim();
  }

  if (!fields.description) {
    fields.description = trimmed;
  }

  return fields;
}

export function isExitIntent(text) {
  return /\b(bye|goodbye|bye bye|exit|quit|close|stop listening|stop voice|end voice|end session|tata|see you|band karo|alvida)\b/i.test(
    text?.trim() || "",
  );
}
