# Roadmap: PERM Tracker

## Milestones

- ✅ [v1.0 Codebase Cleanup](milestones/v1.0-ROADMAP.md) (Phases 1-10 + 6.1) - SHIPPED 2025-12-20
- ✅ [v2.0.0 Complete Migration](milestones/v2.0.0-ROADMAP.md) (Phases 11-32) - SHIPPED 2026-01-15

---

## Completed Milestones

<details>
<summary>✅ v2.0.0 Complete Migration (Phases 11-32) — SHIPPED 2026-01-15</summary>

**Goal:** Complete platform rebuild from FastAPI + Supabase + Alpine.js to Next.js + Convex + React.

**Stats:**
- 22 phases (8 inserted: 17.1, 18.1, 23.1, 24.1, 25.1, 25.2)
- 95 plans completed
- 178,198 lines of TypeScript
- 3,600+ tests
- 27 days execution

**Stages:**
- Stage 1: PREP (11-14) — Feature inventory, logic extraction, schema design
- Stage 2: FOUNDATION (15-19) — Scaffold, validation core, design system, auth, schema
- Stage 3: REAL-TIME CORE (20-24) — Dashboard, case list, forms, detail, notifications
- Stage 4: SETTINGS (25, 25.1, 25.2) — Preferences, calendar sync, home page
- Stage 5: AI CHATBOT (26-28) — Chat foundation, knowledge layer, action layer
- Stage 6: PRODUCTION (31-32) — PWA, SEO, migration, go-live

**Deferred:** Phase 29 (Advanced Automation) to post-MVP

See [full archive](milestones/v2.0.0-ROADMAP.md) for details.

</details>

<details>
<summary>✅ v1.0 Codebase Cleanup (Phases 1-10 + 6.1) — SHIPPED 2025-12-20</summary>

**Goal:** Comprehensive cleanup and refactoring addressing 16 of 18 documented concerns.

**Stats:**
- 10 phases, 21 plans
- 136 files modified
- 377 tests (from 23)
- 2 days execution

See [full archive](milestones/v1.0-ROADMAP.md) for details.

</details>

---

## Progress Summary

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 Codebase Cleanup | 1-10 + 6.1 | 21 | ✅ Complete | 2025-12-20 |
| v2.0.0 Complete Migration | 11-32 | 95 | ✅ Complete | 2026-01-15 |

**Total:** 116 plans shipped across 2 milestones

---

## Deferred Work (Post-MVP)

### From Phase 29: Advanced Automation

- `bulkUpdateField` tool (update any field across multiple cases)
- `duplicateCase` tool (clone case for similar positions)
- `getAuditHistory` chatbot tool (audit logs exist, need AI wrapper)
- Workflow templates (save common action sequences)

### From Phase 9: Feature Completion (v1)

- Google Calendar two-way sync for v1 (superseded by v2)

---

## Next Milestone

Planning not started. Options:

1. **v2.1 Enhancements** — Post-MVP features from deferred work
2. **v2.1 Mobile** — Native mobile app or enhanced PWA
3. **v2.1 Multi-User** — Law firm support (shared cases)

Run `/gsd:discuss-milestone` to explore options.
