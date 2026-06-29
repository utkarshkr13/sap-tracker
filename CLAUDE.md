# CLAUDE.md — SAP Integration Tracker (handover / onboarding)

This is the cold-start guide for Claude Code and any engineer picking up this project. Read it fully before making changes.

---

## 1. What this is

**Salescode.ai — SAP Integration Platform.** A self-serve tool for running SAP integration projects end-to-end: track testing, map client APIs to Salescode fields *without hand-writing transformers*, watch progress live from Jira, simulate job pipelines, and hand off full context in one click. Multi-project / multi-client (first deployment: CCBCSA — Coca-Cola Saudi Arabia).

Architecture is deliberately tiny:

- **`index.html`** — the *entire* frontend. Vanilla HTML/CSS/JS, no framework, **no build step**.
- **Two Vercel serverless functions** — `api/jira.js` (Jira proxy) and `api/fetch.js` (generic API proxy for the mapping console).
- **Firebase Realtime Database** — all app state, syncs across devices.
- **Firebase Authentication** — Google sign-in, access role-gated by email.
- **CDN libraries** — Chart.js, SheetJS (xlsx), mammoth (.docx parsing).

- **Live:** https://sap-tracker-mocha.vercel.app
- **Repo:** github.com/utkarshkr13/sap-tracker (branch `main`, private)
- **Firebase project:** sap-tracker-8c413 · RTDB `https://sap-tracker-8c413-default-rtdb.firebaseio.com`
- **Vercel project:** ukumardj-8588s-projects/sap-tracker

---

## 2. How to run / deploy

There is no build and no dev server — just open `index.html`, or edit it directly. Auth/DB/proxy features need the deployed environment (the Firebase config is inline and the proxies are Vercel functions), so for full testing, deploy.

**Codebase home (use this path):**
`/Users/salescode/Documents/Obsidian Vault/Claude Memory/sap-tracker/`

**Deploy (production):** the machine is logged into the Vercel CLI, so deploy with NO token. The old `--token` value is dead and will be rejected — do not use it.

```bash
cd "/Users/salescode/Documents/Obsidian Vault/Claude Memory/sap-tracker"
/opt/homebrew/bin/vercel deploy --prod --archive=tgz --yes
# production alias: sap-tracker-mocha.vercel.app
```

**Always run deploy (and git push) from the host shell** — the sandbox has no network access.

**Before deploying, syntax-check the inline JS.** Since everything lives in one file, extract the `<script>` block(s) and run `node --check` on the extracted JS to catch syntax errors before they ship. Example:

```bash
# extract inline scripts and check them
python3 - <<'PY'
import re
html = open("index.html").read()
js = "\n".join(re.findall(r"<script>(.*?)</script>", html, re.S))
open("/tmp/_check.js","w").write(js)
PY
node --check /tmp/_check.js
```

**Standard post-change checklist:**
1. Edit `index.html` (and/or `api/*.js`).
2. Syntax-check inline JS with `node --check`.
3. Deploy: `vercel deploy --prod --archive=tgz --yes`.
4. Push to GitHub `main` (see secret hygiene below — fresh PAT inline, not committed).
5. Update Obsidian memory (`SAP_Tracker_Project_Context.md`) with what changed.

**GitHub push:** the previously saved PAT is expired/dead. Generate a fresh fine-grained PAT with Contents: Read **and write** on `utkarshkr13/sap-tracker`, and use it **inline** (never commit it into the remote URL — that auto-revokes it):

```bash
git push "https://x-access-token:<FRESH_PAT>@github.com/utkarshkr13/sap-tracker.git" main
```

Keep `origin` as the clean tokenless URL.

---

## 3. Repo layout

```
index.html        ← entire frontend (HTML + CSS + JS, single file)
api/jira.js       ← Jira proxy: GET issue / JQL search / createmeta; POST issue create
api/fetch.js      ← generic server-side API proxy for the mapping console (CORS + auth)
vercel.json       ← Vercel config: no build, static output + functions
package.json      ← {"type":"module"} so Vercel treats api/*.js as ESM
memory/           ← project memory notes
README.md         ← product-facing overview
```

---

## 4. Firebase data model

RTDB paths:

```
/config                  → emailRoles (team roles map)
/projects                → project list
/proj_config/{pid}       → per-project: epicKey, testingSets, masters (registry),
                            jobTrees (Job Tree scenarios), sessions, catalog
/data/{pid}              → testing rows
/integration/{pid}       → integration timeline
/signoff/{pid}           → signoff rows
/mappings/{pid}          → field mappings + per-integration api config + response samples
/jira_config             → shared Jira baseUrl / email / API token (across all projects)
/requests                → pending access requests
```

**Firebase key restriction (important):** RTDB keys cannot contain `.` `#` `$` `/` `[` `]`. Emails used as keys are encoded (`.` ↔ `~D~`) via `fbEncKey` / `fbDecKey` / `fbEncObj` / `fbDecObj`. This restriction is also *why mapping response samples are stored on each row* (`r.sample`) rather than in a key-by-API-field map — API field names contain dots/brackets (e.g. `items[].product_code`).

> **⚠️ TOP SECURITY TODO — RTDB rules are currently OPEN (public read/write).** Anyone with the DB URL can read or overwrite all project data. This must be locked down to authenticated users (and ideally per-project scoping) before any broader rollout. See Roadmap.

---

## 5. Feature map (key function names — so you can find code fast)

All functions live in the single `<script>` block in `index.html`.

### Auth & roles
- `startClerk` — **misnamed**; despite the name it is Firebase Google auth (Clerk was abandoned because the test instance had Google OAuth disabled). Also contains the `?share=` read-only branch.
- `checkUserAuth`, `getRoleForEmail`, `initApp`.
- `logout` — does **NOT** reload the page; it shows the login UI directly to avoid a persisted-session reload loop. Uses a `sessionStorage` `'sap_signout'` guard.
- Roles: `admin` / `editor` / `viewer`. Viewer is read-only, enforced via `body.ro` CSS plus render-time gating.

### Projects
- `loadProjects` / `saveProjects`, `createProject` (templates: blank / sap / copy; seeds **empty** data so there is no CCBCSA seed leak into new projects), `switchProject`, `deleteProject` (admin only; clears the Firebase nodes for that pid).
- Projects Hub: `openHub` / `renderHub` / `projStats`.
- Onboarding carousel: `onb*` functions + an animated cursor-tap demo.
- Guided tour: `startTour` / `TOUR_STEPS` / `showTourStep`.

### Testing data
- `SEED` (sample data), `loadData` (falls back to `[]`, **not** `SEED`, for new projects), `renderData`.
- Inline editors `stHtml` / `dateHtml` (role-gated).
- Configurable testing sessions per project: `getTestingSets` / `addTestingSet`.

### SAP Masters (live Jira epic)
- `renderMastersPanel`, `fetchEpicChildren` (uses `api/jira.js` JQL `parent=<EPIC>`).
- Per-project epic: `getEpicKey` / `saveEpicKey` (no global default; new projects prompt via `mstLinkEpic`).
- Automatic sign-off: `jiraIsDone`, `isTestingSub` — Dev sign-off = master Done/Closed; Tester sign-off = its testing/QA-sanity subtask Done/Closed.
- `createTestingSubtask` — uses Jira `createmeta`, sets Complexity = 2, writes an ADF description (Business Requirement + QA-sanity instruction + parent link).
- Run Digest modal, `exportProjectToClaude` (bundles every master's full context into one Markdown handoff pack).

### Mapping / Transformer console
- `renderMpMain` — main mapping view.
- API console: `mpHandleDocFile` (drag-drop `.docx`, parsed in-browser via **mammoth** → `parseInterfaceDoc` / `_cleanJson`), `mpHitApi` (live API via `/api/fetch`).
- Type detection: `flattenJsonWithTypes` / `inferSqlType`.
- `mpMergeApiFields` (new-fields-only merge — preserves your existing type/mandatory/salescode edits on re-pull).
- `mpTestApi` (record count + missing mandatory + type mismatches).
- Columns: **Salescode | API | API Response sample | Type | Mandatory** (SAP reference column hideable).
- `buildTransformerJava` / `exportTransformer` — generates a Java `AbstractTransformer` per master, recognising conventions: `loginId`, `email`, `mobile`, `activeStatus`, `userParents`, `designation`, `extendedAttributes.*`.

### Job Tree (tab) — DAG editor + simulation
- View / canvas: `jtApplyView`, `jtToWorld`, `jtBindCanvas`, `jtZoom`, `jtFit` (pan/zoom).
- Edges: `jtEdgePath` (smooth-step), `jtRenderNodes` (nodes).
- Connections: `jtStartLink`, `jtConnect`, `jtCreatesCycle` (cycle guard).
- Per-node config modal: `jtEditNode` / `jtSaveNodeCfg` (table, rows, cols → estimated time, manual duration override, ALL/ANY trigger).
- Simulation: `jtPlay` (time-compressed, event-driven, honors ALL/ANY triggers), `jtSimMs`, `jtFlowToken` (tokens).
- End report: `jtShowReport` (tables populated, rows, run order, critical-path time).
- Scenarios / pages per project: `jtScenarios` / `jtActiveId` / `jtNewScenario` / `jtSwitchScenario` / `jtRenameScenario` / `jtDeleteScenario` (stored in `proj_config.jobTrees`).
- Auto-layout: `jtAutoLayout` (top-down layered + barycenter ordering).

### Settings
- Team Access: `addEmailRole` (writes `config.emailRoles`).
- Per-project config: `renderSettingsProj`.
- Master registry: `getRegistry` / `autoSeedRegistry`.
- Read-only share link `?share=<pid>`: `getShareParam` + the share branch in `startClerk` (opens locked viewer mode, no sign-in).
- Jira config + data reset.

---

## 6. Conventions & gotchas

- **Single-file app** — edit `index.html` directly. There is no module system; everything is global.
- **Inline event handlers** are used heavily (`onclick="..."` etc.), so functions must be global/top-level.
- **Firebase key restriction** (`.` `#` `$` `/` `[` `]` forbidden) — encode emails, and store mapping samples on the row, not in a keyed map.
- **Deploy via the logged-in Vercel CLI** — no `--token`; the old token is dead.
- **GitHub push needs a fresh PAT** (old one dead) used **inline**, never committed into the remote URL.
- **Secret hygiene** — no secrets, tokens, or API keys committed to the repo. Jira token lives in `/jira_config` in Firebase, not in code.
- **Accessibility (WCAG)** — preserve `body.ro` read-only styling, `prefers-reduced-motion` support, and proper dialog roles / aria-labels when editing UI.
- **Misnamed function:** `startClerk` is Firebase auth, not Clerk. Clerk has been fully removed.
- **`logout` does not reload** — don't "fix" it to reload; that reintroduces the persisted-session loop.

---

## 7. Roadmap / TODO

1. **Lock down Firebase RTDB rules + add sign-in gating** — *top priority*. Rules are currently open read/write; restrict to authenticated users and ideally scope per project.
2. **Post-development monitoring** — detect failed scheduled API jobs after go-live.
3. **Client portal** — a "Request a field" action on the read-only share link so clients can request mapping fields.
4. **Wire Job Tree to real scheduling** — currently a simulation/design tool; connect it to actual job orchestration.
