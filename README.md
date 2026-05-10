# SAP Integration Testing Tracker

> **Salescode.ai** — Internal tracking tool for SAP Van Sales integration testing at CCBCSA (Coca-Cola South Africa)

🔗 **Live app**: https://sap-tracker-mocha.vercel.app

---

## Overview

A single-page web application for managing and tracking SAP integration testing progress. Built for the CCBCSA Van Sales implementation project, it covers test session tracking, API integration status, and DQR signoff management.

---

## Features

| Module | Description |
|--------|-------------|
| **Testing Data** | Full CRUD table of test entries with filtering, sorting, bulk actions, and inline editing |
| **Tracker** | Ring-chart summary per Testing Set with worst-case status rollup and Excel export |
| **Analytics** | Charts and a session calendar with status-coloured chips and click-to-expand day detail |
| **Integration** | SAP↔Salescode API readiness tracker with status pills and Excel export |
| **Signoff** | 14-column DQR signoff table with clickable/editable DQR links |
| **Settings** | Team role management, access request approval, and data reset (admin only) |

---

## Tech Stack

- **Frontend**: Pure vanilla HTML/CSS/JS — zero build step, single `index.html` file
- **Auth**: [Clerk](https://clerk.com) v5 — Google OAuth
- **Database**: Firebase Realtime Database (Spark free plan) — syncs data across all browsers/devices
- **Charts**: Chart.js (CDN)
- **Excel export**: SheetJS (CDN)
- **Hosting**: Vercel (static)

---

## Architecture

```
index.html          ← entire app (HTML + CSS + JS, ~3600 lines)
vercel.json         ← static deployment config
memory/
  sap_tracker_project.md  ← full project memory (updated with every dev change)
```

### Data flow
1. On load → Firebase Realtime Database is queried for all project data
2. Every save → written to Firebase (primary) + `localStorage` (local cache)
3. First-time users → migration from `localStorage` legacy keys to Firebase runs once

### Firebase structure
```
/config              → team roles (emailRoles map)
/projects            → project list
/data/{pid}          → test rows for project
/integration/{pid}   → integration tracker rows
/signoff/{pid}       → signoff rows
/requests            → pending access requests
```

---

## Authentication & Roles

| Role | Permissions |
|------|-------------|
| **admin** | Full access: add, edit, delete, settings, bulk actions |
| **editor** | Add, edit, delete, bulk actions (no Settings) |
| **viewer** | Read-only |

- Login via Google OAuth (Clerk)
- Unknown users see an "Access Required" screen with a mailto link to request access
- Admins approve/deny requests from Settings → Access Requests

---

## Deployment

```bash
# Deploy to Vercel production
/opt/homebrew/bin/vercel deploy --prod --token <vercel_token> --yes
```

**After any code change:**
1. Deploy to Vercel
2. Push to GitHub: `git add . && git commit -m "..." && git push`
3. Update `memory/sap_tracker_project.md` with the change details

---

## Development Notes

- **No build step** — edit `index.html` directly and deploy
- **Firebase SDK**: compat v10.12.2 (`firebase-app-compat.js` + `firebase-database-compat.js`) loaded from `gstatic.com`
- **Clerk v5**: pre-initialized instance (not a class) — use `window.Clerk.load()`, never `new window.Clerk(pk)`
- **localStorage keys**: `sap_data_v6` (legacy), `sap_integ_v3` (legacy); current keys are `sap_data_{pid}`, `sap_integ_{pid}`, etc.

---

## Project Status

Active — Van Sales implementation testing in progress for CCBCSA.
