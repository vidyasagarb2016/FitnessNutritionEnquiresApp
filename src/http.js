import { handleTurn, openingLine, publicLead, recordOutcome } from "./agent.js";
import {
  metaInbound,
  sendMetaWhatsApp,
  signedUrl,
  twilioAuthorized,
  twilioParams,
  twimlMessage,
  twimlVoice,
  xml,
} from "./channels.js";
import { llmProvider } from "./llm.js";
import { renderPage } from "./page.js";
import { createD1Store, createMemoryStore } from "./store.js";

const buckets = new Map();
const seenMeta = new Set();
let memoryStore = null;

function sharedMemory() {
  if (!memoryStore) {
    memoryStore = createMemoryStore();
    memoryStore.seed();
  }
  return memoryStore;
}

function storeFor(env) {
  if (env.store) return env.store;
  if (env.DB) return createD1Store(env.DB);
  return sharedMemory();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function isAdmin(request, env) {
  return Boolean(env.ADMIN_TOKEN) && request.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

function limited(key, limit) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  return false;
}

function clientKey(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
}

export async function handleRequest(request, env = {}) {
  try {
    return await route(request, env);
  } catch (error) {
    console.error(error);
    return json({ error: "The desk hit a problem. Try again in a moment." }, 500);
  }
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const store = storeFor(env);

  if (request.method === "GET" && path === "/") {
    return new Response(renderPage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });
  }

  if (request.method === "GET" && path === "/api/health") {
    const learning = await store.learningView();
    return json({
      ok: true,
      service: "forma-desk",
      store: store.kind,
      llm: llmProvider(env) || "playbook",
      channels: ["web", "whatsapp", "voice"],
      leads: learning.leads,
      booked: learning.booked,
    });
  }

  if (request.method === "GET" && path === "/api/learning") {
    return json(await store.learningView());
  }

  if (request.method === "GET" && path === "/api/leads") {
    if (!isAdmin(request, env)) return json({ error: "Desk key required." }, 401);
    const leads = await store.listLeads();
    return json({ leads: leads.map((lead) => publicLead(lead, { revealPhone: true })) });
  }

  if (request.method === "POST" && path === "/api/outcome") {
    if (!isAdmin(request, env)) return json({ error: "Desk key required." }, 401);
    const body = await request.json().catch(() => null);
    if (!body || !["booked", "lost"].includes(body.outcome)) return json({ error: "Outcome must be booked or lost." }, 400);
    const lead = await recordOutcome(store, body.id, body.outcome);
    if (!lead) return json({ error: "Enquiry not found." }, 404);
    return json({ lead, learning: await store.learningView() });
  }

  if (request.method === "POST" && path === "/api/chat") {
    const body = await request.json().catch(() => null);
    const message = String(body?.message || "").trim();
    const sessionId = String(body?.sessionId || "");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(sessionId)) return json({ error: "Session id is invalid." }, 400);
    if (!message) return json({ error: "Message is empty." }, 400);
    if (message.length > 2000) return json({ error: "Message is too long." }, 400);
    const limit = Number(env.RATE_LIMIT_PER_MIN || 40);
    if (limited(`${clientKey(request)}:${sessionId}`, limit)) return json({ error: "Too many messages. Wait a minute." }, 429);
    const channel = body.channel === "voice" ? "voice" : "web";
    const result = await handleTurn(store, env, { channel, externalId: sessionId, text: message });
    return json({
      reply: result.reply,
      lead: result.lead,
      actions: result.actions,
      mode: result.mode,
      tactic: result.tactic,
      approach: result.approach,
      program: result.program,
      learning: result.learning,
    });
  }

  if (request.method === "POST" && path === "/webhooks/twilio/whatsapp") {
    const params = await twilioParams(request);
    if (!(await twilioAuthorized(request, env, params))) return json({ error: "Invalid Twilio signature." }, 403);
    const from = params.From || "";
    const text = (params.Body || "").trim();
    if (!from) return json({ error: "Missing sender." }, 400);
    const result = text
      ? await handleTurn(store, env, { channel: "whatsapp", externalId: from, text, phoneHint: from })
      : { reply: openingLine() };
    return xml(twimlMessage(result.reply));
  }

  if (request.method === "POST" && path === "/webhooks/twilio/voice") {
    const params = await twilioParams(request);
    if (!(await twilioAuthorized(request, env, params))) return json({ error: "Invalid Twilio signature." }, 403);
    const callSid = params.CallSid || "";
    if (!callSid) return json({ error: "Missing CallSid." }, 400);
    const speech = (params.SpeechResult || params.TranscriptionText || "").trim();
    const action = signedUrl(request, env);
    if (!speech) return xml(twimlVoice({ reply: openingLine(), action, done: false }));
    const result = await handleTurn(store, env, {
      channel: "voice",
      externalId: callSid,
      text: speech,
      phoneHint: params.From || params.Caller || "",
    });
    return xml(twimlVoice({ reply: result.reply, action, done: result.tactic === "confirm" || result.tactic === "close_kindly" || result.tactic === "safety_redirect" }));
  }

  if (path === "/webhooks/meta/whatsapp" && request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && env.META_VERIFY_TOKEN && token === env.META_VERIFY_TOKEN) {
      return new Response(challenge, { headers: { "content-type": "text/plain" } });
    }
    return json({ error: "Verification failed." }, 403);
  }

  if (path === "/webhooks/meta/whatsapp" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    for (const message of metaInbound(body)) {
      if (message.id && seenMeta.has(message.id)) continue;
      if (message.id) {
        seenMeta.add(message.id);
        if (seenMeta.size > 500) seenMeta.clear();
      }
      const result = await handleTurn(store, env, {
        channel: "whatsapp",
        externalId: message.from,
        text: message.text,
        phoneHint: message.from,
      });
      await sendMetaWhatsApp(env, message.from, result.reply);
    }
    return json({ ok: true });
  }

  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}
