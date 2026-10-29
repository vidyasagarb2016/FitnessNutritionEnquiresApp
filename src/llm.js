const DEFAULTS = {
  github: "openai/gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
};

export function llmProvider(env) {
  if (env.GITHUB_MODELS_TOKEN) return "github-models";
  if (env.GROQ_API_KEY) return "groq";
  if (env.GEMINI_API_KEY) return "gemini";
  return "";
}

export async function phraseReply(env, brief) {
  const provider = llmProvider(env);
  if (!provider) return "";
  const messages = [
    {
      role: "system",
      content:
        "You write one short reply for a fitness and nutrition enquiry desk. You are not a doctor or dietitian. Never diagnose, never prescribe a calorie target, never encourage a crash diet, steroids, or a plan for anyone under 18. Do not invent prices. Return only the reply text, under 80 words. Keep every fact and the question you are given.",
    },
    {
      role: "user",
      content: JSON.stringify(brief),
    },
  ];
  const text = await complete(env, provider, messages);
  return sanitize(text, brief);
}

async function complete(env, provider, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    if (provider === "gemini") {
      const model = env.LLM_MODEL || DEFAULTS.gemini;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: messages
              .filter((message) => message.role !== "system")
              .map((message) => ({ role: "user", parts: [{ text: message.content }] })),
            systemInstruction: { parts: [{ text: messages[0].content }] },
          }),
        },
      );
      if (!response.ok) throw new Error(`Gemini ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join(" ") || "";
    }
    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://models.github.ai/inference/chat/completions";
    const key = provider === "groq" ? env.GROQ_API_KEY : env.GITHUB_MODELS_TOKEN;
    const model = env.LLM_MODEL || (provider === "groq" ? DEFAULTS.groq : DEFAULTS.github);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 220 }),
    });
    if (!response.ok) throw new Error(`${provider} ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

function sanitize(text, brief) {
  const cleaned = String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length > 700) return "";
  if (/\b(as an ai|language model)\b/i.test(cleaned)) return "";
  if (/\b\d{3,4}\s*(kcal|calories)\b/i.test(cleaned)) return "";
  if (/\b(starve|crash diet|anorexia)\b/i.test(cleaned)) return "";
  const question = brief.question || "";
  if (question && !cleaned.includes("?")) return "";
  return cleaned;
}
