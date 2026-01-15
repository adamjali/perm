# CLAUDE.md - PERM Tracker

**LSP Priority** (all agents have access):
- `findReferences` > grep for "find usages"
- `goToDefinition` > grep for "where defined"
- `documentSymbol` > grep for "list symbols"
- `incomingCalls`/`outgoingCalls` for call chains
- FALLBACK to Glob/Grep if LSP errors or for pattern/text search

**Quality Standards:**
- DRY/KISS: Minimal, consolidated. No duplicates. Work within existing.
- Clean code: Maintainable, abstract-able, scalable, readable.
- Token-efficient: Save context, be concise.
- **MUST use frontend-design skill (its a plug-in)** for UI work.
- Subagents get full context + these standards.

---

**Status:** Production | **Last Updated:** January 2026

## Production URLs

- **Frontend:** https://permtracker.app
- **Convex Dashboard:** https://dashboard.convex.dev

## Tech Stack

- **Frontend:** Next.js 16 + React + TypeScript (Vercel)
- **Backend:** Convex (serverless functions)
- **Database:** Convex (built-in)
- **Authentication:** Convex Auth + Google OAuth
- **Email:** Resend

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
| PERM Workflow (canonical) | [perm_flow.md](perm_flow.md) |
| Planning & Architecture | [.planning/](.planning/) |

**See [v2/CLAUDE.md](v2/CLAUDE.md) for complete developer documentation** including:
- Convex function patterns
- PERM business logic API
- Testing commands
- Notification system
- Email templates

---

## Critical Business Logic

All PERM business logic is centralized in:
- **Backend:** `v2/convex/lib/perm/`
- **Frontend:** `v2/src/lib/perm/` (re-exports)

**NEVER recreate deadline/validation logic elsewhere.**

### Key APIs

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

```bash
git add . && git commit -m "feat: feature" && git push origin main
```

---

## Resources

- **Convex:** https://docs.convex.dev
- **DOL PERM:** https://flag.dol.gov/programs/perm
- **20 CFR 656.40:** https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.40

---

**Repository:** https://github.com/adamjali/perm
