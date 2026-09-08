# TEC — Weekly Accountability Platform

A full-stack web app that keeps the **TEC (Weekly Accountability Team)** on schedule. Members submit weekly goals, the platform tracks team progress on a live feed, and an automation layer on WhatsApp — with an AI Q&A assistant — handles reminders and announcements so the moderators don't have to.

**Live demo:** [tec-weekly-goals.web.app](https://tec-weekly-goals.web.app)

![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)

## Key features

**Members**
- Account registration & login with role-based access (member / moderator / admin)
- Weekly goals submission and personal progress dashboard
- Live feed of team activity

**Moderators & admins**
- Admin dashboard with team overview and stats
- Weekly deadline reminders and meeting reminders pushed to the team's WhatsApp
- Announcement broadcasts via WhatsApp
- Moderator auto-pinning of key items
- Weekly report workflow (report template included in the repo)

**Automation & AI**
- WhatsApp Cloud API (Meta) integration for all team notifications
- AI-powered WhatsApp Q&A engine built on Google Gemini — answers team questions directly, routes the ones it can't handle
- Cloudinary integration for media handling

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (react-router-dom, react-icons, react-signature-canvas) |
| Build tool | Vite |
| Language | JavaScript + TypeScript |
| Backend | Node.js on Firebase Cloud Functions |
| Database | Cloud Firestore (with security rules) |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting |
| Messaging | WhatsApp Cloud API (Meta) |
| AI | Google Gemini |
| Media | Cloudinary |
| Quality | ESLint |

## Architecture

- `src/` — the React SPA. Pages: `HomePage`, `Login`, `Register`, `ForgotPassword`, `Dashboard`, `AdminDashboard`, `ModeratorDashboard`, `LiveFeedPage`, `PendingPage`. Firebase client config and Cloudinary helper live here alongside shared components (`Navbar`, `ProductUI`) and utils.
- `functions/` — the serverless backend on Firebase Cloud Functions:
  - `automationService.js` — scheduled reminders, announcements, and moderator automation
  - `geminiEngine.js` — the Gemini-powered WhatsApp Q&A router
  - `metaService.js` — WhatsApp Cloud API messaging
- `firestore.rules` — Firestore security rules
- Static team tools (`TEC_Weekly_Goals_Form.html`, `TEC_Admin_Dashboard.html`) and the weekly report template

## Getting started

**Prerequisites:** Node.js + npm, a Firebase project, and API credentials for the WhatsApp Cloud API, Google Gemini, and Cloudinary.

```bash
git clone https://github.com/izyworld-a/TEC_WEBSITE.git
cd TEC_WEBSITE
npm install
cd functions && npm install
```

1. Point the app at your Firebase project (`.firebaserc` and `src/firebase.js`) and enable Authentication, Firestore, and Hosting.
2. Copy `functions/.env.example` to `functions/.env` and fill in your WhatsApp, Gemini, and Cloudinary credentials.
3. Run locally with `npm run dev` (Vite dev server), or deploy with `firebase deploy`.

## Author

**Israel Enweji** — Frontend Developer & UI Designer

- GitHub: [izyworld-a](https://github.com/izyworld-a)
- Email: Israelenwejii@gmail.com
