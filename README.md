# Salescode.ai — SAP Integration Tracker

> A self-serve platform for running SAP integration projects end-to-end: track testing, map client APIs to Salescode fields **without writing transformers**, watch progress live from Jira, and hand off context in one click.

🔗 **Live app**: https://sap-tracker-mocha.vercel.app
🏢 First deployment: **CCBCSA** (Coca-Cola Saudi Arabia) — but the platform is **multi-project, multi-client** and reusable for any SAP integration engagement.

---

## What it does

Instead of a technical person hand-writing an enrichment/transformer for every client API, this platform lets an engineer point at an API (or its interface doc), auto-detect the fields and types, map them to Salescode fields, and verify the contract — all in the browser. Around that sits full project tracking and live Jira sign-off, so a delivery team can run a complete SAP integration without leaving the app.

---

## Projects Hub

A full-screen dashboard of project cards is the home view:

- Each card shows a **status dot**, the **client**, an **ACTIVE** badge, and **live stats** — entries, completed, linked epic — plus a **progress bar**.
- A **New Project** card starts onboarding.
- A **top-bar project switcher** lets you jump between projects at any time; admins can **create or delete** projects from there (deleting a project fully removes its data).

### New project onboarding

1. **Feature-tour carousel** — an animated walkthrough of the platform, including a looping cursor-tap demo that types a project name to show how creation works.
2. **Creation form** — name, client, description, Jira epic key, testing sessions, and a **start-from template** (Blank, SAP template, or copy the current project).

### Guided tour

**Help → guided tour** runs a 5-step spotlight coach-mark walkthrough of the main areas of the app.

---

## Modules

| Tab | Description |
|-----|-------------|
| **Testing Data** | CRUD table of test entries with filtering, sorting, bulk actions, and inline editing. Testing sessions (Testing 1, 2, 3…) are configurable per project. |
| **Tracker** | Ring-chart summary per testing set with worst-case status rollup and Excel export. |
| **Analytics** | Charts plus a session calendar with status-coloured chips and click-to-expand detail. |
| **Integration** | SAP↔Salescode API-readiness tracker with status pills and Excel export. |
| **SAP Masters** | **Live view of a Jira epic.** Each child story shows status, assignee, start/due dates, a child-work flag, and **automatic Dev/Tester sign-off**. One-click **create testing subtask**, **Run Digest**, and **Export project to Claude**. |
| **Mapping** | **The transformer console.** Pull API fields from a live endpoint or a `.docx` interface doc, auto-detect SQL types, mark Mandatory, map to Salescode fields, validate, **Test** the live contract, and **generate a Java transformer**. |
| **Settings** | Team access (grant by email + role), per-project config (epic key, testing sessions, master registry), read-only share link, Jira connection, and data reset (admin only). |

---

## SAP Masters & automatic sign-off (from Jira)

- Each project links to **one Jira epic** (configurable per project — new projects start unlinked and prompt for it).
- On open, the screen refetches the epic's child stories via JQL (`parent=<EPIC>`).
- Each child story shows **status, assignee, start date, due date**, and a **child-work flag** with an expandable subtask list.
- **Automatic sign-off** — no manual clicks:
  - **Dev sign-off** = the master story is Done/Closed.
  - **Tester sign-off** = the master's testing / QA-Sanity subtask is Done/Closed.
  - **Complete** = both. Intermediate states surface as *In Testing*, *In Dev*, or *Test N/A*.
- **Create testing subtask** — one click writes a Jira sub-task ("`<Master> Testing`"), auto-fills the required Jira fields (e.g. Complexity = 2), and writes a description: Business Requirement + QA-sanity instruction + a link to the parent master.
- **Run Digest** — an in-app modal summarising record counts, blocked/delayed items, overdue items, dev-done-awaiting-tester, and complete.
- **Export project to Claude** — bundles every master's full context (live Jira state, field mapping, testing history, integration timeline, sign-off) into a single Markdown handoff pack.

---

## Mapping / Transformer Console (the core feature)

A self-serve console that replaces hand-written transformers.

- **Drag-and-drop a `.docx` interface document** → parsed in-browser (mammoth) to extract the API URL, method, Basic-auth credentials, request body, and example response.
- **Or hit the live API** — URL + method + Basic auth + body → routed through the `/api/fetch` proxy (handles CORS + auth) → real response.
- **Auto type detection** — each field gets an SQL type (`varchar(255)`, `text`, `integer`, `bigint`, `decimal`, `boolean`, `date`, `datetime`, `json`) inferred from the response value.
- **Mapping grid** — columns are **Salescode Field · API Field · API Response (sample) · Type · Mandatory**; the SAP reference column is hideable. Full keyboard grid navigation plus row/field reorder (arrows and drag handle).
- **New-fields-only merge** — pulling again only adds fields you don't already have; your edits (type, mandatory, Salescode mapping) are preserved.
- **Validate** — checks each mapped API key against the keys captured on import.
- **Test** — re-hits the saved API and reports record count, mandatory fields returning no data, and type mismatches.
- **Create Transformer** — generates a Java `AbstractTransformer` per master directly from the mapping, recognising common conventions: `loginId`/`useraccountid`, email validation, mobile guard, `activeStatus` enum, `userParents`, `designation` Set, and `extendedAttributes.*` grouping.

---

## Multi-project

- Create projects from the **top-bar switcher** or the **Projects Hub** → feature-tour carousel → creation form (name, client, description, epic key, testing sessions, start-from template).
- Each project has its own data, integration, sign-off, mappings, **Jira epic key**, **testing sessions**, and **master registry**.
- A **SAP template** seeds a fresh project with the standard masters/transactions across integration, sign-off, and registry.
- **Admins** can delete a project (trash icon in the switcher) — fully removes its Firebase data.

---

## Roles

| Role | Permissions |
|------|-------------|
| **admin** | Everything: settings, team access, create/delete projects, bulk actions |
| **editor** | Add / edit / delete entries, bulk actions, pull & map APIs, create transformers |
| **viewer** | Read-only |

Grant access in **Settings → Team Access**: enter a Google email, pick a role, Save → that user signs in with Google. A **read-only share link** (`?share=<project>`) opens the app in locked viewer mode with no sign-in.

---

## Tech stack

- **Frontend**: vanilla HTML/CSS/JS — no build step, single `index.html`.
- **Auth**: Firebase Authentication (Google sign-in). Access is role-gated by email.
- **Database**: Firebase Realtime Database — syncs across devices.
- **Serverless** (Vercel functions):
  - `api/jira.js` — Jira proxy (issue / JQL / createmeta GET, plus issue creation POST).
  - `api/fetch.js` — generic API proxy for the mapping console.
- **Libraries (CDN)**: Chart.js, SheetJS, mammoth (docx parsing).
- **Hosting**: Vercel (static + functions).

### 2026 engineering practices

- **Accessibility** — WCAG-aligned focus states, `prefers-reduced-motion` support, and proper dialog roles.
- **Secret hygiene** — no secrets, tokens, or API keys committed to the repo.
- **Performance** — conditional and lazy rendering of heavy panels.

---

## Architecture

```
index.html        ← entire frontend (HTML + CSS + JS)
api/jira.js       ← Jira REST proxy (CORS + Basic auth; GET issue/JQL/createmeta, POST create)
api/fetch.js      ← generic API proxy for the mapping console
vercel.json       ← static + functions config
memory/           ← project memory notes
```

### Firebase data structure
```
/config                  → team roles (emailRoles map)
/projects                → project list
/proj_config/{pid}       → per-project: epicKey, testingSets, masters (registry), sessions, catalog
/data/{pid}              → testing rows
/integration/{pid}       → integration timeline
/signoff/{pid}           → signoff rows
/mappings/{pid}          → field mappings (incl. per-integration API config + sample values)
/jira_config             → Jira base URL, email, API token (shared across projects)
/requests                → pending access requests
```

---

## Deployment

The machine is logged into the Vercel CLI, so deploy without a token:

```bash
cd sap-tracker
vercel deploy --prod --archive=tgz --yes
# production alias: sap-tracker-mocha.vercel.app
```

---

## Project status

Active. First client integration (CCBCSA) in progress; the platform is generalised for reuse across clients and projects.
