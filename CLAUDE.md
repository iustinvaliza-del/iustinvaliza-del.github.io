# CLAUDE.md — Legacy Stewards Project Guide

## Project Overview

Legacy Stewards is a stewardship consulting platform for next-generation women of wealth in Southeast Asia. The site consists of:

1. **Marketing Site** (`index.html`) — Public-facing single-page app with company info, services, team, assessment tool, and insights linking to education
2. **Education Hub** (`education.html`) — 8-module financial literacy resource covering fundamentals, portfolio construction, benchmarks, risk, and impact investing
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

## File Structure

```
├── index.html                 # Marketing site (single page, ~1200 lines)
├── education.html             # Financial Education Hub (8 modules, filters, accordions)
├── assessment-finance.html    # Financial readiness assessment
├── assessment-tax.html        # Tax readiness assessment
├── assessment-legal.html      # Legal readiness assessment
├── login.html                 # Unified login page
├── client-dashboard.html      # Client portal (U-shaped 3-column layout)
├── admin-dashboard.html       # Employee/admin portal
├── css/
│   └── shared.css             # Shared dashboard + tab/column styles
├── js/
│   ├── firebase-config.js     # Firebase initialization + global refs
│   ├── auth.js                # Auth module (login, logout, guards, role routing)
│   ├── client-dashboard.js    # Client dashboard logic (3-column, tabs, real-time)
│   └── admin-dashboard.js     # Admin dashboard logic (CRUD, views, modals)
├── .claude/
│   └── launch.json            # Dev server config for Claude preview
├── seed-data.html             # One-time Firestore data seeder (not committed)
└── package.json               # Dev dependency (serve)
```

## Firebase Data Model

### Collections

- **`users/{uid}`** — `email`, `displayName`, `role` ("client"|"employee"|"admin"), `phone`, `assignedEmployeeId`, `createdAt`
- **`cases/{caseId}`** — `clientId`, `clientName`, `clientEmail`, `assignedEmployeeId`, `assignedEmployeeName`, `status`, `title`, `summary`, `createdAt`, `updatedAt`
- **`cases/{caseId}/milestones/{id}`** — `title`, `description`, `status` ("completed"|"in-progress"|"upcoming"), `order`, `completedAt`, `updatedAt`, `updatedBy`
- **`cases/{caseId}/notes/{id}`** — `content`, `authorId`, `authorName`, `createdAt`, `visibleToClient` (boolean)
- **`cases/{caseId}/documents/{id}`** — `name`, `fileName`, `storagePath`, `downloadUrl`, `uploadedBy`, `uploadedByName`, `uploadedAt`, `fileSize`, `mimeType`, `visibleToClient`
- **`teamMembers/{uid}`** — `displayName`, `email`, `role`, `activeCaseCount`, `joinedAt`

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
- **Real-time updates** — Client dashboard uses `onSnapshot` for milestones and notes
- **Default milestones** — New cases auto-populate with 7 template milestones (see `DEFAULT_MILESTONES` in admin-dashboard.js)
- **Visibility toggle** — Notes and documents have a `visibleToClient` boolean; client queries filter on this
- **U-shaped dashboard** — Client dashboard uses a 3-column grid (`grid-cols-[200px_1fr_320px]`) with independent scrollable columns and tab switching (Messages/Notes/Docs) via `ClientDashboard.switchTab()`
- **Education accordions** — `education.html` uses CSS `max-height` transitions for expand/collapse, only one module open at a time, with URL hash auto-opening for cross-page linking
- **Topic filtering** — Education modules have `data-topic` attributes; filter pills toggle visibility

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

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@legacystewards.com | Test123456! |
| Employee | employee@legacystewards.com | Test123456! |
| Client | client@legacystewards.com | Test123456! |

## Notes

- Firebase Storage requires the Blaze plan (pay-as-you-go). Document upload won't work on the free Spark plan.
- The `storage` global in `firebase-config.js` gracefully handles missing Storage SDK (returns `null`).
- `seed-data.html` is a one-time seeder page — not committed to git. Run it at `localhost:3000/seed-data.html` if you need to re-seed.
