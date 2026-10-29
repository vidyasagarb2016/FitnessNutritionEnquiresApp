export function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function twimlMessage(reply) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(reply)}</Message></Response>`;
}

export function twimlVoice({ reply, action, done }) {
  const say = xmlEscape(reply);
  if (done) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${say}</Say><Hangup/></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="${xmlEscape(action)}" method="POST" speechTimeout="auto" language="en-US"><Say>${say}</Say></Gather><Say>I didn't catch that. Tell me the goal in a few words.</Say></Response>`;
}

export function xml(body) {
  return new Response(body, {
    headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function twilioParams(request) {
  const form = await request.formData();
  const params = {};
  for (const [key, value] of form.entries()) params[key] = String(value);
  return params;
}

export async function twilioSignature(secret, url, params) {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(signed);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function signaturesMatch(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function signedUrl(request, env) {
  const url = new URL(request.url);
  const path = `${url.pathname}${url.search}`;
  if (env.PUBLIC_BASE_URL) return `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}${path}`;
  return `${url.origin}${path}`;
}

export async function twilioAuthorized(request, env, params) {
  if (!env.TWILIO_AUTH_TOKEN) return true;
  const header = request.headers.get("x-twilio-signature") || "";
  const expected = await twilioSignature(env.TWILIO_AUTH_TOKEN, signedUrl(request, env), params);
  return signaturesMatch(header, expected);
}

export function metaInbound(body) {
  const found = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const text = message.text?.body || message.button?.text || "";
        if (message.from && text) found.push({ from: String(message.from), text, id: message.id || "" });
      }
    }
  }
  return found;
}

export async function sendMetaWhatsApp(env, to, body) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return false;
  const response = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  return response.ok;
}
