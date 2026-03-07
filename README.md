# Legacy Stewards

**Independent Stewardship Partners** — Guiding the Next Generation of Legacy Leaders

A dedicated stewardship platform for next-generation women leading their family's wealth into the future across Southeast Asia.

## Live Site

[https://iustinvaliza-del.github.io](https://iustinvaliza-del.github.io)

## Features

### Marketing Site
- Responsive single-page design with elegant gold/cream aesthetic
- Interactive wealth readiness assessment tool
- Advisory fee calculator with tier-based pricing
- Team profiles, services overview, and insights section
- GSAP scroll animations and custom particle system

### Client Portal
- Secure login with role-based access
- Visual milestone timeline showing stewardship progress
- Real-time updates from assigned steward
- Document access (when Storage is enabled)
- Progress stats and current phase tracking

### Admin Dashboard
- Dashboard overview with key metrics (active clients, cases in progress)
- Client management with search, filter, and status tracking
- Case detail view with editable milestone timeline
- Notes system with client visibility toggle (internal vs. shared notes)
- Document management with upload capability
- Team management (admin-only)

## Tech Stack

- **Frontend**: HTML, Tailwind CSS (CDN), Vanilla JavaScript
- **Backend**: Firebase Authentication, Cloud Firestore, Firebase Storage
- **Fonts**: Playfair Display + Inter (Google Fonts)
- **Animations**: GSAP ScrollTrigger
- **Hosting**: GitHub Pages

## Getting Started

### Prerequisites
- Node.js (for local dev server)
- A Firebase project with Auth + Firestore enabled

### Local Development

```bash
# Clone the repo
git clone https://github.com/iustinvaliza-del/iustinvaliza-del.github.io.git

# Install dev server
npm install

# Start local server
node ./node_modules/serve/build/main.js -l 3000 .
```

Open [http://localhost:3000](http://localhost:3000)

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** > Email/Password provider
3. Create a **Firestore Database** (test mode for development)
4. (Optional) Upgrade to Blaze plan and enable **Storage** for document uploads
5. Update `js/firebase-config.js` with your project credentials
6. Create test users in Firebase Console and seed Firestore using `seed-data.html`

## Project Structure

```
├── index.html                 # Marketing site
├── login.html                 # Authentication page
├── client-dashboard.html      # Client portal
├── admin-dashboard.html       # Employee/admin portal
├── css/shared.css             # Shared dashboard styles
├── js/
│   ├── firebase-config.js     # Firebase configuration
│   ├── auth.js                # Authentication & role routing
│   ├── client-dashboard.js    # Client dashboard logic
│   └── admin-dashboard.js     # Admin dashboard logic
└── CLAUDE.md                  # Detailed project documentation
```

## User Roles

| Role | Access |
|------|--------|
| **Client** | View own milestone timeline, steward notes, and documents |
| **Employee** | Manage assigned clients, update milestones, add notes |
| **Admin** | Full access including team management |

## Design

The platform features a sophisticated design language built around:
- **Gold (#c9a96e)** — Primary accent for CTAs and highlights
- **Cream (#F0EBE3)** — Warm, inviting backgrounds
- **Charcoal (#2C2C35)** — Clean, readable typography
- **Playfair Display** — Elegant serif headings conveying trust and heritage
- **Inter** — Modern sans-serif body text for clarity

## License

All rights reserved. &copy; 2026 Legacy Stewards.
