import {
  eligiblePrograms,
  goalLabel,
  openingLine,
  programById,
  specificity,
  tacticLabel,
} from "./knowledge.js";
import { phraseReply } from "./llm.js";
import {
  applyExtraction,
  coarseKey,
  detectFaq,
  detectSafety,
  extractProfile,
  lessonSentence,
  nextStatus,
  normalizePhone,
  phoneFromExternalId,
  scoreLead,
  scoreUserSignal,
  situationKey,
} from "./signals.js";

function uid() {
  return globalThis.crypto.randomUUID();
}

function blankLead(channel, externalId, now) {
  return {
    id: uid(),
    channel,
    externalId,
    name: "",
    phone: phoneFromExternalId(channel, externalId),
    goal: "",
    experience: "",
    diet: "",
    constraints: "",
    consultPref: "",
    status: "new",
    safetyFlag: "",
    programId: "",
    home: false,
    score: 0,
    turns: 0,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function legalTactics(lead, objection, faq, blocked) {
  if (blocked || lead.safetyFlag === "minor" || lead.safetyFlag === "medical") return ["safety_redirect"];
  if (objection === "stop") return ["close_kindly"];
  if (lead.consultPref && lead.goal && lead.name && (lead.phone || lead.channel === "whatsapp" || lead.channel === "voice")) {
    return ["confirm"];
  }
  const tactics = [];
  if (faq) tactics.push("answer_faq");
  if (objection === "price") tactics.push("price_value", "price_defer");
  if (objection === "time") tactics.push("time_short");
  if (objection === "later") tactics.push("nurture");
  if (!lead.goal) tactics.push("ask_goal");
  else if (!lead.experience) tactics.push("ask_experience");
  else if (!lead.diet) tactics.push("ask_diet");
  else if (!lead.name) tactics.push("ask_name");
  else if (!lead.phone && lead.channel !== "whatsapp" && lead.channel !== "voice") tactics.push("ask_phone");
  else tactics.push("book");
  if (lead.goal && lead.experience) tactics.push("recommend");
  if (lead.goal && lead.name && (lead.phone || lead.channel === "whatsapp" || lead.channel === "voice")) tactics.push("book");
  return [...new Set(tactics)];
}

export function nextQuestion(lead) {
  if (!lead.goal) return "What do you most want to change?";
  if (!lead.experience) return "Have you trained before, or are you starting from scratch?";
  if (!lead.diet) return "Do you eat vegetarian, vegan, or non-vegetarian?";
  if (!lead.name) return "What name should the coach use?";
  if (!lead.phone && lead.channel !== "whatsapp" && lead.channel !== "voice") {
    return "What's the best phone number for a short intro call?";
  }
  if (!lead.consultPref) return "Do you prefer a weekday morning or a weekday evening?";
  return "";
}

async function chooseTactic(store, env, lead, objection, legal) {
  const epsilon = Number(env.LEARN_EPSILON ?? 0.08);
  const exact = situationKey(lead, objection);
  const coarse = coarseKey(lead, objection);
  const rows = await store.policyFor([exact, coarse]);
  const ranked = legal.map((tactic) => {
    const exactRow = rows.find((row) => row.key === exact && row.tactic === tactic && !row.programId);
    const coarseRow = rows.find((row) => row.key === coarse && row.tactic === tactic && !row.programId);
    const row = exactRow?.n ? exactRow : coarseRow?.n ? coarseRow : null;
    return { tactic, n: row?.n || 0, avg: row?.n ? row.rewardSum / row.n : null };
  });
  const untried = ranked.filter((row) => row.n === 0);
  if (epsilon > 0 && untried.length && Math.random() < epsilon) {
    return untried[Math.floor(Math.random() * untried.length)].tactic;
  }
  const tried = ranked.filter((row) => row.avg !== null).sort((a, b) => b.avg - a.avg);
  if (!tried.length) return legal[0];
  if (tried[0].avg < 0 && untried.length) return untried[0].tactic;
  return tried[0].tactic;
}

async function chooseProgram(store, lead) {
  const options = eligiblePrograms(lead);
  if (!options.length) return programById("foundation");
  const diet = lead.diet || "any";
  const keys = [`program:${lead.goal || "general"}:${diet}`, `program:${lead.goal || "general"}:any`];
  const rows = await store.policyFor(keys);
  const ranked = options
    .map((program) => {
      const relevant = rows.filter((row) => row.programId === program.id && row.n > 0);
      const n = relevant.reduce((sum, row) => sum + row.n, 0);
      const reward = relevant.reduce((sum, row) => sum + row.rewardSum, 0);
      return { program, avg: n ? reward / n : null, specificity: specificity(program, lead) };
    })
    .sort((a, b) => {
      if (a.avg === null && b.avg === null) return b.specificity - a.specificity;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg || b.specificity - a.specificity;
    });
  return ranked[0].program;
}

function faqAnswer(faq) {
  if (faq === "pricing") {
    return "The intro call is free. Coaching is quoted on that call so it matches the goal, instead of a price picked before we know what you need.";
  }
  if (faq === "where") {
    return "The intro can be a phone call or a WhatsApp thread. Training can be at a gym or at home once a coach knows your setup.";
  }
  if (faq === "nutrition") {
    return "The desk can describe a simple plate. It does not hand out medical meal plans, calorie targets, or diets for a condition.";
  }
  if (faq === "services") {
    return "We take the enquiry, match a training and nutrition approach, and book a free intro with a coach.";
  }
  return "I'm Forma Desk, the enquiry line. I qualify what you want and book a free intro. A human coach runs the actual plan.";
}

function safetyReply(flag) {
  if (flag === "minor") {
    return "I can't put together training or nutrition for anyone under 18. A parent or guardian should speak with a doctor or a qualified youth coach. I can stop here.";
  }
  if (flag === "medical") {
    return "That needs a doctor or a registered dietitian, not this desk. I won't suggest a workout or a diet for it. If you want a general callback later, a coach can talk only after you've had that advice.";
  }
  return "I can't help with a rapid cut, a crash diet, or a one-week drop. If you want a steady approach instead, tell me the goal and I'll line up a normal intro.";
}

export function composeReply({ tactic, lead, program, faq, first }) {
  const question = nextQuestion(lead);
  const who = lead.name ? lead.name.split(" ")[0] : "";
  const note =
    first && tactic !== "ask_goal" && tactic !== "safety_redirect"
      ? "Quick note: this desk takes enquiries and is not a doctor or dietitian. "
      : "";
  const injury = lead.constraints
    ? ` Mention the ${lead.constraints} on the intro so the coach keeps impact low. This desk can't assess an injury.`
    : "";

  if (tactic === "safety_redirect") return safetyReply(lead.safetyFlag || "extreme");
  if (tactic === "close_kindly") {
    return "Understood. I won't keep messaging. If you want training or nutrition help later, start a new note here.";
  }
  if (tactic === "confirm") {
    const when = lead.consultPref === "evening" ? "weekday evening" : "weekday morning";
    const reach = lead.phone ? ` We'll use ${lead.phone}.` : " We'll stay on this chat.";
    return `You're down for a free intro on a ${when}.${reach} A coach will confirm the exact time. Bring any schedule limits and leave medical questions with your clinician.`;
  }
  if (tactic === "answer_faq") {
    return `${faqAnswer(faq)} ${question}`.trim();
  }
  if (tactic === "ask_goal") {
    return first
      ? openingLine()
      : "What do you most want to change — fat loss, muscle, strength, or more energy day to day?";
  }
  if (tactic === "ask_experience") {
    return `${note}Got it, ${goalLabel(lead.goal)}. Have you trained before, or are you starting from scratch?`.trim();
  }
  if (tactic === "ask_diet") {
    const ask = `For ${goalLabel(lead.goal)}, do you eat vegetarian, vegan, or non-vegetarian? I only need that so the meals aren't the wrong kind.`;
    return `${note}${who ? `${who}, ${ask.charAt(0).toLowerCase()}${ask.slice(1)}` : ask}`.trim();
  }
  if (tactic === "ask_name") {
    return `${note}${program ? program.pitch : "There is a straightforward plan for this."} What name should the coach use?`.trim();
  }
  if (tactic === "ask_phone") {
    return `${note}${who ? `${who}, what's` : "What's"} the best phone number for a short intro? WhatsApp is fine.`.trim();
  }
  if (tactic === "recommend") {
    return `${note}${program.pitch}${injury} ${question}`.trim();
  }
  if (tactic === "price_value") {
    return `${note}The intro call is free, and it's where a coach matches the plan to your week before anyone talks about a package. ${program && lead.goal ? program.pitch : ""} ${question}`
      .replace(/\s+/g, " ")
      .trim();
  }
  if (tactic === "price_defer") {
    return `${note}Package prices depend on how often you train and whether you want nutrition check-ins, so the desk doesn't quote a number blind. The intro is free. ${question}`.trim();
  }
  if (tactic === "time_short") {
    const short = program?.shortTime || "two or three short sessions";
    return `${note}Then we keep it small: ${short}, not a six-day plan. ${question}`.trim();
  }
  if (tactic === "nurture") {
    return `No rush. I'll keep this as ${goalLabel(lead.goal)}. When you want the free intro, reply here and the desk will pick it up.`;
  }
  if (tactic === "book") {
    return `${program ? `${program.pitch} ` : ""}I can book the free intro. ${question}`.trim();
  }
  return `${question || openingLine()}`;
}

function actionsFor(tactic, program) {
  const actions = ["retrieve_playbook", "update_lead"];
  if (program && ["recommend", "price_value", "time_short", "book", "confirm", "ask_name"].includes(tactic)) {
    actions.push("choose_program");
  }
  if (tactic === "confirm") actions.push("book_consult");
  if (tactic === "safety_redirect") actions.push("refer_out");
  return actions;
}

export async function handleTurn(store, env = {}, input) {
  const now = input.now || new Date().toISOString();
  const text = String(input.text || "").trim();
  if (!text) {
    return { reply: openingLine(), lead: null, learning: null, actions: [], mode: "learned-policy", approach: "", tactic: "", program: null };
  }

  let lead = await store.findLead(input.channel, input.externalId);
  if (!lead) {
    lead = blankLead(input.channel, input.externalId, now);
    await store.createLead(lead);
  }
  if (!lead.phone && input.phoneHint) {
    const hinted = normalizePhone(input.phoneHint);
    if (hinted) lead.phone = hinted;
  }

  const history = await store.recentMessages(lead.id, 8);
  const previous = [...history].reverse().find((message) => message.role === "agent");
  const extracted = extractProfile(text);
  const signal = scoreUserSignal(text, extracted);

  if (previous?.tactic) {
    const reward = signal.reward;
    await store.reinforce({ key: previous.situation, tactic: previous.tactic, reward });
    const coarse = coarseKey(
      { goal: previous.situation.split(":")[0] },
      previous.situation.split(":")[1] === "none" ? "" : previous.situation.split(":")[1],
    );
    if (coarse !== previous.situation) {
      await store.reinforce({ key: coarse, tactic: previous.tactic, reward });
    }
    if (previous.programId && reward > 0) {
      const [goal, , ,] = previous.situation.split(":");
      await store.reinforce({
        key: `program:${goal}:${lead.diet || "any"}`,
        tactic: "program",
        programId: previous.programId,
        reward,
      });
    }
    if (Math.abs(reward) >= 1) {
      const goal = previous.situation.split(":")[0];
      await store.noteLesson({
        pattern: `${goal}:${previous.tactic}`,
        lesson: lessonSentence(goal, previous.tactic, reward),
        reward,
      });
    }
  }

  applyExtraction(lead, extracted);
  const safety = detectSafety(text);
  if (safety.flag === "minor" || safety.flag === "medical") lead.safetyFlag = safety.flag;
  if (safety.flag === "extreme") {
    lead.notes = lead.notes ? lead.notes : "Asked for a rapid or crash cut.";
  }
  if (safety.flag === "injury" && !lead.constraints) lead.constraints = "injury";

  const faq = detectFaq(text);
  const blocked = safety.block;
  const legal = legalTactics(lead, signal.objection, faq, blocked);
  const tactic = await chooseTactic(store, env, lead, signal.objection, legal);
  const program = lead.goal && tactic !== "safety_redirect" && tactic !== "close_kindly" ? await chooseProgram(store, lead) : null;
  if (program && ["recommend", "book", "confirm", "price_value", "time_short", "ask_name"].includes(tactic)) {
    lead.programId = program.id;
  }

  const first = lead.turns === 0;
  const draft = composeReply({
    tactic,
    lead: { ...lead, safetyFlag: lead.safetyFlag || safety.flag },
    program,
    faq,
    first,
  });

  let reply = draft;
  let mode = "learned-policy";
  if (!blocked && tactic !== "close_kindly" && env) {
    try {
      const phrased = await phraseReply(env, {
        tactic: tacticLabel(tactic),
        facts: draft,
        question: nextQuestion(lead),
        program: program?.name || "",
      });
      if (phrased) {
        reply = phrased;
        mode = "learned-policy+llm";
      }
    } catch {
      mode = "learned-policy";
    }
  }

  if (tactic === "confirm") lead.status = "booked";
  else if (signal.objection === "stop") lead.status = "lost";
  else lead.status = nextStatus(lead, scoreLead({ ...lead, status: lead.status === "booked" ? "booked" : "new" }));
  lead.score = scoreLead(lead);
  lead.turns += 1;
  lead.updatedAt = now;

  const situation = situationKey(lead, signal.objection);
  await store.saveLead(lead);
  await store.addMessage({
    leadId: lead.id,
    role: "user",
    content: text,
    tactic: "",
    situation: "",
    programId: "",
    createdAt: now,
  });
  await store.addMessage({
    leadId: lead.id,
    role: "agent",
    content: reply,
    tactic,
    situation,
    programId: program?.id || "",
    createdAt: now,
  });

  const learning = await store.learningView();
  return {
    reply,
    lead: publicLead(lead),
    learning,
    actions: actionsFor(tactic, program),
    mode,
    tactic,
    approach: tacticLabel(tactic),
    program: program ? { id: program.id, name: program.name } : null,
  };
}

export function publicLead(lead, { revealPhone = false } = {}) {
  return {
    id: lead.id,
    channel: lead.channel,
    name: lead.name,
    phone: revealPhone ? lead.phone : mask(lead.phone),
    goal: lead.goal,
    experience: lead.experience,
    diet: lead.diet,
    constraints: lead.constraints,
    consultPref: lead.consultPref,
    status: lead.status,
    safetyFlag: lead.safetyFlag,
    programId: lead.programId,
    home: lead.home,
    score: lead.score,
    turns: lead.turns,
    updatedAt: lead.updatedAt,
  };
}

function mask(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `••••${digits.slice(-4)}`;
}

export async function recordOutcome(store, leadId, outcome) {
  const lead = await store.getLead(leadId);
  if (!lead) return null;
  const history = await store.recentMessages(lead.id, 8);
  const previous = [...history].reverse().find((message) => message.role === "agent");
  const reward = outcome === "booked" ? 2.5 : outcome === "lost" ? -1.5 : 0;
  if (previous?.tactic && reward) {
    await store.reinforce({ key: previous.situation, tactic: previous.tactic, reward });
    const goal = previous.situation.split(":")[0];
    const objection = previous.situation.split(":")[1];
    const coarse = `${goal}:${objection || "none"}`;
    if (coarse !== previous.situation) await store.reinforce({ key: coarse, tactic: previous.tactic, reward });
    if (previous.programId && reward > 0) {
      await store.reinforce({
        key: `program:${goal}:${lead.diet || "any"}`,
        tactic: "program",
        programId: previous.programId,
        reward,
      });
    }
    await store.noteLesson({
      pattern: `${goal}:${previous.tactic}`,
      lesson: lessonSentence(goal, previous.tactic, reward),
      reward,
    });
  }
  lead.status = outcome === "booked" ? "booked" : "lost";
  lead.score = scoreLead(lead);
  lead.updatedAt = new Date().toISOString();
  await store.saveLead(lead);
  return publicLead(lead);
}

export { openingLine };
