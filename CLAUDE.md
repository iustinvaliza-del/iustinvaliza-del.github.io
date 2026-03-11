# CLAUDE.md — Legacy Stewards Project Guide

## Project Overview

Legacy Stewards is a stewardship consulting platform for next-generation women of wealth in Southeast Asia. The site consists of:

1. **Marketing Site** (`index.html`) — Public-facing single-page app with company info, services, team, assessment tool, and insights linking to education
2. **Education Hub** (`education.html`) — 11-module financial literacy resource covering fundamentals, portfolio construction, benchmarks, risk, ESG frameworks, philanthropy vs impact investing, and SDG-aligned portfolios
3. **Assessment Pages** (`assessment-finance.html`, `assessment-tax.html`, `assessment-legal.html`) — Standalone multi-step assessment tools for financial, tax, and legal readiness
4. **Client Dashboard** (`client-dashboard.html`) — Authenticated portal with U-shaped 3-column layout (journey | milestones | messages/notes/docs)
5. **Admin Dashboard** (`admin-dashboard.html`) — Authenticated portal where employees/admins manage clients, milestones, notes, and documents
6. **Login Page** (`login.html`) — Unified login with role-based routing

## Tech Stack

- **Frontend**: Vanilla HTML/JS, Tailwind CSS (CDN), Google Fonts (Playfair Display + Inter)
- **Backend**: Firebase (Auth + Firestore + Storage)
- **Firebase SDK**: Compat v10.12 via CDN (no build tools/bundler)
- **Hosting**: GitHub Pages
- **Dev Server**: `serve` via Node.js (`node ./node_modules/serve/build/main.js -l 3000 .`)
- **Firebase CLI**: `firebase-tools` v15.9 (deploy Firestore rules with `firebase deploy --only firestore:rules`)

## File Structure

```
├── index.html                 # Marketing site (team cards, services, advisory, assessment)
├── education.html             # Financial Education Hub (11 modules, filters, accordions)
├── assessment-finance.html    # Financial readiness assessment
├── assessment-tax.html        # Tax readiness assessment
├── assessment-legal.html      # Legal readiness assessment
├── login.html                 # Unified login page
├── client-dashboard.html      # Client portal (U-shaped 3-column, portfolio, specialists)
├── admin-dashboard.html       # Employee/admin portal
├── css/
│   └── shared.css             # Shared dashboard + tab/column styles
├── img/
│   └── team/                  # Team member portrait photos (stewards + landing page)
├── js/
│   ├── firebase-config.js     # Firebase initialization + global refs
│   ├── auth.js                # Auth module (login, logout, guards, role routing)
│   ├── client-dashboard.js    # Client dashboard logic (3-column, tabs, portfolio, specialists)
│   └── admin-dashboard.js     # Admin dashboard logic (CRUD, views, modals, team photos)
├── .claude/
│   └── launch.json            # Dev server config for Claude preview
├── firestore.rules            # Firestore security rules (deployed via Firebase CLI)
├── firebase.json              # Firebase CLI config (rules path)
├── seed-data.html             # Firestore data seeder/updater (rename team, set photoURLs)
└── package.json               # Dev dependency (serve)
```

## Firebase Data Model

### Collections

- **`users/{uid}`** — `email`, `displayName`, `role` ("client"|"employee"|"admin"), `phone`, `assignedEmployeeId`, `country`, `photoURL`, `createdAt`
- **`cases/{caseId}`** — `clientId`, `clientName`, `clientEmail`, `assignedEmployeeId`, `assignedEmployeeName`, `status`, `currentPhase` (0-6, maps to PHASES constant), `title`, `summary`, `createdAt`, `updatedAt`
- **`cases/{caseId}/milestones/{id}`** — `title`, `description`, `status` ("completed"|"in-progress"|"upcoming"), `order`, `completedAt`, `updatedAt`, `updatedBy`
- **`cases/{caseId}/messages/{id}`** — `text`, `senderId`, `senderName`, `senderRole` ("client"|"steward"), `timestamp`, `read` (boolean)
- **`cases/{caseId}/notes/{id}`** — `content`, `authorId`, `authorName`, `createdAt`, `visibleToClient` (boolean)
- **`cases/{caseId}/documents/{id}`** — `name`, `fileName`, `storagePath`, `downloadUrl`, `uploadedBy`, `uploadedByName`, `uploadedAt`, `fileSize`, `mimeType`, `visibleToClient`
- **`teamMembers/{uid}`** — `displayName`, `email`, `role`, `photoURL`, `activeCaseCount`, `joinedAt`

### Required Firestore Indexes

Two composite indexes are needed (auto-created via Firebase Console links):
1. `notes`: `visibleToClient` (Asc) + `createdAt` (Desc)
2. `documents`: `visibleToClient` (Asc) + `uploadedAt` (Desc)

## Roles & Access

| Role | Dashboard | Can Do |
|------|-----------|--------|
| client | client-dashboard.html | View own milestones, notes (visible only), documents (visible only) |
| employee | admin-dashboard.html | Manage assigned clients, milestones, notes, documents |
| admin | admin-dashboard.html | Everything employee can + Team Management |

## Auth Flow

1. User visits `login.html`
2. If already authenticated → shows "signed in as" card with option to switch accounts
3. On login → `auth.js` fetches `users/{uid}` for role → redirects to correct dashboard
4. Each dashboard page calls `Auth.requireAuth(allowedRoles, callback)` which:
   - Hides body (opacity: 0) during check
   - Redirects if not authenticated or wrong role
   - Shows body and calls callback with profile on success

## Design System

- **Colors**: Gold `#c9a96e`, Cream `#F0EBE3`, Charcoal `#2C2C35`, Muted `#6B6B7B`, Rose `#b76e79`
- **Fonts**: Playfair Display (headings), Inter (body)
- **Components**: `.card`, `.btn-gold`, `.btn-outline`, `.badge-*`, `.timeline-*`, `.stat-card`, `.data-table`, `.modal-overlay`, `.form-input`, `.toggle`

## Key Patterns

- **No build tools** — everything is CDN-based, no npm scripts needed for the app itself
- **IIFE modules** — `auth.js`, `client-dashboard.js`, `admin-dashboard.js` all use the revealing module pattern
- **Real-time updates** — Client dashboard uses `onSnapshot` for milestones, notes, and messages
- **Real-time messaging** — Both client and admin dashboards support live chat via `cases/{caseId}/messages` subcollection; client sends as `senderRole: 'client'`, steward as `'steward'`; auto-read marking and unread badge
- **Default milestones** — New cases auto-populate with 7 template milestones (see `DEFAULT_MILESTONES` in admin-dashboard.js)
- **Visibility toggle** — Notes and documents have a `visibleToClient` boolean; client queries filter on this
- **U-shaped dashboard** — Client dashboard uses a 3-column grid (`grid-cols-[200px_1fr_320px]`) with independent scrollable columns and tab switching (Messages/Notes/Docs) via `ClientDashboard.switchTab()`
- **Portfolio view** — Client dashboard center column has switchable views (milestones/portfolio) via `ClientDashboard.switchCenterView()`; uses Chart.js for asset allocation doughnut and performance line chart
- **Specialist panel** — Client dashboard auto-surfaces jurisdiction-matched legal & tax specialists based on `users/{uid}.country` field; data in `SPECIALISTS` constant covers 6 SEA countries
- **Steward photos** — Team photos are AI-generated portraits matching each member's ethnicity, stored in `img/team/` and served via GitHub Pages URLs (`https://iustinvaliza-del.github.io/img/team/`). Firestore `photoURL` fields on `teamMembers` and `users` collections point to these URLs. Client dashboard uses initials fallback when no photoURL is set.
- **Admin dashboard metrics** — Overview shows illustrative financial metrics (AUM, return, revenue) derived from client count, plus Case Status breakdown and Cases by Phase bar chart (Chart.js); when no `currentPhase` data exists, chart shows illustrative distribution
- **Journey phase tracking** — Case detail includes a phase indicator with dropdown selector (7 phases from Discovery to Transition Complete) and progress bar; updates `currentPhase` field on the case document
- **Enhanced milestones** — Case detail milestones show a progress bar (X of Y completed, percentage), color-coded status badges, completion dates, gold border on in-progress items
- **Education accordions** — `education.html` uses CSS `max-height` transitions for expand/collapse, only one module open at a time, with URL hash auto-opening for cross-page linking
- **Topic filtering** — Education modules have `data-topic` attributes; filter pills toggle visibility with GSAP opacity reset to prevent ScrollTrigger hiding filtered cards
- **Landing page team cards** — `index.html` renders 4 team member profile cards via JS (`TEAM_MEMBERS` array + `renderTeamCards()`), with photos from `img/team/`: Sarah Chen, Maya Tan, Priya Sharma, Linh Nguyen

## Development

```bash
# Install dev server (one-time)
npm install

# Start dev server
# Option 1: Use Claude preview (reads .claude/launch.json)
# Option 2: Manual
node ./node_modules/serve/build/main.js -l 3000 .
```

Then open `http://localhost:3000`

## Test Accounts

| Role | Email | Password | Display Name |
|------|-------|----------|--------------|
| Admin | admin@legacystewards.com | Test123456! | Sarah Chen |
| Employee | employee@legacystewards.com | Test123456! | Maya Tan |
| Employee | employee2@legacystewards.com | Test123456! | Priya Sharma |
| Client | client@legacystewards.com | Test123456! | (test client) |

## Notes

- Firebase Storage requires the Blaze plan (pay-as-you-go). Document upload won't work on the free Spark plan.
- The `storage` global in `firebase-config.js` gracefully handles missing Storage SDK (returns `null`).
- `seed-data.html` is a one-time seeder page — not committed to git. Run it at `localhost:3000/seed-data.html` if you need to re-seed.
- **Firestore rules** are managed via `firestore.rules` and deployed with `firebase deploy --only firestore:rules --project legacy-stewards`. Rules require authentication for all reads/writes. If rules expire or permissions break, redeploy.
