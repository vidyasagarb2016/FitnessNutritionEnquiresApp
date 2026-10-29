import { openingLine } from "./knowledge.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderPage() {
  const opening = escapeHtml(openingLine());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Forma Desk</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%231d5c45' width='32' height='32' rx='6'/%3E%3Ctext x='16' y='22' text-anchor='middle' fill='%23f3ecdf' font-size='14' font-family='Georgia'%3EFd%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f3ecdf;
      --ink: #241c16;
      --muted: #6d6256;
      --line: #e0d3c2;
      --card: #fffaf3;
      --green: #1d5c45;
      --green-2: #e5f2eb;
      --clay: #c4622d;
      --shadow: 0 18px 50px rgba(36, 28, 22, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(900px 420px at 100% -10%, #f7d7c4 0%, transparent 55%),
        var(--bg);
      font-family: Outfit, "Segoe UI", sans-serif;
    }
    header, main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: end; padding: 28px 0 18px; }
    .mark { display: flex; gap: 12px; align-items: center; }
    .badge { width: 42px; height: 42px; border-radius: 10px; background: var(--green); color: #f3ecdf; display: grid; place-items: center; font-family: Fraunces, Georgia, serif; }
    h1 { font-family: Fraunces, Georgia, serif; font-size: 2rem; line-height: 1; margin: 0; font-weight: 560; }
    .sub { margin: 4px 0 0; color: var(--muted); }
    .status { font-size: 0.92rem; color: var(--muted); text-align: right; }
    main { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 18px; padding-bottom: 40px; }
    section { background: var(--card); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
    .panel { padding: 18px; }
    h2 { font-family: Fraunces, Georgia, serif; font-size: 1.35rem; margin: 0 0 8px; font-weight: 560; }
    .hint { color: var(--muted); margin: 0 0 12px; }
    .log { min-height: 280px; max-height: 460px; overflow: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
    .bubble { max-width: 92%; padding: 10px 12px; border-radius: 14px; white-space: pre-wrap; }
    .bubble.user { align-self: end; background: var(--green); color: #f6fbf8; border-bottom-right-radius: 4px; }
    .bubble.agent { align-self: start; background: var(--green-2); border-bottom-left-radius: 4px; }
    .approach { display: block; margin-top: 6px; color: var(--muted); font-size: 0.78rem; }
    .bubble.user .approach { color: #d7efe4; }
    form, .call-box { display: flex; gap: 8px; margin-top: 12px; }
    input, button { font: inherit; }
    input[type="text"], input[type="password"] {
      flex: 1; border: 1px solid var(--line); background: #fff; color: var(--ink);
      border-radius: 12px; padding: 12px 14px;
    }
    button {
      border: 0; border-radius: 12px; padding: 12px 14px; background: var(--clay); color: white; font-weight: 600; cursor: pointer;
    }
    button.quiet { background: transparent; color: var(--green); border: 1px solid var(--green); }
    button:disabled { opacity: 0.55; cursor: wait; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
    .chips button { background: transparent; color: var(--ink); border: 1px solid var(--line); font-weight: 500; padding: 8px 10px; }
    .call { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    li { padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    li span, .meta { display: block; color: var(--muted); font-size: 0.82rem; margin-top: 4px; }
    .bar { height: 6px; border-radius: 99px; background: #efe4d4; margin-top: 6px; }
    .bar i { display: block; height: 100%; border-radius: inherit; background: var(--green); }
    .lead-actions { display: flex; gap: 8px; margin-top: 8px; }
    .lead-actions button { padding: 6px 8px; font-size: 0.78rem; }
    .error { color: #8d2d1f; min-height: 1.2em; }
    @media (max-width: 860px) {
      header, main { width: min(100% - 20px, 1120px); }
      header, main { display: block; }
      .status { text-align: left; margin-top: 10px; }
      section + section { margin-top: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="mark">
      <div class="badge">Fd</div>
      <div>
        <h1>Forma Desk</h1>
        <p class="sub">Fitness and nutrition enquiries for leads, on the web, WhatsApp, or a phone call.</p>
      </div>
    </div>
    <p class="status" id="health">Checking the desk…</p>
  </header>
  <main>
    <section class="panel" aria-label="Enquiry">
      <h2>Talk to the desk</h2>
      <p class="hint">The reply is chosen from what similar enquiries did next. A useful reply scores up. A stall scores down.</p>
      <div class="log" id="chat" aria-live="polite">
        <div class="bubble agent">${opening}</div>
      </div>
      <form id="chat-form">
        <label class="hint" for="message" style="position:absolute;left:-999px">Your message</label>
        <input id="message" type="text" maxlength="2000" placeholder="Tell the desk your goal" autocomplete="off" required>
        <button type="submit">Send</button>
      </form>
      <div class="chips" id="chips"></div>
      <div class="call">
        <h2>Phone desk</h2>
        <p class="hint">Same agent as a Twilio call. Type what the caller says, or use the mic when this browser allows it. A real number points at <code>/webhooks/twilio/voice</code>.</p>
        <div class="log" id="call-log" aria-live="polite"></div>
        <form id="call-form" class="call-box">
          <label class="hint" for="caller" style="position:absolute;left:-999px">What the caller says</label>
          <input id="caller" type="text" maxlength="2000" placeholder="What the caller says" autocomplete="off">
          <button type="submit">Say it</button>
          <button type="button" class="quiet" id="mic">Mic</button>
        </form>
        <p class="error" id="mic-note"></p>
      </div>
    </section>
    <div>
      <section class="panel" aria-label="Playbook">
        <h2>What it has learned</h2>
        <p class="hint" id="learn-count"></p>
        <ul id="lessons"></ul>
        <h2 style="margin-top:18px">Approach scores</h2>
        <ul id="tactics"></ul>
      </section>
      <section class="panel" aria-label="Leads" style="margin-top:18px">
        <h2>Enquiries</h2>
        <p class="hint" id="lead-hint">Phone numbers stay hidden until the desk key is set. The key is the ADMIN_TOKEN on the server.</p>
        <form id="key-form">
          <label class="hint" for="desk-key" style="position:absolute;left:-999px">Desk key</label>
          <input id="desk-key" type="password" placeholder="Desk key" autocomplete="off">
          <button type="submit" class="quiet">Unlock</button>
        </form>
        <p class="error" id="lead-error"></p>
        <ul id="leads"></ul>
      </section>
    </div>
  </main>
  <script>
    const chatId = localStorage.getItem("forma-chat") || crypto.randomUUID();
    const callId = localStorage.getItem("forma-call") || crypto.randomUUID();
    localStorage.setItem("forma-chat", chatId);
    localStorage.setItem("forma-call", callId);
    const examples = [
      "I want to lose fat. I have never trained and I am vegetarian.",
      "How much does coaching cost?",
      "I want muscle but I have no time.",
      "My name is Riya and my number is +91 98765 43210. Weekday morning, please book it."
    ];
    const chips = document.querySelector("#chips");
    for (const example of examples) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = example.slice(0, 42) + "…";
      button.addEventListener("click", () => send(example, "web", chatId, false));
      chips.append(button);
    }

    function bubble(parent, role, text, approach) {
      const node = document.createElement("div");
      node.className = "bubble " + role;
      node.textContent = text;
      if (approach) {
        const note = document.createElement("span");
        note.className = "approach";
        note.textContent = approach;
        node.append(note);
      }
      parent.append(node);
      parent.scrollTop = parent.scrollHeight;
    }

    function renderLearning(data) {
      document.querySelector("#learn-count").textContent =
        data.leads + " enquiries · " + data.booked + " intros booked";
      const lessons = document.querySelector("#lessons");
      lessons.textContent = "";
      for (const lesson of data.lessons || []) {
        const item = document.createElement("li");
        item.textContent = lesson.lesson;
        const meta = document.createElement("span");
        meta.textContent = "weight " + lesson.weight + " · " + lesson.n + " notes";
        item.append(meta);
        lessons.append(item);
      }
      const tactics = document.querySelector("#tactics");
      tactics.textContent = "";
      const max = Math.max(1, ...(data.tactics || []).map((row) => Math.abs(row.avg)));
      for (const row of (data.tactics || []).slice(0, 6)) {
        const item = document.createElement("li");
        item.textContent = row.tactic + " · " + row.key;
        const meta = document.createElement("span");
        meta.textContent = "avg " + row.avg + " over " + row.n;
        const bar = document.createElement("div");
        bar.className = "bar";
        const fill = document.createElement("i");
        fill.style.width = Math.round((Math.abs(row.avg) / max) * 100) + "%";
        bar.append(fill);
        item.append(meta, bar);
        tactics.append(item);
      }
    }

    async function send(text, channel, sessionId, speakBack) {
      const parent = channel === "voice" ? document.querySelector("#call-log") : document.querySelector("#chat");
      bubble(parent, "user", text);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, channel, sessionId })
      });
      const data = await response.json();
      if (!response.ok) {
        bubble(parent, "agent", data.error || "The desk could not answer.");
        return;
      }
      bubble(parent, "agent", data.reply, data.approach || "");
      if (data.learning) renderLearning(data.learning);
      if (speakBack && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.reply));
      }
    }

    document.querySelector("#chat-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector("#message");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(text, "web", chatId, false);
    });
    document.querySelector("#call-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector("#caller");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(text, "voice", callId, true);
    });
    document.querySelector("#mic").addEventListener("click", () => {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const note = document.querySelector("#mic-note");
      if (!Rec) {
        note.textContent = "This browser has no speech recognition. Type the caller's words instead.";
        return;
      }
      const rec = new Rec();
      rec.lang = "en-US";
      rec.onresult = (event) => send(event.results[0][0].transcript, "voice", callId, true);
      rec.onerror = () => { note.textContent = "Mic did not start. Type the caller's words instead."; };
      note.textContent = "Listening…";
      rec.start();
    });

    function authHeader() {
      const key = sessionStorage.getItem("forma-key") || "";
      return key ? { authorization: "Bearer " + key } : {};
    }
    async function loadLeads() {
      const error = document.querySelector("#lead-error");
      const list = document.querySelector("#leads");
      const hint = document.querySelector("#lead-hint");
      const response = await fetch("/api/leads", { headers: authHeader() });
      const data = await response.json();
      if (!response.ok) {
        error.textContent = data.error || "Unlock the desk to see enquiries.";
        hint.textContent = "Phone numbers stay hidden until the desk key is set. The key is the ADMIN_TOKEN on the server.";
        list.textContent = "";
        return;
      }
      error.textContent = "";
      hint.textContent = "Numbers are visible because this desk key is unlocked in this tab.";
      list.textContent = "";
      for (const lead of data.leads) {
        const item = document.createElement("li");
        const copy = document.createElement("div");
        copy.textContent = (lead.name || "Unnamed") + " · " + (lead.goal || "goal open") + " · " + lead.status;
        const meta = document.createElement("span");
        meta.textContent = lead.channel + " · " + (lead.phone || "no number") + " · score " + lead.score;
        const actions = document.createElement("div");
        actions.className = "lead-actions";
        for (const outcome of ["booked", "lost"]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "quiet";
          button.textContent = outcome;
          button.addEventListener("click", async () => {
            const saved = await fetch("/api/outcome", {
              method: "POST",
              headers: { "content-type": "application/json", ...authHeader() },
              body: JSON.stringify({ id: lead.id, outcome })
            });
            const body = await saved.json();
            if (!saved.ok) error.textContent = body.error || "Could not update.";
            else {
              if (body.learning) renderLearning(body.learning);
              loadLeads();
            }
          });
          actions.append(button);
        }
        item.append(copy, meta, actions);
        list.append(item);
      }
      if (!data.leads.length) {
        const item = document.createElement("li");
        item.textContent = "No enquiries yet.";
        list.append(item);
      }
    }
    document.querySelector("#key-form").addEventListener("submit", (event) => {
      event.preventDefault();
      sessionStorage.setItem("forma-key", document.querySelector("#desk-key").value.trim());
      loadLeads();
    });
    fetch("/api/health").then((response) => response.json()).then((data) => {
      document.querySelector("#health").textContent =
        (data.store || "memory") + " store · " + (data.llm || "playbook");
    });
    fetch("/api/learning").then((response) => response.json()).then(renderLearning);
  </script>
</body>
</html>`;
}
