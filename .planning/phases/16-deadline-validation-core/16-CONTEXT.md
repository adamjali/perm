# Phase 16: Deadline & Validation Core - Context

**Gathered:** 2025-12-22
**Status:** Ready for research

<vision>
## How This Should Work

An "isomorphic engine" — a centralized TypeScript logic library that acts as the **single source of truth** for both client (React) and server (Convex).

The engine is layered:
1. **Pure Math** (calculators): Stateless date calculations using a date library
2. **Validation** (schemas): Cross-field rules implementing 44+ regulatory requirements
3. **Cascade** (reducer): A state transition function `(currentCase, change) => newCase` that recalculates downstream dependencies in real-time
4. **Utilities**: Holiday logic for business day calculations

When a user changes PWDDD, the cascade reducer instantly recalculates PWDED → which recalculates all recruitment deadlines → which updates validation states. This happens client-side for instant feedback AND server-side for authoritative validation.

**Date protocol:**
- Storage/API: ISO strings (`YYYY-MM-DD`)
- Logic: Accept strings, parse to Date, perform math, return strings
- Timezones: **Ignored.** Dates are absolute calendar values. A deadline is a deadline regardless of where the attorney sits.

</vision>

<essential>
## What Must Be Nailed

- **Date accuracy is paramount.** This is an immigration legal tool. Off-by-one errors cause visa denials.
- **All 44 validation rules** from V2_VALIDATION_RULES.md implemented and tested
- **Cascade recalculation** works correctly: upstream changes propagate to downstream fields
- **377 test behaviors** ported from v1 Python tests (or equivalent coverage)
- **"Extend-only" fields** enforced: Notice end (10 biz days minimum), Job order end (30 calendar days minimum) can extend but not shorten
- **RFI due date is strict 30 days** — NOT editable (regulatory requirement)
- **Business day calculations** include all federal holidays + Inauguration Day (Jan 20 every 4 years)

</essential>

<boundaries>
## What's Out of Scope

- UI components — that's Phase 17 (Design System)
- Form integration / form components — Phase 22 (Case Forms)
- Error message display styling — Phase 17
- Database schema creation — Phase 19 (Schema + Security)
- Actual Convex mutations/queries using validators — Phase 19+

**This phase delivers pure logic:**
- TypeScript functions that can run anywhere (client or server)
- Comprehensive test suite proving correctness
- No UI, no database integration, no Convex-specific code

</boundaries>

<specifics>
## Specific Ideas

**Architecture (from master prompt inspiration):**
- Location: `v2/src/lib/perm-engine/` (or similar)
- `holidays.ts` — math-based federal holiday detection (no external APIs)
- `calculators/*.ts` — pure date math (PWD expiration, recruitment windows, etc.)
- `schemas.ts` — Zod schemas with `.superRefine` for cross-field rules
- `registry.ts` or `reducer.ts` — the public API / cascade reducer

**Key formulas (from perm_flow.md):**
- Notice deadline: `min(first+150, pwded-30)`
- Job order deadline: `min(first+120, pwded-60)`
- 1st Sunday: `lastSunday(min(first+143, pwded-37))`
- 2nd Sunday: `lastSunday(min(first+150, pwded-30))`
- PWD expiration: 90 days if Apr 2-Jun 30, else upcoming Jun 30

**Libraries to evaluate during research:**
- date-fns vs. alternatives for date math
- Zod vs. alternatives for validation schemas
- Confirm these work well with Convex

</specifics>

<notes>
## Additional Context

**Port and refine:**
User wants to port v1 Python logic as baseline, but refine as we go — improve clarity, handle edge cases better, while maintaining same outcomes.

**Reference documents (canonical):**
- `V2_ORIGINAL_VISION.md` — user requirements (the real source of truth)
- `V2_DEADLINE_FLOWS.md` — exact formulas
- `V2_VALIDATION_RULES.md` — 44 validation rules
- `V2_BUSINESS_RULES.md` — PERM process, stage progression
- `perm_flow.md` — raw user notes with edge cases

**Phase flags:**
- Research required before planning (edge cases, library choices)
- TDD mandatory — tests before code

**Key edge cases from user notes:**
- Only one active RFI/RFE at a time
- Sunday ads must be at least 1 week apart, both on Sundays
- Job order 30-day posting is part of the step itself
- Cascade: PWDDD change → PWDED → all recruitment deadlines
- "Extend only" for Notice/Job order end dates

</notes>

---

*Phase: 16-deadline-validation-core*
*Context gathered: 2025-12-22*
