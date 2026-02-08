# Feature 006: Review

**Feature:** Professional recruitment method dates and additional entries
**Date:** 2026-02-08
**Reviewers:** 2 parallel code reviewers (backend + frontend)

## Issues Found & Resolution

### Fixed (commit d8b3848)

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| 1 | Missing aria-labels on delete buttons (SubEntriesManager + RecruitmentSection) | Accessibility | Added `aria-label` props |
| 2 | Unused `React` namespace imports in SubEntriesManager and QuickEditFields | Cleanup | Removed |
| 3 | V-PROF-02/04 comment misleading (V-PROF-04 never emitted separately) | Documentation | Clarified comment |

### Noted for Future (not blocking)

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 4 | Date formula duplicated between frontend (`getMethodDateConstraints`) and backend (`validateProfessionalMethods`) | Maintenance | Extract to shared util in future refactor |
| 5 | Method names are free-form strings in Zod schema | Type Safety | Could use `z.enum()` for compile-time safety |
| 6 | SubEntriesManager doesn't receive/display validation errors | UX | V-PROF errors surface at form level; per-field errors would improve UX |

## Verification

- TypeScript: Compiles clean
- Tests: 1695/1695 passing (including 11 V-PROF tests)
- No regressions
