# Forma Desk

Self-learning enquiry agent for a fitness and nutrition desk. It qualifies leads on a web chat, a phone-style call, WhatsApp (Twilio or Meta), and books a free intro. It is not a doctor or a dietitian, and it will not coach anyone under 18 or give a crash diet.

The host is **Cloudflare Workers + D1** on the Workers Free plan: $0, no card, and the webhook stays awake. Railway’s free credit is about $1 a month and will not keep a call webhook up. Render’s free web service sleeps after 15 minutes, so WhatsApp times out. GitHub Actions can run a job, but it cannot answer a phone webhook.

The model is optional. With no API key the desk still answers from its playbook. Add a GitHub Models token from this same GitHub account, or a free Groq or Gemini key, and it only rephrases the reply the playbook already chose.

## How it learns

Every reply is an approach: ask for the goal, recommend a program, lead with the free intro, and so on. The next message is the score.

- A goal, a number, or a booking scores that approach up.
- A stall, a correction, or “not interested” scores it down.
- The next similar enquiry uses the higher average. About 8% of the time it still tries a weaker approach so a new one can win.
- Marking an enquiry booked or lost from the desk updates the same scores.
- Lessons are rewritten from those results and shown on the desk. They are coach notes, not medical advice.

Programs start from a small prior (plant-based fat loss when someone eats vegetarian, free-intro language when someone asks about price). Live enquiries replace that prior when the data disagrees.

## Run locally

```bash
npm test
npm start
```

Open http://localhost:8787. Copy `.env.example` to `.env` if you want a model or a desk key.

`ADMIN_TOKEN` unlocks full phone numbers and the booked/lost buttons. Leave it unset on a public URL only if you have not taken real enquiries yet. Set it before you do.

Learning is stored in `data/forma-desk.json`.

## Deploy from GitHub

The cheapest place this stays online is your Cloudflare account, connected with GitHub:

```bash
npx wrangler login
npm run deploy
```

`wrangler login` can use **Continue with GitHub** and the account already signed in here (`vidyasagarb2016`). `npm run deploy` creates the free D1 database `forma-desk` if needed, writes its id into `wrangler.toml`, and publishes the Worker.

For later pushes, add these GitHub Actions secrets and run the **Deploy** workflow:

- `CLOUDFLARE_API_TOKEN` — Workers Scripts edit, D1 edit, account read
- `CLOUDFLARE_ACCOUNT_ID`

Then set secrets the Worker can read:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put GITHUB_MODELS_TOKEN
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put PUBLIC_BASE_URL
```

`PUBLIC_BASE_URL` is the `https://forma-desk.<account>.workers.dev` URL, with no trailing slash. Twilio signature checks need it.

## WhatsApp and phone

Twilio’s trial sandbox is the cheapest way to attach a real WhatsApp thread and a phone number. The platform fee is whatever Twilio charges per message or minute. The agent host stays $0.

| Channel | Webhook |
| --- | --- |
| WhatsApp via Twilio | `POST /webhooks/twilio/whatsapp` |
| Phone via Twilio | `POST /webhooks/twilio/voice` |
| WhatsApp Cloud API | `GET` and `POST /webhooks/meta/whatsapp` |

Set the voice webhook to HTTP POST. The call uses speech gather, speaks the desk’s reply, and hangs up once an intro is booked or the caller should be referred out.

Meta also needs `META_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID`.

## Safety

The desk collects an enquiry and books a human intro. It refuses under-18 training and nutrition, medical conditions, and rapid cuts. Injury words are noted for the coach and are not treated as a diagnosis.
