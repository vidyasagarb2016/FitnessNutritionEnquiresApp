export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    experience TEXT NOT NULL DEFAULT '',
    diet TEXT NOT NULL DEFAULT '',
    constraints TEXT NOT NULL DEFAULT '',
    consult_pref TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    safety_flag TEXT NOT NULL DEFAULT '',
    program_id TEXT NOT NULL DEFAULT '',
    home INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    turns INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_channel_external ON leads(channel, external_id)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tactic TEXT NOT NULL DEFAULT '',
    situation TEXT NOT NULL DEFAULT '',
    program_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS messages_lead ON messages(lead_id, id)`,
  `CREATE TABLE IF NOT EXISTS policy (
    key TEXT NOT NULL,
    tactic TEXT NOT NULL,
    program_id TEXT NOT NULL DEFAULT '',
    reward_sum REAL NOT NULL DEFAULT 0,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, tactic, program_id)
  )`,
  `CREATE TABLE IF NOT EXISTS lessons (
    pattern TEXT PRIMARY KEY,
    lesson TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    n INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
];
