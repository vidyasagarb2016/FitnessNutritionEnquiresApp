import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleTurn } from "../src/agent.js";
import { twilioSignature } from "../src/channels.js";
import { handleRequest } from "../src/http.js";
import { createMemoryStore } from "../src/store.js";

function desk(seed = true) {
  const store = createMemoryStore();
  if (seed) store.seed();
  return store;
}

const env = { LEARN_EPSILON: "0" };

async function say(store, externalId, text, channel = "web") {
  return handleTurn(store, env, { channel, externalId, text, phoneHint: channel === "whatsapp" ? externalId : "" });
}

test("qualifies a vegetarian fat-loss enquiry and books the intro", async () => {
  const store = desk();
  const id = "lead-riya";
  const first = await say(store, id, "I want to lose fat. I have never trained and I am vegetarian.");
  assert.match(first.reply, /Plant-Based Fat Loss/);
  assert.equal(first.lead.status, "qualifying");
  assert.equal(first.tactic, "ask_name");

  const named = await say(store, id, "My name is Riya");
  assert.match(named.reply, /phone number/i);
  assert.equal(named.lead.name, "Riya");

  const numbered = await say(store, id, "My number is +91 98765 43210");
  assert.match(numbered.reply, /morning or a weekday evening/i);
  assert.match(numbered.lead.phone, /3210/);
  assert.doesNotMatch(numbered.lead.phone, /98765/);

  const booked = await say(store, id, "Weekday morning, please book it");
  assert.equal(booked.tactic, "confirm");
  assert.equal(booked.lead.status, "booked");
  assert.match(booked.reply, /weekday morning/);
  assert.ok(booked.actions.includes("book_consult"));
  assert.ok(booked.learning.tactics.some((row) => row.tactic === "book" && row.n >= 1));
});

test("learned price framing prefers the free intro until a better approach wins", async () => {
  const seeded = await say(desk(), "price-a", "I want fat loss but it is too expensive");
  assert.equal(seeded.tactic, "price_value");
  assert.match(seeded.reply, /intro call is free/i);

  const store = desk(false);
  await store.reinforce({ key: "fat_loss:price", tactic: "price_defer", reward: 5 });
  await store.reinforce({ key: "fat_loss:price", tactic: "price_value", reward: 0.2 });
  const learned = await say(store, "price-b", "I want fat loss but coaching is too expensive");
  assert.equal(learned.tactic, "price_defer");
  assert.match(learned.reply, /doesn't quote a number/i);
});

test("refuses plans for minors and crash cuts", async () => {
  const minor = await say(desk(), "minor", "I am 15 and I want to lose weight");
  assert.equal(minor.tactic, "safety_redirect");
  assert.match(minor.reply, /under 18/);
  assert.doesNotMatch(minor.reply, /Plant-Based|sessions a week|kcal/);

  const crash = await say(desk(), "crash", "Help me lose 10kg in a week");
  assert.equal(crash.tactic, "safety_redirect");
  assert.match(crash.reply, /crash diet|rapid cut/i);
  assert.doesNotMatch(crash.reply, /kcal/);
});

test("twilio signature matches the documented HMAC", async () => {
  const url = "https://desk.example/webhooks/twilio/whatsapp";
  const params = { Body: "hi", From: "whatsapp:+15551212000" };
  const payload = `${url}BodyhiFromwhatsapp:+15551212000`;
  const expected = createHmac("sha1", "token").update(payload).digest("base64");
  assert.equal(await twilioSignature("token", url, params), expected);
});

test("whatsapp and voice webhooks answer, and a bad signature is refused", async () => {
  const store = desk();
  const url = "http://localhost/webhooks/twilio/whatsapp";
  const params = { Body: "I want to lose fat and I am vegetarian. My name is Riya. Weekday morning, please book it.", From: "whatsapp:+15551212000" };
  const good = await twilioSignature("token", url, params);
  const denied = await handleRequest(
    new Request(url, { method: "POST", body: new URLSearchParams(params), headers: { "x-twilio-signature": "nope" } }),
    { ...env, store, TWILIO_AUTH_TOKEN: "token" },
  );
  assert.equal(denied.status, 403);

  const accepted = await handleRequest(
    new Request(url, { method: "POST", body: new URLSearchParams(params), headers: { "x-twilio-signature": good } }),
    { ...env, store, TWILIO_AUTH_TOKEN: "token" },
  );
  assert.equal(accepted.status, 200);
  const xml = await accepted.text();
  assert.match(xml, /<Message>/);
  assert.match(xml, /weekday morning/);

  const voiceUrl = "http://localhost/webhooks/twilio/voice";
  const silent = await handleRequest(
    new Request(voiceUrl, { method: "POST", body: new URLSearchParams({ CallSid: "CA123", From: "+14155550100" }) }),
    { ...env, store },
  );
  assert.match(await silent.text(), /<Gather/);
  assert.equal(await store.findLead("voice", "CA123"), null);

  const spoken = await handleRequest(
    new Request(voiceUrl, {
      method: "POST",
      body: new URLSearchParams({
        CallSid: "CA123",
        From: "+14155550100",
        SpeechResult: "I want to get stronger and I have never trained",
      }),
    }),
    { ...env, store },
  );
  const voiceXml = await spoken.text();
  assert.match(voiceXml, /stronger/i);
  const call = await store.findLead("voice", "CA123");
  assert.equal(call.phone, "+14155550100");
});

test("desk key gates lead details and outcome learning", async () => {
  const store = desk();
  const token = "desk-demo";
  const chat = await handleRequest(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-demo-1",
        message: "I want to lose fat. I have never trained and I am vegetarian.",
      }),
    }),
    { ...env, store, ADMIN_TOKEN: token },
  );
  const body = await chat.json();
  assert.equal(chat.status, 200);
  assert.match(body.reply, /Plant-Based Fat Loss/);

  const locked = await handleRequest(new Request("http://localhost/api/leads"), { ...env, store, ADMIN_TOKEN: token });
  assert.equal(locked.status, 401);

  const open = await handleRequest(new Request("http://localhost/api/leads"), {
    ...env,
    store,
    ADMIN_TOKEN: token,
    headers: undefined,
  });
  assert.equal(open.status, 401);

  const unlocked = await handleRequest(
    new Request("http://localhost/api/leads", { headers: { authorization: `Bearer ${token}` } }),
    { ...env, store, ADMIN_TOKEN: token },
  );
  const leads = await unlocked.json();
  assert.equal(leads.leads.length, 1);
  assert.equal(leads.leads[0].name, "");

  const outcome = await handleRequest(
    new Request("http://localhost/api/outcome", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id: body.lead.id, outcome: "booked" }),
    }),
    { ...env, store, ADMIN_TOKEN: token },
  );
  const saved = await outcome.json();
  assert.equal(outcome.status, 200);
  assert.equal(saved.lead.status, "booked");
  assert.ok(saved.learning.booked >= 1);

  const home = await handleRequest(new Request("http://localhost/"), { ...env, store });
  assert.match(await home.text(), /Forma Desk/);

  const health = await handleRequest(new Request("http://localhost/api/health"), { ...env, store });
  const status = await health.json();
  assert.equal(status.ok, true);
  assert.equal(status.llm, "playbook");
});
