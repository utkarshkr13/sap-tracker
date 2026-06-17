# Salescode.ai — SAP Integration Tracker

> A self-serve platform for running SAP integration projects end-to-end: track testing, map client APIs to Salescode fields **without writing transformers**, watch progress live from Jira, and hand off context in one click.

🔗 **Live app**: https://sap-tracker-mocha.vercel.app
🏢 First deployment: **CCBCSA** (Coca-Cola Saudi Arabia) Van Sales — but the app is **multi-project** and reusable for any client.

---

## What it does

Instead of a technical person hand-writing an enrichment/transformer for every client API, this app lets an engineer point at an API (or its interface doc), auto-detect the fields and types, map them to Salescode fields, and verify the contract — all in the browser. Around that sits full project tracking and live Jira sign-off.

---

## Modules

| Tab | Description |
|-----|-------------|
| **Testing Data** | CRUD table of test entries with filtering, sorting, bulk actions, inline editing. Testing sessions (Testing 1, 2, 3…) are configurable per project. |
| **Tracker** | Ring-chart summary per testing set with worst-case status rollup and Excel export. |
| **Analytics** | Charts + a session calendar with status-coloured chips and click-to-expand detail. |
| **Integration** | SAP↔Salescode API-readiness tracker with status pills and Excel export. |
| **SAP Masters** | **Live view of a Jira epic.** Each child story shows status, assignee, start/due dates, child-work flag, and **auto Dev/Tester sign-off** (Dev = story Done/Closed, Tester = the testing/QA-Sanity subtask Done/Closed). One-click **create testing subtask**, **Run Digest**, and **Export project to Claude**. |
| **Mapping** | **The transformer console.** Pull API fields from a live endpoint or a `.docx` interface doc, auto-detect SQL types, mark Mandatory, map to Salescode fields, validate, and **Test** the live contract. |
| **Settings** | Team access (grant by email + role), per-project config (epic key, testing sessions, master registry), read-only share link, Jira connection, data reset (admin only). |

---

## Mapping / API Console (the core feature)

- **Drag-and-drop a `.docx` interface document** → parsed in-browser (mammoth) to extract the API URL, method, Basic-auth credentials, request body and example response.
- **Or hit the live API** — URL + method + Basic auth + body → routed through the `/api/fetch` proxy (CORS + auth) → real response.
- **Auto type detection** — each field gets an SQL type (`varchar(255)`, `text`, `integer`, `bigint`, `decimal`, `boolean`, `date`, `datetime`, `json`) inferred from the response value.
- **New-fields-only merge** — pulling again only adds fields you don't have; your edits (type, mandatory, Salescode mapping) are preserved.
- **API Response column** — shows a real sample value per field so you can see what actually returns.
- **Test** — re-hits the saved API and reports record count, mandatory fields returning no data, and type mismatches.
- Core mapping columns are **Salescode Field · API Field · Type · Mandatory**; the SAP reference column is hideable.

---

## SAP Masters & auto sign-off (from Jira)

- Each project links to **one Jira epic** (configurable per project — new projects start unlinked and prompt for it).
- The screen refetches the epic's child stories on open via `/rest/api/3/search/jql` (`parent=<EPIC>`).
- **Dev sign-off** = master story is Done/Closed; **Tester sign-off** = its testing/QA-Sanity subtask is Done/Closed; **Complete** = both.
- **Create testing subtask** writes a Jira sub-task ("`<Master> Testing`") with Complexity auto-set and a description (Business Requirement + QA-sanity instruction + link to the parent master).

---

## Multi-project

- Create projects from the top-bar switcher → an onboarding **feature tour carousel**, then a creation form (name, client, epic key, testing sessions, start-from template).
- Each project has its own data, integration, sign-off, mappings, **Jira epic key**, **testing sessions**, and **master registry**.
- **Admins** can delete a project (trash icon in the switcher) — fully removes its Firebase data.

---

## Tech stack

- **Frontend**: vanilla HTML/CSS/JS — no build step, single `index.html`.
- **Auth**: Firebase Authentication (Google sign-in). Access is role-gated by email.
- **Database**: Firebase Realtime Database — syncs across devices.
- **Serverless** (Vercel functions): `api/jira.js` (Jira proxy: issue/JQL/createmeta + issue creation), `api/fetch.js` (generic API proxy for the mapping console).
- **Libraries (CDN)**: Chart.js, SheetJS, mammoth (docx parsing).
- **Hosting**: Vercel (static + functions).

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

## Roles

| Role | Permissions |
|------|-------------|
| **admin** | Everything: settings, team access, create/delete projects, bulk actions |
| **editor** | Add / edit / delete entries, bulk actions, pull & map APIs |
| **viewer** | Read-only |

Grant access in **Settings → Team Access**: enter a Google email, pick a role, Save → that user can sign in with Google.

---

## Deployment

The machine is logged into the Vercel CLI, so deploy without a token:

```bash
cd sap-tracker
vercel deploy --prod --archive=tgz --yes
# production alias: sap-tracker-mocha.vercel.app
```

**After any change**: deploy to Vercel, push to GitHub `main`, and update `memory/`.

---

## Project status

Active. CCBCSA Van Sales integration in progress; the platform is being generalised for reuse across clients.
