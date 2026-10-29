import { SEED_LESSONS, SEED_POLICY } from "./knowledge.js";
import { SCHEMA_STATEMENTS } from "./schema.js";

function emptyDb() {
  return { leads: [], messages: [], policy: [], lessons: [], seq: 1 };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryStore() {
  let db = emptyDb();
  let persist = async () => {};
  let queue = Promise.resolve();

  async function save() {
    const snap = clone(db);
    queue = queue.then(() => persist(snap)).catch(() => {});
    await queue;
  }

  function findPolicy(key, tactic, programId) {
    const id = programId || "";
    return db.policy.find((row) => row.key === key && row.tactic === tactic && (row.programId || "") === id);
  }

  return {
    kind: "memory",
    load(data) {
      db = {
        leads: data.leads || [],
        messages: data.messages || [],
        policy: data.policy || [],
        lessons: data.lessons || [],
        seq: data.seq || 1,
      };
    },
    export() {
      return clone(db);
    },
    setPersist(fn) {
      persist = fn;
    },
    hasPolicy() {
      return db.policy.length > 0;
    },
    seed() {
      if (db.policy.length) return;
      db.policy.push(...SEED_POLICY.map((row) => ({ ...row })));
      const now = new Date().toISOString();
      db.lessons.push(...SEED_LESSONS.map((row) => ({ ...row, updatedAt: now })));
    },
    async findLead(channel, externalId) {
      return db.leads.find((lead) => lead.channel === channel && lead.externalId === externalId) || null;
    },
    async getLead(id) {
      return db.leads.find((lead) => lead.id === id) || null;
    },
    async createLead(lead) {
      db.leads.push(lead);
      await save();
      return lead;
    },
    async saveLead(lead) {
      const index = db.leads.findIndex((item) => item.id === lead.id);
      if (index === -1) db.leads.push(lead);
      else db.leads[index] = lead;
      await save();
    },
    async addMessage(message) {
      const row = { ...message, id: db.seq++ };
      db.messages.push(row);
      await save();
      return row;
    },
    async recentMessages(leadId, limit = 12) {
      return db.messages.filter((message) => message.leadId === leadId).slice(-limit);
    },
    async listLeads() {
      return [...db.leads].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 50);
    },
    async policyFor(keys) {
      const wanted = new Set(keys);
      return db.policy.filter((row) => wanted.has(row.key));
    },
    async reinforce({ key, tactic, programId = "", reward }) {
      const row = findPolicy(key, tactic, programId);
      if (row) {
        row.rewardSum += reward;
        row.n += 1;
      } else {
        db.policy.push({ key, tactic, programId: programId || "", rewardSum: reward, n: 1 });
      }
      await save();
    },
    async noteLesson({ pattern, lesson, reward }) {
      const now = new Date().toISOString();
      const existing = db.lessons.find((item) => item.pattern === pattern);
      if (existing) {
        existing.weight = Math.round((existing.weight * 0.7 + reward * 0.3) * 100) / 100;
        existing.n += 1;
        existing.lesson = lesson;
        existing.updatedAt = now;
      } else {
        db.lessons.push({ pattern, lesson, weight: reward, n: 1, updatedAt: now });
      }
      db.lessons.sort((a, b) => b.weight - a.weight);
      db.lessons = db.lessons.slice(0, 30);
      await save();
    },
    async topLessons(limit = 6) {
      return [...db.lessons].sort((a, b) => b.weight - a.weight).slice(0, limit);
    },
    async learningView() {
      const tactics = db.policy
        .filter((row) => row.tactic !== "program")
        .map((row) => ({
          key: row.key,
          tactic: row.tactic,
          rewardSum: row.rewardSum,
          n: row.n,
          avg: row.n ? Math.round((row.rewardSum / row.n) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.avg - a.avg || b.n - a.n)
        .slice(0, 12);
      const programs = db.policy
        .filter((row) => row.tactic === "program")
        .map((row) => ({
          key: row.key,
          programId: row.programId,
          n: row.n,
          avg: row.n ? Math.round((row.rewardSum / row.n) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.avg - a.avg);
      return {
        lessons: await this.topLessons(8),
        tactics,
        programs,
        leads: db.leads.length,
        booked: db.leads.filter((lead) => lead.status === "booked").length,
      };
    },
  };
}

function rowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    channel: row.channel,
    externalId: row.external_id,
    name: row.name || "",
    phone: row.phone || "",
    goal: row.goal || "",
    experience: row.experience || "",
    diet: row.diet || "",
    constraints: row.constraints || "",
    consultPref: row.consult_pref || "",
    status: row.status || "new",
    safetyFlag: row.safety_flag || "",
    programId: row.program_id || "",
    home: Boolean(row.home),
    score: row.score || 0,
    turns: row.turns || 0,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let d1Ready = null;

export function createD1Store(d1) {
  async function ensure() {
    if (!d1Ready) {
      d1Ready = (async () => {
        await d1.batch(SCHEMA_STATEMENTS.map((sql) => d1.prepare(sql)));
        const count = await d1.prepare("SELECT COUNT(*) AS c FROM policy").first();
        if (!Number(count?.c || 0)) {
          const now = new Date().toISOString();
          const inserts = [
            ...SEED_POLICY.map((row) =>
              d1
                .prepare(
                  "INSERT INTO policy (key, tactic, program_id, reward_sum, n) VALUES (?, ?, ?, ?, ?)",
                )
                .bind(row.key, row.tactic, row.programId || "", row.rewardSum, row.n),
            ),
            ...SEED_LESSONS.map((row) =>
              d1
                .prepare("INSERT INTO lessons (pattern, lesson, weight, n, updated_at) VALUES (?, ?, ?, ?, ?)")
                .bind(row.pattern, row.lesson, row.weight, row.n, now),
            ),
          ];
          await d1.batch(inserts);
        }
      })().catch((error) => {
        d1Ready = null;
        throw error;
      });
    }
    await d1Ready;
  }

  return {
    kind: "d1",
    async findLead(channel, externalId) {
      await ensure();
      const row = await d1
        .prepare("SELECT * FROM leads WHERE channel = ? AND external_id = ?")
        .bind(channel, externalId)
        .first();
      return rowToLead(row);
    },
    async getLead(id) {
      await ensure();
      return rowToLead(await d1.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first());
    },
    async createLead(lead) {
      await this.saveLead(lead);
      return lead;
    },
    async saveLead(lead) {
      await ensure();
      await d1
        .prepare(
          `INSERT INTO leads (
            id, channel, external_id, name, phone, goal, experience, diet, constraints, consult_pref,
            status, safety_flag, program_id, home, score, turns, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            goal = excluded.goal,
            experience = excluded.experience,
            diet = excluded.diet,
            constraints = excluded.constraints,
            consult_pref = excluded.consult_pref,
            status = excluded.status,
            safety_flag = excluded.safety_flag,
            program_id = excluded.program_id,
            home = excluded.home,
            score = excluded.score,
            turns = excluded.turns,
            notes = excluded.notes,
            updated_at = excluded.updated_at`,
        )
        .bind(
          lead.id,
          lead.channel,
          lead.externalId,
          lead.name || "",
          lead.phone || "",
          lead.goal || "",
          lead.experience || "",
          lead.diet || "",
          lead.constraints || "",
          lead.consultPref || "",
          lead.status || "new",
          lead.safetyFlag || "",
          lead.programId || "",
          lead.home ? 1 : 0,
          lead.score || 0,
          lead.turns || 0,
          lead.notes || "",
          lead.createdAt,
          lead.updatedAt,
        )
        .run();
    },
    async addMessage(message) {
      await ensure();
      await d1
        .prepare(
          "INSERT INTO messages (lead_id, role, content, tactic, situation, program_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          message.leadId,
          message.role,
          message.content,
          message.tactic || "",
          message.situation || "",
          message.programId || "",
          message.createdAt,
        )
        .run();
    },
    async recentMessages(leadId, limit = 12) {
      await ensure();
      const { results } = await d1
        .prepare(
          "SELECT * FROM messages WHERE lead_id = ? ORDER BY id DESC LIMIT ?",
        )
        .bind(leadId, limit)
        .all();
      return (results || [])
        .map((row) => ({
          id: row.id,
          leadId: row.lead_id,
          role: row.role,
          content: row.content,
          tactic: row.tactic,
          situation: row.situation,
          programId: row.program_id,
          createdAt: row.created_at,
        }))
        .reverse();
    },
    async listLeads() {
      await ensure();
      const { results } = await d1.prepare("SELECT * FROM leads ORDER BY updated_at DESC LIMIT 50").all();
      return (results || []).map(rowToLead);
    },
    async policyFor(keys) {
      await ensure();
      if (!keys.length) return [];
      const marks = keys.map(() => "?").join(", ");
      const { results } = await d1
        .prepare(`SELECT * FROM policy WHERE key IN (${marks})`)
        .bind(...keys)
        .all();
      return (results || []).map((row) => ({
        key: row.key,
        tactic: row.tactic,
        programId: row.program_id || "",
        rewardSum: row.reward_sum,
        n: row.n,
      }));
    },
    async reinforce({ key, tactic, programId = "", reward }) {
      await ensure();
      await d1
        .prepare(
          `INSERT INTO policy (key, tactic, program_id, reward_sum, n) VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(key, tactic, program_id) DO UPDATE SET
             reward_sum = reward_sum + excluded.reward_sum,
             n = n + 1`,
        )
        .bind(key, tactic, programId || "", reward)
        .run();
    },
    async noteLesson({ pattern, lesson, reward }) {
      await ensure();
      const now = new Date().toISOString();
      await d1
        .prepare(
          `INSERT INTO lessons (pattern, lesson, weight, n, updated_at) VALUES (?, ?, ?, 1, ?)
           ON CONFLICT(pattern) DO UPDATE SET
             weight = ROUND((weight * 0.7 + excluded.weight * 0.3) * 100) / 100.0,
             n = n + 1,
             lesson = excluded.lesson,
             updated_at = excluded.updated_at`,
        )
        .bind(pattern, lesson, reward, now)
        .run();
    },
    async topLessons(limit = 6) {
      await ensure();
      const { results } = await d1
        .prepare("SELECT pattern, lesson, weight, n, updated_at FROM lessons ORDER BY weight DESC LIMIT ?")
        .bind(limit)
        .all();
      return (results || []).map((row) => ({
        pattern: row.pattern,
        lesson: row.lesson,
        weight: row.weight,
        n: row.n,
        updatedAt: row.updated_at,
      }));
    },
    async learningView() {
      await ensure();
      const tacticsResult = await d1
        .prepare(
          "SELECT key, tactic, reward_sum, n FROM policy WHERE tactic != 'program' ORDER BY (reward_sum * 1.0 / n) DESC LIMIT 12",
        )
        .all();
      const programsResult = await d1
        .prepare(
          "SELECT key, program_id, reward_sum, n FROM policy WHERE tactic = 'program' ORDER BY (reward_sum * 1.0 / n) DESC",
        )
        .all();
      const leadCount = await d1.prepare("SELECT COUNT(*) AS c FROM leads").first();
      const bookedCount = await d1.prepare("SELECT COUNT(*) AS c FROM leads WHERE status = 'booked'").first();
      return {
        lessons: await this.topLessons(8),
        tactics: (tacticsResult.results || []).map((row) => ({
          key: row.key,
          tactic: row.tactic,
          rewardSum: row.reward_sum,
          n: row.n,
          avg: row.n ? Math.round((row.reward_sum / row.n) * 100) / 100 : 0,
        })),
        programs: (programsResult.results || []).map((row) => ({
          key: row.key,
          programId: row.program_id,
          n: row.n,
          avg: row.n ? Math.round((row.reward_sum / row.n) * 100) / 100 : 0,
        })),
        leads: leadCount?.c || 0,
        booked: bookedCount?.c || 0,
      };
    },
  };
}
