# TEC Weekly Engine

The live WhatsApp backend that powers TEC Weekly (The Execution Circle). These are Deno
functions deployed on Base44 backend hosting — they are NOT part of the Firebase
Cloud Functions in `/functions`. This folder is a source-of-truth backup.

## Files

| File | What it does |
|---|---|
| `tecWhatsAppWebhook.ts` | Meta WhatsApp Cloud API webhook: verifies signatures, links member accounts via email-to-WhatsApp flow, stores messages/proofs, uploads image proofs to Cloudinary, answers Q&A (goals, wallet, points, leaderboard, deadlines, moderator role) and supports `complete task N` updates via chat, and falls back to a Gemini "Execution Circle Facilitator" reply. |
| `tecGoalReminders.ts` | Scheduled (Wed/Sat 7:00 AM Lagos) check-ins: reads Firestore goals, sends accountability nudges and daily streak alerts to opted-in members. |
| `tecNotifyEvent.ts` | Admin-triggered notifications: moderator assignment pings and meeting reminders broadcast to all opted-in members (Cloud API cannot post into group chats, so "group" reminders go out as individual 1:1 messages). |

## Live endpoints (Base44)

- `https://velo-af3ea2dd.base44.app/functions/tecWhatsAppWebhook` — Meta webhook (GET handshake, POST events)
- `https://velo-af3ea2dd.base44.app/functions/tecNotifyEvent` — called from the Admin Dashboard
- `tecGoalReminders` — invoked by the "TEC Goal Reminders" workflow (cron `0 7 * * 3,6`, Africa/Lagos)

## Environment variables (set in Base44 secrets)

`META_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, `GEMINI_API_KEY`,
`CLOUDINARY_API_SECRET`, `FIREBASE_PRIVATE_KEY` (+ `_2`…`_24` fragments) — service
account: `firebase-adminsdk-fbsvc@tec-weekly-goals.iam.gserviceaccount.com`.

Production WhatsApp number: **+234 902 667 5879** (Phone Number ID `1329337346933318`).
