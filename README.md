# PERM Tracker

**Free, modern case management for immigration attorneys tracking Permanent Labor Certification (PERM) cases.**

![Status](https://img.shields.io/badge/Status-Production-success?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%2B%20Convex-blue?style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-3600%2B%20Passing-brightgreen?style=for-the-badge)

---

## Live Application

**URL:** https://permtracker.app

**Test Credentials:** See `v2/.env` (gitignored)

---

## Features

### Core Functionality
- **Full CRUD Case Management** - Create, read, update, delete PERM cases
- **Smart Date Validation** - Automatic validation per 20 CFR 656.40(c) regulations
- **Auto-Calculations** - PWD expiration, ETA 9089 windows, I-140 deadlines
- **Cascade Logic** - Dependent dates auto-calculate when source fields change
- **RFI/RFE Tracking** - Request for Information/Evidence entries with due dates
- **Notifications** - Real-time in-app notifications with email delivery

### User Experience
- **Beautiful Dashboard** - Case statistics, upcoming deadlines, recent activity
- **Privacy Mode** - One-click anonymization for screen sharing
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark/Light Mode** - User preference persisted
- **PWA Support** - Installable progressive web app

### Security & Authentication
- **Convex Auth** - Secure authentication with Convex
- **Google OAuth** - One-click sign-in with Google
- **Row-Level Security** - Database-level access control via Convex
- **Activity Tracking** - Inactivity timeout for security

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 + React + TypeScript |
| **Backend** | Convex (serverless functions) |
| **Database** | Convex (built-in) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Authentication** | Convex Auth + Google OAuth |
| **Email** | Resend |
| **Push Notifications** | Web Push (VAPID) |
| **Hosting** | Vercel (frontend) + Convex Cloud (backend) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Local Development

```bash
# Navigate to v2 directory
cd v2

# Install dependencies
pnpm install

# Start Convex dev server (Terminal 1)
npx convex dev

# Start Next.js dev server (Terminal 2)
pnpm dev
```

**Local URLs:**
- Frontend: http://localhost:3000
- Convex Dashboard: https://dashboard.convex.dev

### Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```env
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

Server-side secrets (Convex Dashboard):
- `RESEND_API_KEY` - Email delivery
- `VAPID_PRIVATE_KEY` - Push notifications
- `JWT_PRIVATE_KEY` - Auth tokens

---

## Testing

### Test Commands

| Command | Description | Time |
|---------|-------------|------|
| `pnpm test` | Watch mode (development) | Instant |
| `pnpm test:fast` | Unit + PERM tests only | ~30s |
| `pnpm test:run` | Full suite (CI) | ~9 min |
| `pnpm test:e2e` | Playwright E2E tests | ~2 min |

### Coverage

- **3600+ tests** passing
- **100% coverage** on PERM business logic
- Component, hook, and integration tests included

---

## Project Structure

```
v2/
├── convex/                  # Convex backend
│   ├── lib/perm/           # Central PERM business logic
│   ├── cases.ts            # Case CRUD
│   ├── notifications.ts    # Notifications
│   ├── scheduledJobs.ts    # Cron jobs
│   └── schema.ts           # Database schema
├── src/
│   ├── app/                # Next.js pages
│   ├── components/         # React components
│   └── lib/perm/           # Frontend re-exports
└── test-utils/             # Test utilities
```

---

## Documentation

- **[v2/CLAUDE.md](v2/CLAUDE.md)** - Developer guide with API reference
- **[perm_flow.md](perm_flow.md)** - PERM process workflow (canonical source)
- **[.planning/](/.planning)** - Architecture and planning docs

---

## Deployment

### Automatic Deployment

Push to main branch triggers:
- **Vercel:** Frontend rebuild and deploy
- **Convex:** Backend functions sync

```bash
git add .
git commit -m "feat: your feature"
git push origin main
```

### Manual Convex Deploy

```bash
cd v2
npx convex deploy --prod
```

---

## Security

- **Convex Auth** - Secure session management
- **Row-Level Security** - Users only access their own data
- **HTTPS** - Enforced in production
- **Activity Timeout** - Auto-logout after inactivity

---

## License

This project is free to use for immigration attorneys and law firms.

---

## Acknowledgments

- **DOL PERM Program:** https://flag.dol.gov/programs/perm
- **20 CFR 656.40:** PERM regulations
- **Convex:** Serverless backend platform
- **Vercel:** Frontend hosting

---

**Built with Claude Code**
**Last Updated:** January 2026
**Version:** 2.0
