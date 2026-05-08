# Priority Manager

An adaptive task and deadline manager. The first version keeps AI optional: manual task CRUD, deadline views, a local priority engine, and a simple brain dump parser work without API keys.

## Run

```bash
npm install
npm run dev
```

If Supabase env vars are missing, the app falls back to browser local storage.

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor, then add:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The schema enables RLS and adds Auth-owned policies. Local fallback still works when Supabase env vars are absent.

## Optional Groq Parsing

Set `GROQ_API_KEY` and use the brain dump "Clean up with AI" action. If Groq is unavailable, the app falls back to the manual parser.

## Notifications

The Settings tab stores notification channels. Discord and Slack webhook test sends are wired through `/api/notifications/test`. Email delivery uses Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured. WhatsApp is stored as a channel for the next provider integration step.

Due reminders can be sent manually from the Reminders tab. For scheduled dispatch, call:

```bash
POST /api/reminders/dispatch
Authorization: Bearer <CRON_SECRET>
```

Scheduled dispatch requires `SUPABASE_SERVICE_ROLE_KEY` so the server can read due reminders across users while RLS stays enabled.
