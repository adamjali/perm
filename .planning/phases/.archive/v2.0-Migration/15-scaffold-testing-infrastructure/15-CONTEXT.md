# Phase 15: Scaffold + Testing Infrastructure - Context

**Gathered:** 2025-12-20
**Status:** Ready for research

<vision>
## How This Should Work

A completely fresh v2 folder at the project root (`v2/`) that's self-contained and independent from the existing v1 code. The v1 `backend/` and `frontend/` folders stay untouched throughout v2 development - they're the production system and reference implementation.

When this phase is done, we should have:
- Next.js 14+ with App Router running locally
- Convex connected and working
- Vitest ready for unit/integration tests
- Playwright ready for E2E tests
- TypeScript strict mode from day one
- Everything wired up and verified with basic "hello world" tests

The scaffold should feel solid and ready to build on. TDD infrastructure is just as important as the app structure itself.

</vision>

<essential>
## What Must Be Nailed

- **Testing infrastructure first** - Vitest + Playwright configured and verified before any real code. TDD from day one as specified in project requirements.
- **Convex working smoothly** - Dev environment solid, can create/read data, subscriptions work. This is the new backend.
- **All pieces connected** - Next.js + Convex + tests all wired up. Each piece verified working with the others.

All three are equally essential - this is the foundation everything else builds on.

</essential>

<boundaries>
## What's Out of Scope

- No UI components - that's Phase 17 (Design System)
- No auth setup - that's Phase 18 (Auth)
- No Convex schema beyond test tables - that's Phase 19 (Schema + Security)
- No actual feature code - just infrastructure
- MCP servers if they add complexity - can add later as needed

</boundaries>

<specifics>
## Specific Ideas

- **Project structure:** `v2/` at project root, sibling to `backend/` and `frontend/`
- **Package manager:** Open to recommendations (npm, pnpm, etc.)
- **v1 fate:** Stays untouched during v2 development, archived/deleted after Phase 32 go-live

```
perm-tracker-test/
├── backend/          # v1 FastAPI (untouched)
├── frontend/         # v1 Alpine.js (untouched)
├── v2/               # NEW: Next.js + Convex + React
│   ├── src/
│   ├── convex/
│   ├── tests/
│   └── package.json
└── .planning/        # Shared planning docs
```

</specifics>

<notes>
## Additional Context

- Phase has research flag - need to verify latest Next.js + Convex patterns before planning
- TypeScript strict mode required (from STATE.md: "no `any` types")
- 377 test behaviors from v1 will need to be replicated - test infrastructure must support this scale
- v1 serves as living documentation and fallback throughout migration

</notes>

---

*Phase: 15-scaffold-testing-infrastructure*
*Context gathered: 2025-12-20*
