# Phase 13: Core Logic Extraction - Context

**Gathered:** 2025-12-20
**Status:** Ready for research

<vision>
## How This Should Work

These documents should be a **complete rule reference** — so comprehensive that during the migration, I never need to read the old FastAPI code again. Everything needed to rebuild the app correctly lives in these three documents.

The documents capture every business rule, validation, and deadline calculation. They're organized in whatever structure works best for the migration (by feature area, data flow, or regulation source — Claude will figure out the optimal structure).

</vision>

<essential>
## What Must Be Nailed

All of these are equally essential — no compromises:

- **Deadline calculations** — PWD expiration, ETA 9089 windows, I-140 deadlines — the heart of the app
- **Validation rules** — Cross-field validations, date constraints, what makes a case "valid"
- **All 229 features captured** — Nothing lost. Every behavior documented so the new stack is feature-complete
- **PERM regulation accuracy** — Verified against official sources (20 CFR § 656.40). The app must be legally correct

</essential>

<boundaries>
## What's Out of Scope

Claude decides appropriate boundaries based on what serves the migration. Natural boundaries include:

- UI/design details (Phase 14, 17)
- Implementation code (just documentation, no TypeScript yet)
- Convex schema design (Phase 14)

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — open to best approach for organization and format. The goal is comprehensiveness and accuracy.

</specifics>

<notes>
## Additional Context

- Phase is flagged for research: must verify PERM regulations against official sources before documenting
- 377 tests in backend encode behaviors that should be cross-referenced
- V2_FEATURE_INVENTORY.md has 229 features to ensure complete coverage
- CLAUDE.md already documents key deadline calculations — good starting point

</notes>

---

*Phase: 13-core-logic-extraction*
*Context gathered: 2025-12-20*
