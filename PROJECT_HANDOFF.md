# Priority Manager Handoff

## Product Direction

The app is an intelligent, adaptive priority manager for people juggling competitions, school/work, chores, deadlines, and life admin. The core idea is not to build another heavy Notion-style workspace. The product should let the user dump messy tasks quickly, keep a normal reminders/deadlines interface, and provide a calm recommendation for what to do next.

The AI layer should not dominate the product. It should help parse messy input, clarify vague tasks, split work into smaller actions, and phrase recommendations with empathy. Deterministic code should own scoring, ranking, deadlines, and adaptation so the app remains inspectable and trustworthy.

## Build Phases

1. Usable core: task CRUD, deadlines, categories, status, scoring, `Now / Tasks / Deadlines`, Supabase persistence.
2. Brain dump: manual parsing with `chrono-node`, suggested tasks, accept/edit/reject.
3. Priority engine: deadline pressure, effort, energy, risk, and recommendation explanation.
4. Feedback and adaptation: record user actions like done, snooze, too tired, too hard, not now, split; adjust recommendations from patterns.
5. Groq AI layer: optional structured parsing and task cleanup through API.
6. Notifications: reminders, email, Discord, Slack, WhatsApp later through official/provider API.
7. Auth and RLS: Supabase Auth, user-owned rows, policies, channel settings.

## Current Implementation

The project is a Next.js + TypeScript + Tailwind app in this folder. Supabase is optional: if `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, task storage falls back to browser local storage.

Implemented so far:

- Manual task creation and inline editing.
- `Now`, `Tasks`, and `Deadlines` views.
- Manual brain dump parsing with `chrono-node`.
- Priority scoring and recommendation.
- Supabase schema with `tasks`, `task_events`, `reminders`, and `notification_channels`.
- Task event storage and adaptation foundations.
- Optional Groq parsing route at `/api/parse-brain-dump`.
- Settings tab for notification channels.
- Discord and Slack webhook test route at `/api/notifications/test`.
- Email and WhatsApp channel storage, with provider sending still to be implemented.
- Supabase Auth panel.
- RLS policies and auth profile trigger in `supabase/schema.sql`.
- Reminder panel with due/upcoming reminders and local/Supabase storage.
- Manual reminder dispatch from the Reminders tab.
- Scheduled reminder dispatch endpoint at `/api/reminders/dispatch`.
- Discord and Slack reminder delivery implemented.
- Email delivery implemented through Resend with `RESEND_API_KEY` and `EMAIL_FROM`.
- WhatsApp remains a provider-backed next step.

## Commands

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

PowerShell blocks `npm.ps1` on this machine, so use `npm.cmd`.

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

## Notes

The parent Desktop directory appears to be a git repo with many unrelated changes outside this project. Do not revert or touch those files. Keep changes scoped to `C:\Users\LENOVO\Desktop\codex prirotiyr`.
