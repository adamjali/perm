# Project State

## Project Summary

**PERM Tracker** — A web app for immigration attorneys to track PERM labor certification cases with automatic deadline calculations, validations, calendar sync, and AI chatbot assistance.

**Production URL:** https://permtracker.app

**Tech Stack (v2):**
- Frontend: Next.js 16 + React + TypeScript (Vercel)
- Backend: Convex (serverless functions + database)
- Auth: Convex Auth + Google OAuth
- AI: Vercel AI SDK + multi-provider (Gemini, Devstral, DeepSeek)
- Email: Resend

## Current Position

**Milestone:** v2.0.0 Complete Migration — ✅ SHIPPED 2026-01-15
**Next Milestone:** Not planned yet

Progress: ████████████████████████████████████████████████████████████████████ 100%

## Context Documents

| Document | Purpose |
|----------|---------|
| `v2/CLAUDE.md` | **DEVELOPER GUIDE** — Central PERM logic API, import patterns |
| `perm_flow.md` | **SOURCE OF TRUTH** — Case statuses, progress statuses, deadline logic |
| `.planning/MILESTONES.md` | Shipped milestones history |
| `.planning/ROADMAP.md` | Milestone overview and deferred work |

## Accumulated Context

### Key Decisions (v2.0)

| Category | Decision | Rationale |
|----------|----------|-----------|
| Stack | Next.js 16 + Convex + React | Industry standard, real-time subscriptions |
| Auth | Convex Auth (Clerk-ready) | Simple start, swap later if needed |
| AI | Vercel AI SDK 5.x + multi-provider | Fallback resilience, streaming support |
| Status | Two-tier (5+6) | Case Status + Progress Status (simpler UX) |
| Validation | Central TypeScript module | Testable, extensible, used everywhere |
| Design | Neobrutalist + Motion | Matches v1 aesthetic with modern polish |
| Testing | TDD throughout | 3,600+ tests, comprehensive coverage |

### Deferred Work (Post-MVP)

From Phase 29 (Advanced Automation):
- `bulkUpdateField` tool
- `duplicateCase` tool
- `getAuditHistory` chatbot tool
- Workflow templates

### Blockers/Concerns

None — fresh start after v2.0.0 shipped.

## Project Alignment

Last checked: 2026-01-16
Status: ✓ Aligned
Assessment: v2.0.0 shipped, ready for next milestone planning.

## Session Continuity

Last session: 2026-01-16
Stopped at: v2.0.0 milestone completion
Resume file: None
Next action: `/gsd:discuss-milestone` to plan v2.1

---

*Updated: 2026-01-16 after v2.0.0 milestone completion*
