# Phase 14: Schema + Design Extraction - Context

**Gathered:** 2025-12-20
**Status:** Ready for planning

> **⚠️ NOTE FOR FUTURE PHASES**
>
> Phase 17 (Design System) will use the DESIGN_TOKENS.json output from this phase. When planning/executing Phase 17, agents MUST read `.planning/FRONTEND_DESIGN_SKILL.md` (the frontend-design skill, its a plug-in) for comprehensive design requirements beyond the tokens.

<vision>
## How This Should Work

This phase extracts the existing database schema and design system into clean v2 reference documents — but with analysis and recommendations, not just a mirror of what exists.

The extraction should:
1. **Verify consistency first** — Compare test vs production schemas to catch any drift before extracting
2. **Extract with improvements** — Document what exists AND recommend fixes for v2 (naming, structure)
3. **Create ready-to-implement docs** — The outputs should be copy-paste ready for Phase 19 (schema) and Phase 17 (design)

Approach:
- Read migration files in `backend/` (source of truth)
- Run Supabase CLI dump against both test AND production databases
- Compare and reconcile any drift
- Extract the canonical schema + recommended improvements

</vision>

<essential>
## What Must Be Nailed

All three outputs matter equally:

- **Complete Convex schema ready to implement** — The schema doc should be copy-paste ready for Phase 19
- **Field mapping accuracy** — Every v1 field maps to a v2 field with zero ambiguity for migration
- **Design consistency** — Design tokens that eliminate the visual inconsistencies in v1

</essential>

<boundaries>
## What's Out of Scope

- **No implementation** — Extract and document only, don't create any Convex files or React components
- **No new features** — Document what exists + improvements, but don't add schema for unreleased features
- These are reference documents for later phases, not the implementation itself

</boundaries>

<specifics>
## Specific Ideas

- **RLS → Convex security mapping** — Document how each Supabase RLS policy translates to Convex security rules
- **Deadline field prominence** — Make deadline-related fields prominently documented since they're the core of the application
- **Test vs production verification** — Explicitly compare schemas before extraction to catch any drift
- **Use both sources** — Read migration files AND dump from databases, compare to ensure nothing is missed

</specifics>

<notes>
## Additional Context

User suspects there may be drift between test and production schemas. This needs to be verified and reconciled before extraction.

The phase should produce:
1. `CONVEX_SCHEMA.md` — All tables, types, relationships with Convex type mappings
2. `DESIGN_TOKENS.json` — Colors, spacing, typography, shadows from Tailwind config
3. `FIELD_MAPPINGS.md` — v1 snake_case → v2 camelCase mappings, renames for clarity

RLS policies need special attention since they're security-critical and must translate correctly to Convex security rules.

</notes>

---

*Phase: 14-schema-design-extraction*
*Context gathered: 2025-12-20*
