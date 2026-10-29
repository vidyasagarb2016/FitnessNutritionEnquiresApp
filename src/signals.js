const NAME_STOP = new Set([
  "a",
  "an",
  "vegetarian",
  "vegan",
  "eggetarian",
  "pescatarian",
  "looking",
  "trying",
  "new",
  "beginner",
  "interested",
  "calling",
  "good",
  "fine",
  "from",
  "just",
  "not",
  "also",
  "very",
  "really",
  "currently",
  "based",
  "doing",
  "hoping",
  "here",
  "keen",
  "ready",
  "wondering",
  "hoping",
  "planning",
  "starting",
  "training",
  "working",
  "busy",
  "and",
  "but",
  "please",
  "weekday",
  "morning",
  "evening",
  "thanks",
  "free",
  "available",
  "around",
  "about",
  "into",
  "onto",
  "over",
  "under",
  "after",
  "before",
  "with",
  "the",
]);

const GOAL_RULES = [
  [/fat|weight loss|lose weight|losing weight|slim|belly|cut down/i, "fat_loss"],
  [/muscle|bulk|hypertrophy|gain weight|get bigger/i, "muscle"],
  [/strength|stronger|powerlift/i, "strength"],
  [/run|marathon|endurance|stamina|cardio/i, "endurance"],
  [/energy|healthy eating|get fit|feel better|general fitness|tone up/i, "general"],
];

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function titleName(value) {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractProfile(text) {
  const raw = text || "";
  const lower = raw.toLowerCase();
  const extracted = {};

  if (/\b(at home|home workout|no gym|without a gym)\b/.test(lower)) extracted.home = true;

  let goalAt = Infinity;
  for (const [pattern, goal] of GOAL_RULES) {
    const match = pattern.exec(lower);
    if (match && match.index < goalAt) {
      goalAt = match.index;
      extracted.goal = goal;
    }
  }
  if (/\bhome\b/.test(lower) && extracted.goal === undefined && extracted.home) extracted.goal = "home";

  if (/\bnot\s+(a\s+)?vegetarian\b|\bnon[- ]?veg/.test(lower)) extracted.diet = "non_veg";
  else if (/\bvegan\b/.test(lower)) extracted.diet = "vegan";
  else if (/\beggetarian\b|\beggitarian\b/.test(lower)) extracted.diet = "eggetarian";
  else if (/\bpescatarian\b/.test(lower)) extracted.diet = "pescatarian";
  else if (/\bvegetarian\b|\bjain\b|\bveg\b/.test(lower)) extracted.diet = "vegetarian";

  if (/\b(never trained|starting from scratch|new to (the )?gym|beginner|first time|i'?m new)\b/.test(lower)) {
    extracted.experience = "beginner";
  } else if (/\b(intermediate|some experience|trained before|a few months|on and off)\b/.test(lower)) {
    extracted.experience = "intermediate";
  } else if (/\b(advanced|for years|years of training|experienced)\b/.test(lower)) {
    extracted.experience = "advanced";
  }

  const namePattern =
    /\b(?:my name is|name'?s|this is|i am|i'm|im)\s+([a-z][a-z'’-]{1,20})(?:\s+([a-z][a-z'’-]{1,20}))?/gi;
  for (const nameMatch of raw.matchAll(namePattern)) {
    const first = nameMatch[1].toLowerCase();
    const second = nameMatch[2] ? nameMatch[2].toLowerCase() : "";
    if (NAME_STOP.has(first)) continue;
    const usableSecond = second && !NAME_STOP.has(second);
    extracted.name = titleName(usableSecond ? `${nameMatch[1]} ${nameMatch[2]}` : nameMatch[1]);
    break;
  }

  const phoneMatch = /(\+?\d[\d\s\-()]{8,}\d)/.exec(raw);
  if (phoneMatch) {
    const digits = phoneMatch[1].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) extracted.phone = phoneMatch[1].replace(/\s+/g, " ").trim();
  }

  if (/\bmorning\b/.test(lower)) extracted.consultPref = "morning";
  else if (/\bevening\b/.test(lower)) extracted.consultPref = "evening";

  const constraints = [];
  if (/\bknee\b/.test(lower)) constraints.push("knee");
  if (/\b(back|lower back)\b/.test(lower)) constraints.push("back");
  if (/\bshoulder\b/.test(lower)) constraints.push("shoulder");
  if (constraints.length) extracted.constraints = constraints.join(", ");

  return extracted;
}

export function detectSafety(text) {
  const lower = (text || "").toLowerCase();
  const ageMatch = /\b(?:i am|i'm|im|age(?: is)?)\s*(\d{1,2})\b/.exec(lower);
  const yearsMatch = /\b(\d{1,2})\s*(?:years?\s*old|yo)\b/.exec(lower);
  const age = ageMatch ? Number(ageMatch[1]) : yearsMatch ? Number(yearsMatch[1]) : null;
  if ((age !== null && age < 18) || /\b(my son|my daughter|my kid|my child|high school|under 18)\b/.test(lower)) {
    return { flag: "minor", block: true };
  }
  if (
    /\b(anorexia|bulimia|purge|eating disorder|pregnant|pregnancy|diabetes|insulin|chest pain|faint|kidney|cancer)\b/.test(
      lower,
    )
  ) {
    return { flag: "medical", block: true };
  }
  if (
    /\b(lose|drop|cut)\s+\d+\s*(kg|kilos|pounds|lbs)\s+in\s+(a|one|1)\s+(week|day)\b/.test(lower) ||
    /\b(starve|starvation|crash diet|water cut|dry scoop)\b/.test(lower)
  ) {
    return { flag: "extreme", block: true };
  }
  if (/\b(injury|injured|in pain|hurts)\b/.test(lower)) return { flag: "injury", block: false };
  return { flag: "", block: false };
}

export function detectFaq(text) {
  const lower = (text || "").toLowerCase();
  if (/\b(how much|price|cost|fee|package|charges)\b/.test(lower)) return "pricing";
  if (/\b(online|in person|virtual|where are you|location)\b/.test(lower)) return "where";
  if (/\b(meal plan|diet plan|what should i eat|macros)\b/.test(lower)) return "nutrition";
  if (/\b(what do you offer|programs|services|what do you do)\b/.test(lower)) return "services";
  if (/\b(who are you|are you (a )?bot|certified|qualified)\b/.test(lower)) return "about";
  return "";
}

export function scoreUserSignal(text, extracted) {
  const lower = (text || "").toLowerCase();
  if (/\b(stop|unsubscribe|not interested|leave me alone|wrong number)\b/.test(lower)) {
    return { reward: -1.6, objection: "stop" };
  }

  let reward = 0;
  let objection = "";
  const wantsBook =
    /\b(book|sign me up|schedule|consult)\b/.test(lower) ||
    (/\b(yes|yeah|yep|ok|okay|sure)\b/.test(lower) && /\b(book|consult|call|intro)\b/.test(lower));
  if (wantsBook || extracted.consultPref) reward += 2;
  else if (/\b(yes|sounds good|perfect|great|interested|that works|love that|helpful|let'?s do it)\b/.test(lower)) {
    reward += 1;
  }
  if (extracted.phone) reward += 1.4;
  if (extracted.goal || extracted.diet || extracted.experience || extracted.name) reward += 0.45;
  if (/\b(expensive|too much|can'?t afford|costly)\b/.test(lower)) {
    objection = "price";
    reward -= 0.35;
  } else if (/\b(how much|price|cost|fee)\b/.test(lower)) {
    objection = "price";
    reward += 0.2;
  }
  if (/\b(no time|too busy|so busy|hectic|long hours)\b/.test(lower)) {
    objection = objection || "time";
    reward -= 0.15;
  }
  if (/\b(maybe later|not now|think about it|sometime)\b/.test(lower)) {
    objection = objection || "later";
    reward -= 0.25;
  }
  if (/\b(thanks|thank you)\b/.test(lower)) reward += 0.3;
  if (/\b(wrong|not right|incorrect|i didn'?t say)\b/.test(lower)) reward -= 1;
  return { reward: Math.round(reward * 100) / 100, objection };
}

export function applyExtraction(lead, extracted) {
  for (const key of ["name", "phone", "goal", "experience", "diet", "consultPref"]) {
    if (extracted[key]) lead[key] = extracted[key];
  }
  if (extracted.constraints) {
    const existing = new Set((lead.constraints || "").split(", ").filter(Boolean));
    for (const item of extracted.constraints.split(", ")) existing.add(item);
    lead.constraints = [...existing].join(", ");
  }
  if (extracted.home) lead.home = true;
  return lead;
}

export function scoreLead(lead) {
  let score = 0;
  if (lead.goal) score += 20;
  if (lead.experience) score += 10;
  if (lead.diet) score += 10;
  if (lead.name) score += 15;
  if (lead.phone) score += 25;
  if (lead.consultPref) score += 10;
  if (lead.status === "booked") score += 10;
  return Math.min(100, score);
}

export function nextStatus(lead, score) {
  if (lead.status === "lost" || lead.status === "booked") return lead.status;
  if (score >= 55) return "qualified";
  if (score >= 20) return "qualifying";
  return "new";
}

export function situationKey(lead, objection) {
  return [
    lead.goal || "unknown",
    objection || "none",
    lead.experience ? "exp" : "new",
    lead.phone ? "has_phone" : "no_phone",
  ].join(":");
}

export function coarseKey(lead, objection) {
  return `${lead.goal || "unknown"}:${objection || "none"}`;
}

export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  return `+${digits}`;
}

export function phoneFromExternalId(channel, externalId) {
  if (channel !== "whatsapp") return "";
  return normalizePhone(externalId);
}

export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

export function lessonSentence(goal, tactic, reward) {
  const name = goalLabelSafe(goal);
  if (reward > 0) {
    return `For ${name} enquiries, "${tacticLabelSafe(tactic)}" has been followed by a useful next step.`;
  }
  return `For ${name} enquiries, "${tacticLabelSafe(tactic)}" has been followed by hesitation. Prefer the higher-scoring alternative.`;
}

function goalLabelSafe(goal) {
  return (
    {
      fat_loss: "fat-loss",
      muscle: "muscle",
      strength: "strength",
      endurance: "endurance",
      home: "home-training",
      general: "general",
      unknown: "unspecified",
    }[goal] || goal || "unspecified"
  );
}

function tacticLabelSafe(tactic) {
  return tactic || "that approach";
}
