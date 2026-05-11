---
name: SAP Tracker — Salescode.ai
description: Full project memory for the SAP Integration Testing Tracker web app built for CCBCSA
type: project
updated: 2026-05-11
---

# SAP Integration Testing Tracker

## What it is
A single-file static web app for tracking SAP integration testing progress during a Van Sales implementation for **CCBCSA (Coca-Cola South Africa)**. Built and deployed on Vercel. Branded as **Salescode.ai**.

## Live URL
`https://sap-tracker-mocha.vercel.app`

## GitHub Repository
- **URL**: https://github.com/utkarshkr13/sap-tracker (private)
- **Contents**: `index.html`, `vercel.json`, `README.md`, `memory/sap_tracker_project.md`
- **Branch**: `main`
- **Rule**: Every dev change must update both this Obsidian file AND push to GitHub

## Codebase
- **Single file**: `index.html` — everything is in one HTML file (CSS + JS + HTML)
- **Local path**: `/Users/salescode/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/sap-tracker/index.html`
- **vercel.json**: `{"version":2,"builds":[{"src":"index.html","use":"@vercel/static"}]}`
- **Vercel project**: `ukumardj-8588s-projects/sap-tracker`
- **Vercel token**: `vcp_8e6o2KQUe4w3c4rSqNUxtwWt1xTSVQhj6WY3aPLu3GJhOk57GD1zx8pu`
- **Deploy command**: `/opt/homebrew/bin/vercel deploy --prod --token <token> --yes`
- **Note**: Always use `mcp__Macos__Shell` for Vercel deploys — sandbox has no network

## Tech stack
- Pure vanilla HTML/CSS/JS (no framework)
- Chart.js + SheetJS (from cdnjs CDN) for analytics and Excel export
- **Clerk** (`@clerk/clerk-js` v5) for Google OAuth authentication
- Clerk publishable key: `pk_test_c21pbGluZy1vY2Vsb3QtNDIuY2xlcmsuYWNjb3VudHMuZGV2JA`
- Clerk frontend API host: `smiling-ocelot-42.clerk.accounts.dev`
- **Firebase Realtime Database** (compat SDK v10.12.2) — primary data backend
- Data also written to `localStorage` as a local cache / offline fallback
- In-memory caches: `_cfgCache`, `_projectsCache`, `_projCfgCache`, `_integCache`, `_signoffCache`

## Firebase Setup (added 2026-05-06)
- **Project**: `sap-tracker-8c413`
- **Database URL**: `https://sap-tracker-8c413-default-rtdb.firebaseio.com`
- **Rules**: `{ "rules": { ".read": true, ".write": true } }` (open — auth handled by Clerk)
- **SDK**: Firebase compat v10.12.2 (supports `firebase.database()` syntax, no bundler needed)
- **Config**:
  ```js
  const FB_CONFIG = {
    apiKey: "AIzaSyDvTOxYSwcvtnLnBL4xoHzEJkkrxKD0c-Y",
    authDomain: "sap-tracker-8c413.firebaseapp.com",
    databaseURL: "https://sap-tracker-8c413-default-rtdb.firebaseio.com",
    projectId: "sap-tracker-8c413",
    storageBucket: "sap-tracker-8c413.firebasestorage.app",
    messagingSenderId: "468767909381",
    appId: "1:468767909381:web:3c1863b63b1211a7581e6c"
  };
  ```
- **Firebase helpers**:
  ```js
  function initFirebase(){ try{ firebase.initializeApp(FB_CONFIG); db=firebase.database(); }catch(e){} }
  function fbSet(path,val){ return db?db.ref(path).set(val).catch(e=>console.warn('FB write failed',e)):Promise.resolve(); }
  async function fbGet(path){ if(!db) return null; try{ const s=await db.ref(path).get(); return s.val(); }catch(e){ return null; } }
  function fbToArray(val){ if(!val) return null; if(Array.isArray(val)) return val; return Object.values(val); }
  ```
- `DOMContentLoaded` calls `initFirebase()` first, before auth

## Firebase Data Structure
```
/config          → team config (emailRoles)
/projects        → array of project objects [{id, name, ...}]
/projCfg/{pid}   → per-project config
/data/{pid}      → rows array for that project
/integration/{pid} → integration tracker rows
/signoff/{pid}   → signoff tracker rows
/requests        → pending access requests
```

## localStorage keys (still used as local cache)
- `sap_projects_v1`, `sap_active_project`
- `sap_proj_{pid}`, `sap_data_{pid}`, `sap_integ_{pid}`, `sap_signoff_{pid}`
- `sap_cfg_v1` — global team roles config
- `sap_data_v6`, `sap_integ_v3` — legacy keys checked during migration

## Migration logic
`migrateLocalStorageToFirebase()` runs at app startup:
- Checks `data/{pid}` in Firebase — if data already exists, skip (do NOT check `projects`, that leads to re-migration skip bug)
- Falls back to `sap_data_{pid}` or `sap_data_v6` (legacy) from localStorage
- Pushes config, projects, projCfg, data, integration, signoff, requests to Firebase

## Authentication — Clerk v5 key facts
- Clerk v5 exports a **pre-initialized instance**, NOT a class. Use `window.Clerk.load()`, never `new window.Clerk(pk)`
- Load SDK dynamically: add `<script data-clerk-publishable-key="pk_...">` via JS, never as a static `<head>` tag
- Guard with `window.__clerkLoaded` to avoid loading twice (breaks OAuth callback)
- **Never** `delete window.Clerk` — destroys OAuth callback token processing on page reload
- `clerk.signIn` is undefined in v5; OAuth is via `clerk.client.signIn.create({ strategy:'oauth_google' })`
- `clerk.openSignIn()` is the reliable fallback modal approach
- `clerk.addListener(({ user }) => ...)` fires when OAuth completes

## signInWithGoogle() — current approach
1. Try direct Google OAuth: `clerkInstance.client?.signIn.create({ strategy:'oauth_google', redirectUrl: ... })` → redirect to `firstFactorVerification.externalVerificationRedirectURL`
2. Fallback: `clerkInstance.openSignIn({ afterSignInUrl, afterSignUpUrl })` (Clerk modal, 2 taps)

## Role / access system
Roles stored in Firebase under `config` → `emailRoles` map (also cached in `localStorage('sap_cfg_v1')`).

| Role | Can | Cannot |
|------|-----|--------|
| admin | Add, Edit, Delete, Settings, Bulk actions | — |
| editor | Add, Edit, Delete, Bulk actions | Settings |
| viewer | View only | Edit, Delete, Add |

- Owner email `ukumardj@gmail.com` hardcoded as `admin` in `defaultCfg()`, cannot be removed
- Multi-admin supported: any `emailRoles` entry with `admin` role gets Settings tab
- Unknown Google users → Access Denied screen → `mailto:` to admin(s) to request access
- Pending access requests stored in Firebase under `requests`

## Access denied flow
1. User signs in with Google → email not in `emailRoles` → `showAccessDenied(email, name)`
2. Request stored in Firebase `requests` with status `pending`
3. User sees "Access Required" screen with a mailto button to email all admins
4. Admin sees pending requests in Settings → can approve with role selector or deny
5. On approval → email added to `emailRoles`, user must sign in again

## Data model
Each row:
```js
{
  id: Number,
  set: 'Testing 1' | 'Testing 2',
  name: String,           // Master/Transaction name
  type: 'Master' | 'Transaction',
  session: String,        // e.g. 'Session 1'
  date: String,           // ISO date
  status: 'Completed' | 'In Progress' | 'Pending' | 'Not Started' | '-',
  rework: 'Yes' | 'No' | '-',
  rby: String,            // Rework by (e.g. 'Salescode', 'SAP')
  rwhen: String,          // Rework by when (date)
  desc: String            // Change description
}
```

## Current data (as of 2026-05-11) — 28 rows in Firebase
**Testing 1 rows** (23 rows across Sessions 1–4):
- Masters: Employee, Item, Price, Vehicle, Asset, Route, Customer, New Customer, Journey Plan, AIL, Channel, Promotion
- Transactions: Sales Orders, Sales Invoice, Load Request, Loads, Unloads, Variance, Credit Notes, Debit Notes, Distributor Orders, CDE, Inventory
- Customer Master: Session 4, 2026-05-03, In Progress, Rework Salescode (added from email)
- 8 rows updated to "In Progress" + Rework Salescode based on alignment points from SAP emails (May 3 & May 6)

**Testing 2 rows** (3 rows — recovered from Comet browser localStorage):
- Item Master (SKU), Session 1, 2026-05-06, Completed, No rework — "Mandatory data not present for certain SKUs; out of 9 FGs only 2 persisted; live changes in SAP fixed it"
- Employee Master, Session 1, 2026-05-06, Pending, Rework Salescode — "Employee Type and Employee Code desc needed, updated doc to be shared"
- Employee Master, Session 1, 2026-05-06, In Progress — "Hierarchy needs to be checked — no immediate parent of sales rep"

Sessions: Feb 25 = Session 1, Mar 3 = Session 2, Mar 12 = Session 3, May 3 = Session 4

## Alignment points added from SAP emails (2026-05-06)
Points extracted from two email threads (May 3 + May 6) and added to Testing 1 as "In Progress" + "Rework: Salescode":
- Employee Master: Biometric device integration, employee type/code desc issues
- Item Master: SKU mandatory data gaps, 9 FGs → 2 persisted before live fix
- Vehicle Master: Multiple routes per vehicle, ILN number requirement
- Route Master: Route scheduling / assignment gaps
- Customer Master: Customer-to-route assignment, customer hierarchy
- Sales Orders: Order entry workflow alignment
- Sales Invoice: Invoice posting and tax handling
- Load Request: Pre-load checklist gaps

## JS global state
```js
let rows = [];              // all data rows
let role = null;            // 'admin' | 'editor' | 'viewer'
let selectedIds = new Set(); // bulk selection
let editId = null;          // modal edit target
let filterSet = 'all';      // Testing 1 | Testing 2 | all
let fil = { status, type, session, rework, rby }; // filter state
let clerkInstance = null;   // Clerk instance
let sortField = null;       // active sort column
let sortDir = 'asc';        // 'asc' | 'desc'
let _selectedCalDate = null; // selected calendar day (ISO string)
let db = null;              // Firebase database instance
let _cfgCache = null, _projectsCache = null, _projCfgCache = {};
let _integCache = null, _signoffCache = null;
```

## App structure / panels (as of 2026-05-11)
1. **Testing Data** — filterable+sortable table, row detail drawer, inline status/date edit, add/edit/delete, bulk select
2. **Tracker** — ring-chart summary per Testing Set; worst-case overall status; Export Excel; click row → master detail modal
3. **Analytics** — charts + session calendar (status-colored chips, click-to-expand day detail); Export Excel removed
4. **Integration** — fully editable CRUD; SAP→SC + SC→SAP sections; Export Excel (2-sheet XLSX)
5. **Signoff** — fully editable CRUD; 14-column DQR signoff table; clickable/editable DQR links
6. **Settings** (admin only) — manage team members, pending access requests, Clerk key, data reset

## Projects system (as of 2026-05-06)
- Projects stored in Firebase under `/projects`
- Default project: **CCBCSA** (changed from "CCBCSA Van Sales" on 2026-05-06)
- Project switcher dropdown in topbar — shows existing projects only ("Add New Project" removed from dropdown)
- `getActivePid()` / `setActivePid()` — read/write `localStorage('sap_active_project')`
- Auto-selects first project if none active (bug fix: previously showed data then wiped it on select)
- `switchProject(pid)` — clears in-memory caches, renders from localStorage immediately, then reloads from Firebase

## Features added 2026-05-04

### Row Detail Drawer
- Click any row (outside checkbox/button/status/date) → right-side slide-in drawer
- Shows all fields: testing set, session, date, status (colored), rework details, change description
- Edit button for admin/editor → opens modal pre-filled
- HTML: `#drawer-backdrop` + `#row-drawer`; JS: `openRowDrawer(id)`, `closeDrawer()`, `handleRowClick(e,id)`

### Sortable Column Headers
- Columns: Testing Set, Master/Transaction, Type, Session, Session Date, Final Status
- Click header → sort asc; click again → sort desc; arrow indicators `▲▼`
- Sort indicators: `id="si-{field}"` — `si-set`, `si-name`, `si-type`, `si-session`, `si-date`, `si-status`

### Tracker Master Detail Modal
- Click any row in Tracker detail table → overlay modal with all test entries for that master
- HTML: `#master-detail-overlay`; JS: `openMasterDetail(name)`, `closeMasterDetail()`

### Session Naming Fix
- SEED sessions corrected by date: `2026-02-25` → Session 1, `2026-03-03` → Session 2, `2026-03-12` → Session 3
- Data key bumped to `sap_data_v6` to force clean reset

### Integration Tracker Panel
- Nav tab: `#nt-integration`, Panel: `#panel-integration` (dynamically rendered)
- Two sections: SAP→Salescode (25 items) and Salescode→SAP (1 item)
- Columns: #, Master/Transaction, Type, SAP API Readiness Date, SAP API Status, Salescode Completion Date, Delivery Date, Status
- API Status pills: Shared (green), Delayed (red), TBD (gray), Approach Changed (amber), Readiness TBD (blue)
- Status pills: Completed, Blocked, In-Progress, On-Track
- Data in Firebase `integration/{pid}` — fully editable CRUD; seed: `INTEG_SEED`
- Excel export: 2-sheet XLSX (SAP→SC + SC→SAP)

### Signoff Tracker Panel
- Nav tab: `#nt-signoff`, Panel: `#panel-signoff` (dynamically rendered)
- 14 items, 14 columns: #, Name, Type, API Received, Rework Req, Dev Status, Dev DQR, Dev DQR Link, Dev Lead Signoff, Test Status, Test DQR, Tester DQR Link, QA Lead Signoff, Reason/Comment
- Data in Firebase `signoff/{pid}` — fully editable CRUD

### Calendar Revamp (Analytics panel)
- Cells enlarged to min-height 84px
- Entry chips: status-colored (green=Completed, blue=In Progress, amber=Pending, gray=Not Started)
- Shows up to 2 chips per day + "+N more" pill
- Click any day with entries → slides open day detail panel below calendar
- Month summary strip: entry count, completed count, active session names

## Bulk select & bulk actions
- Checkbox column in table, "select all" in thead
- Bulk action bar slides in (indigo) when rows are selected
- Bulk set status (dropdown → Apply) / Bulk delete (with confirm)
- Only visible to `admin` and `editor` roles

## Inline editing
- Click Final Status pill → dropdown replaces it in-place
- Click Session Date → date input replaces it in-place

## Branding
- App name: **Salescode.ai** (topbar h1 + login card)
- Subtitle: "SAP Integration Testing Tracker"
- Logo: Indigo/purple gradient SVG "S" mark (64×64 rounded square)
- Login page: dark `#06090f` background, floating ambient orbs, white card
- Topbar: dark gradient `#0f172a → #1e1b4b → #1e3a5f`

## Pages / screens
1. `#setup-screen` — first-time Clerk key setup
2. `#login-screen` — Google sign-in (shows spinner while Clerk loads, then Google button)
3. `#access-denied-screen` — unknown user blocked, mailto admins
4. `#app` — main app shell (topbar + nav + panels)

## Known issues / history
- `window.Clerk is not a constructor` → v5 is instance not class; fixed by removing `new window.Clerk(pk)`
- Empty `data-clerk-publishable-key` → fixed by removing static Clerk `<script>` from `<head>`
- `authenticateWithRedirect undefined` → v5 has no `clerk.signIn`; fixed by using `openSignIn()`
- OAuth silent fail → Google OAuth wasn't enabled in Clerk dashboard; user enabled it
- Session not established after OAuth → `delete window.Clerk` was destroying callback; removed it
- Firebase blank page bug → `new-proj-overlay` HTML placed after `</script>`; fixed by moving modal HTML before script
- Migration skipping data → was checking `if(fbGet('projects')) return`; fixed by checking `data/{pid}` instead
- Data vanishing on project select → `getDKey()` returned `'sap_data_'` (empty PID); fixed with auto-select first project
- **New user Access Denied even after being added** (2026-05-11) → `getRoleForEmail` used stale localStorage/cache on new browser; fixed by adding `checkUserAuth(user)` async function that fetches fresh Firebase `config` before the role check
- **Project name reverts on new device** (2026-05-11) → `migrateToProjects()` ran before Firebase loaded; saw empty localStorage → created new default project and overwrote Firebase; fixed by pre-loading Firebase projects into localStorage before `migrateToProjects` runs in `initApp`
- **Vercel deploy fails** (2026-05-11) → `@vercel/static` builder deprecated; updated `vercel.json` to modern static config; also set git `user.email` to `ukumardj@gmail.com` so Vercel team auth passes

## Deployment notes
- Vercel CLI at `/opt/homebrew/bin/vercel`
- Always `--prod --yes` flags
- Build: `@vercel/static`, no build step
- Production alias: `sap-tracker-mocha.vercel.app`
- After any code change: deploy to Vercel AND push to GitHub AND update this Obsidian file
