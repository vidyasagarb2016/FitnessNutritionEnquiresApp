import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const tomlPath = new URL("../wrangler.toml", import.meta.url);

function run(wranglerArgs, capture = false) {
  return spawnSync("npx", ["--yes", "wrangler@4", ...wranglerArgs], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
}

const who = run(["whoami"], true);
if (who.status !== 0) {
  const detail = `${who.stdout || ""}\n${who.stderr || ""}`.trim();
  console.error(detail || "Cloudflare login failed.");
  console.error("\nSign in once with: npx wrangler login");
  console.error("That uses the GitHub account already on this machine if you choose GitHub on the Cloudflare page.");
  console.error("Then run: npm run deploy");
  process.exit(1);
}
process.stdout.write(who.stdout || "");

const listed = run(["d1", "list", "--json"], true);
if (listed.status !== 0) {
  console.error(listed.stderr || listed.stdout || "Could not list D1 databases.");
  process.exit(listed.status || 1);
}

let databases = [];
const raw = `${listed.stdout || ""}`;
const start = raw.indexOf("[");
const end = raw.lastIndexOf("]");
if (start !== -1 && end !== -1) {
  databases = JSON.parse(raw.slice(start, end + 1));
}

let databaseId = databases.find((db) => db.name === "forma-desk")?.uuid;
if (!databaseId) {
  const created = run(["d1", "create", "forma-desk"], true);
  const combined = `${created.stdout || ""}\n${created.stderr || ""}`;
  if (created.status !== 0 && !/already exists/i.test(combined)) {
    console.error(combined);
    process.exit(created.status || 1);
  }
  const match = combined.match(/database_id\s*=\s*"([^"]+)"/);
  if (match) databaseId = match[1];
  if (!databaseId) {
    const again = run(["d1", "list", "--json"], true);
    const body = `${again.stdout || ""}`;
    const left = body.indexOf("[");
    const right = body.lastIndexOf("]");
    const rows = left === -1 ? [] : JSON.parse(body.slice(left, right + 1));
    databaseId = rows.find((db) => db.name === "forma-desk")?.uuid;
  }
}

if (!databaseId) {
  console.error("Cloudflare did not return a D1 database id for forma-desk.");
  process.exit(1);
}

const toml = readFileSync(tomlPath, "utf8").replace(/database_id = "[^"]*"/, `database_id = "${databaseId}"`);
writeFileSync(tomlPath, toml);
console.log(`Using D1 database ${databaseId}`);

const deployed = run(["deploy", ...args]);
process.exit(deployed.status || 0);
