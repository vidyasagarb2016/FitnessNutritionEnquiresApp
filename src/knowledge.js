export const PROGRAMS = [
  {
    id: "home-fat-loss",
    name: "Home Fat Loss",
    goals: ["fat_loss", "home"],
    diets: ["any"],
    home: true,
    pitch:
      "Home Fat Loss is 3 short sessions a week with a floor, a chair, and a bag or bands, plus a repeatable plate. No crash cut.",
    shortTime: "3 short home sessions",
  },
  {
    id: "home-strength",
    name: "Home Strength",
    goals: ["home", "strength", "general"],
    diets: ["any"],
    home: true,
    pitch:
      "Home Strength is 3 full-body sessions you can do in a small room. The aim is a routine you can repeat, not a six-day grind.",
    shortTime: "3 short home strength sessions",
  },
  {
    id: "plant-fat-loss",
    name: "Plant-Based Fat Loss",
    goals: ["fat_loss"],
    diets: ["vegetarian", "vegan"],
    home: false,
    pitch:
      "Plant-Based Fat Loss is 3 full-body strength sessions a week and a plate built from protein, vegetables, and slow carbs. No crash cut. Tell the coach if you avoid eggs or roots.",
    shortTime: "3 short strength sessions and a simple plate",
  },
  {
    id: "fat-loss",
    name: "Fat Loss Foundations",
    goals: ["fat_loss"],
    diets: ["any"],
    home: false,
    pitch:
      "Fat Loss Foundations is 3 strength sessions a week and a steady meal structure. We do not use starvation cuts or week-long crash plans.",
    shortTime: "3 short strength sessions",
  },
  {
    id: "plant-muscle",
    name: "Plant-Based Muscle",
    goals: ["muscle"],
    diets: ["vegetarian", "vegan"],
    home: false,
    pitch:
      "Plant-Based Muscle is progressive strength work 3 or 4 days a week, with protein at each meal so the surplus actually supports training.",
    shortTime: "3 short strength sessions and a protein target you can keep",
  },
  {
    id: "muscle",
    name: "Muscle Gain",
    goals: ["muscle"],
    diets: ["any"],
    home: false,
    pitch:
      "Muscle Gain is progressive strength work 3 or 4 days a week and enough food to recover. The intro call checks that the schedule fits your week.",
    shortTime: "3 short lifting sessions",
  },
  {
    id: "foundation",
    name: "Strength Foundations",
    goals: ["strength", "general"],
    diets: ["any"],
    home: false,
    pitch:
      "Strength Foundations is 3 coached full-body days for people who want to feel stronger and more consistent, without an extreme diet.",
    shortTime: "3 short full-body sessions",
  },
  {
    id: "endurance",
    name: "Endurance Base",
    goals: ["endurance"],
    diets: ["any"],
    home: false,
    pitch:
      "Endurance Base mixes easy cardio with 2 strength sessions so you can build stamina without breaking down. Fueling stays regular, not restrictive.",
    shortTime: "2 short strength sessions plus easy cardio",
  },
];

export const SEED_POLICY = [
  { key: "fat_loss:price", tactic: "price_value", programId: "", rewardSum: 4, n: 2 },
  { key: "fat_loss:price", tactic: "price_defer", programId: "", rewardSum: 1, n: 2 },
  { key: "muscle:price", tactic: "price_value", programId: "", rewardSum: 3, n: 2 },
  { key: "general:price", tactic: "price_value", programId: "", rewardSum: 3, n: 2 },
  { key: "program:fat_loss:vegetarian", tactic: "program", programId: "plant-fat-loss", rewardSum: 3, n: 2 },
  { key: "program:fat_loss:vegan", tactic: "program", programId: "plant-fat-loss", rewardSum: 3, n: 2 },
  { key: "program:fat_loss:any", tactic: "program", programId: "fat-loss", rewardSum: 2, n: 2 },
  { key: "program:muscle:vegetarian", tactic: "program", programId: "plant-muscle", rewardSum: 3, n: 2 },
  { key: "program:muscle:any", tactic: "program", programId: "muscle", rewardSum: 2, n: 2 },
];

export const SEED_LESSONS = [
  {
    pattern: "fat_loss:price",
    lesson: "On fat-loss enquiries, explain the free intro before anyone discusses a package.",
    weight: 1.6,
    n: 2,
  },
  {
    pattern: "extreme",
    lesson: "Requests for a crash cut or a one-week transformation do not convert when the desk plays along. Refuse them and offer a steady plan.",
    weight: 1.8,
    n: 2,
  },
];

export const GOAL_LABELS = {
  fat_loss: "fat loss",
  muscle: "building muscle",
  strength: "getting stronger",
  endurance: "building stamina",
  home: "training at home",
  general: "feeling better day to day",
};

export function goalLabel(goal) {
  return GOAL_LABELS[goal] || "your goal";
}

export function tacticLabel(tactic) {
  const labels = {
    ask_goal: "Ask for the goal first",
    ask_experience: "Ask training history",
    ask_diet: "Ask how they eat",
    ask_name: "Ask for a name",
    ask_phone: "Ask for a callback number",
    recommend: "Recommend a program",
    price_value: "Lead with the free intro",
    price_defer: "Defer package price to the call",
    time_short: "Offer the short version",
    book: "Offer a weekday intro",
    confirm: "Confirm the intro",
    nurture: "Leave the door open",
    answer_faq: "Answer the question, then qualify",
    safety_redirect: "Stop and refer out",
    close_kindly: "Stop messaging",
  };
  return labels[tactic] || tactic;
}

export function openingLine() {
  return "Hi, this is Forma Desk for fitness and nutrition enquiries. I'm not a doctor or a dietitian. Tell me what you want to change — fat loss, muscle, strength, or more energy.";
}

export function dietOk(program, lead) {
  if (!lead.diet) return program.diets.includes("any");
  return program.diets.includes(lead.diet) || program.diets.includes("any");
}

export function eligiblePrograms(lead) {
  const homeFirst = PROGRAMS.filter((program) => {
    const goalOk = !lead.goal || program.goals.includes(lead.goal);
    return goalOk && dietOk(program, lead) && program.home === true;
  });
  if (lead.home && homeFirst.length) return homeFirst;
  return PROGRAMS.filter((program) => {
    const goalOk = !lead.goal || program.goals.includes(lead.goal);
    return goalOk && dietOk(program, lead) && program.home !== true;
  });
}

export function specificity(program, lead) {
  let score = 0;
  if (lead.diet && program.diets.includes(lead.diet)) score += 2;
  if (lead.home && program.home) score += 2;
  if (lead.goal && program.goals[0] === lead.goal) score += 1;
  return score;
}

export function programById(id) {
  return PROGRAMS.find((program) => program.id === id) || null;
}
