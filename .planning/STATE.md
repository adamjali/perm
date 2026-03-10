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

### Features Completed

| # | Description | Date | Commits | Directory |
|---|-------------|------|---------|-----------|
| 010 | Deadline Notification System Fixes | 2026-02-14 | 193b679..9799e49 | [010-deadline-notification-system-fixes](./features/010-deadline-notification-system-fixes/) |
| 016 | PR Review Round 3 — Fix All Issues | 2026-03-07 | b25494f..e3d665d | [016-pr-review-round-3-fix-all](../v2/.planning/features/016-pr-review-round-3-fix-all/) |
| 017 | PR Review Round 4 — Fix All Remaining | 2026-03-07 | 3079449..16bbadf | [017-pr-review-round-4-fix-all](../v2/.planning/features/017-pr-review-round-4-fix-all/) |
| 018 | Case Form UX Simplification + Tutorial Revamp | 2026-03-10 | 86832e3..985e79f | [018-case-form-ux-tutorial-revamp](../v2/.planning/features/018-case-form-ux-tutorial-revamp/) |

### Blockers/Concerns

None — fresh start after v2.0.0 shipped.

## Project Alignment

Last checked: 2026-01-16
Status: ✓ Aligned
Assessment: v2.0.0 shipped, ready for next milestone planning.

## Session Continuity

Last activity: 2026-03-10 - Deployed feature 018 to production
Last session: 2026-03-10
Stopped at: Feature 018 deployed — Convex + Vercel production
Resume file: None
Next action: None — ready for next task

---

*Updated: 2026-03-10 after feature 018 deployment*
