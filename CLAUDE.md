# CLAUDE.md - PERM Tracker

**Status:** Production | **Version:** 2.0.0 | **Last Updated:** February 2026

## Production URLs

- **Frontend:** https://permtracker.app
- **Convex Dashboard:** https://dashboard.convex.dev

## Tech Stack

- **Frontend:** Next.js 16.1 + React 19 + TypeScript (Vercel)
- **Backend:** Convex 1.31 (serverless functions)
- **Database:** Convex (built-in, real-time)
- **Authentication:** Convex Auth + Google OAuth
- **Email:** Resend
- **Push Notifications:** Web Push (VAPID)
- **AI Chat:** Vercel AI SDK + Multi-provider (Gemini, OpenRouter, Groq)
- **Testing:** Vitest (3600+ tests) + Playwright (E2E)

---

## Quick Start

```bash
cd v2
pnpm install

# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js dev server
pnpm dev
```

**Test Credentials:** See `v2/.env` (gitignored)

---

## Documentation

| Topic | File |
|-------|------|
| **Developer Guide (PRIMARY)** | [v2/CLAUDE.md](v2/CLAUDE.md) |
| **API Reference** | [v2/docs/API.md](v2/docs/API.md) |
| Design System | [v2/docs/DESIGN_SYSTEM.md](v2/docs/DESIGN_SYSTEM.md) |
| Animation Catalog | [v2/docs/ANIMATION_STORYBOARD.md](v2/docs/ANIMATION_STORYBOARD.md) |
| PERM Workflow (canonical) | [perm_flow.md](perm_flow.md) |
| Testing Guide | [v2/TEST_README.md](v2/TEST_README.md) |
| Codebase Architecture | [.planning/codebase/](.planning/codebase/) |
| Planning & Roadmap | [.planning/](.planning/) |

**See [v2/CLAUDE.md](v2/CLAUDE.md) for complete developer documentation.**

---

## Critical Business Logic

All PERM business logic is centralized in:
- **Backend:** `v2/convex/lib/perm/`
- **Frontend:** `v2/src/lib/perm/` (re-exports)

**NEVER recreate deadline/validation logic elsewhere.**

```typescript
import {
  calculatePWDExpiration,
  validateCase,
  applyCascade,
  isRecruitmentComplete,
} from '@/lib/perm';
```

---

## Testing

```bash
cd v2
pnpm test          # Watch mode (development)
pnpm test:fast     # Quick validation (~30s)
pnpm test:run      # Full suite (~9 min)
```

**3600+ tests** | 100% coverage on PERM logic

---

## Deployment

Push to main triggers auto-deploy:
- **Vercel:** Frontend rebuild
- **Convex:** Backend sync

---

## Resources

- **Convex:** https://docs.convex.dev
- **DOL PERM:** https://flag.dol.gov/programs/perm
- **20 CFR 656.40:** https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.40

---

**Repository:** https://github.com/adamjali/perm
