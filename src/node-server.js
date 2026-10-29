import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./http.js";
import { createMemoryStore } from "./store.js";

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = join(root, "..", "data", "forma-desk.json");

function loadEnvFile(text, env) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) env[key] = value;
  }
  return env;
}

async function openStore() {
  const store = createMemoryStore();
  await mkdir(dirname(dataFile), { recursive: true });
  try {
    store.load(JSON.parse(await readFile(dataFile, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!store.hasPolicy()) {
    store.seed();
    await writeFile(dataFile, JSON.stringify(store.export()));
  }
  store.kind = "file";
  store.setPersist(async (snap) => {
    await writeFile(dataFile, JSON.stringify(snap));
  });
  return store;
}

const env = loadEnvFile(
  await readFile(join(root, "..", ".env"), "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  }),
  { ...process.env },
);
env.store = await openStore();

const port = Number(env.PORT || 8787);
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const name of ["content-type", "authorization", "x-twilio-signature", "x-forwarded-for"]) {
      if (req.headers[name]) headers.set(name, String(req.headers[name]));
    }
    const request = new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
    });
    const response = await handleRequest(request, env);
    const payload = Buffer.from(await response.arrayBuffer());
    const out = {};
    response.headers.forEach((value, key) => {
      out[key] = value;
    });
    res.writeHead(response.status, out);
    res.end(payload);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("The desk hit a problem.");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Forma Desk listening on http://localhost:${port}`);
});
