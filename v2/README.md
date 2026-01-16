# PERM Tracker v2

**Production:** https://permtracker.app
**Version:** 2.0.0 | **Last Updated:** 2026-01-16

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.1 + React 19 + TypeScript |
| **Backend** | Convex 1.31 (serverless functions) |
| **Database** | Convex (real-time subscriptions) |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Auth** | Convex Auth + Google OAuth |
| **Email** | React Email + Resend |
| **Push** | Web Push (VAPID) |
| **Testing** | Vitest (3600+ tests) + Playwright E2E |

---

## Quick Start

```bash
pnpm install

# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js dev server
pnpm dev
```

**Local URLs:**
- Frontend: http://localhost:3000
- Storybook: `pnpm storybook` → http://localhost:6006

---

## Testing

```bash
pnpm test           # Watch mode (development)
pnpm test:fast      # Quick validation (~30s)
pnpm test:run       # Full suite (~9 min, 3600+ tests)
pnpm test:e2e       # Playwright E2E tests
```

See [TEST_README.md](TEST_README.md) for complete testing guide.

---

## Project Structure

```
v2/
├── convex/              # Convex backend
│   ├── lib/perm/       # PERM business logic (canonical)
│   ├── cases.ts        # Case CRUD
│   └── schema.ts       # Database schema
├── src/
│   ├── app/            # Next.js pages
│   ├── components/     # React components
│   ├── emails/         # React Email templates
│   └── lib/perm/       # Frontend PERM re-exports
├── docs/               # Feature documentation
└── test-utils/         # Test utilities
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| **[CLAUDE.md](CLAUDE.md)** | Developer guide with API reference |
| [TEST_README.md](TEST_README.md) | Testing commands and patterns |
| [docs/API.md](docs/API.md) | Convex API reference |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Design tokens and components |

**Parent docs:** See root [README.md](../README.md) for project overview.

---

## Key Features

- **Case Management** — CRUD, duplicate detection, bulk operations, soft-delete
- **PERM Engine** — 10 calculators, 44 validators, 5 cascade rules, 100% coverage
- **Dashboard** — Real-time counts, deadline urgency, activity feed
- **Calendar** — Month/week/day views, deadline color coding
- **Notifications** — In-app, email (Resend), push (Web Push), cron reminders
- **AI Chat** — Natural language queries, case updates, regulation lookup

---

*See [CLAUDE.md](CLAUDE.md) for complete developer documentation.*
