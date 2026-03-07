# Feature 016: PR Review Round 3 — Fix All Issues

**Date:** 2026-03-07
**Commits:** b25494f..e3d665d (6 commits)

## What Was Built

Comprehensive fix pass addressing ALL findings from a 6-agent PR review of 56 commits (de99586..HEAD, ~11K lines changed).

## Commits

| Hash | Description |
|------|-------------|
| `b25494f` | DRY extraction — WindowCard, ResponseEntryGrid, shared variants |
| `5b482d9` | Security: re-validate file extension, content type, size in saveDocument |
| `56a97ed` | Error handling audit — async awaits, handleOperationError, validation |
| `decb2e9` | Type narrowing: STAGE_ACCENT_COLORS, WindowStatus.chip |
| `fc0da16` | Comment cleanup, useMemo, remove duplicate mocks, type fixes |
| `e3d665d` | Test coverage: I-140 paths, recruitment sub-stages, windows |

## Changes by Category

### Security (Critical)
- `convex/documents.ts`: saveDocument (Step 2) now re-validates extension, content type, and size server-side
- `DocumentsTab.tsx`: iframe sandbox="allow-same-origin" on both inline and fullscreen preview
- `validation.ts`: Reject empty MIME type client-side + fail-closed on magic byte read errors

### DRY Extraction (~200 lines saved)
- `WindowCard.tsx`: Shared window progress card (was triplicated across 3 tabs)
- `ResponseEntryGrid.tsx`: Shared RFI/RFE entry display (was duplicated in 2 tabs)
- `case-detail-utils.ts`: Shared `tabContainerVariants`, `BADGE_BASE_STYLE`, `STAGE_ACCENT_COLORS`
- All 6 tabs + CaseDetailPageClient now import from shared utils

### Error Handling
- `NotesTab.tsx`: All 4 mutation call sites async with try/catch/await
- `OverviewTab.tsx`: All 4 catch blocks use `handleOperationError`
- `NotificationList.tsx`: Replaced manual error pattern with `handleOperationError`
- `OnboardingProvider.tsx`: try/catch on completeChecklistItem + dismissChecklist
- `convex/documents.ts`: `recordError` replaces `console.warn` for storage delete failure

### Type Safety
- `STAGE_ACCENT_COLORS`: `Record<string, string>` → `Record<CaseStatus, string>`
- `WindowStatus.chip`: `string` → `"Filed" | "Upcoming" | "Active" | "Expired"`
- `DocumentEntry`: manual interface → derived from schema
- `JobDescriptionField`: aligned template interface with hook type, removed `as unknown as` double-cast
- Progress bar `labels`: `Record<string, string>` → `as const`

### Comment & Code Cleanup
- Fixed duplicate header sentence in `next-up-section.utils.ts`
- Updated "framer-motion" → "motion/react" in `vitest.setup.ts`
- Removed duplicate `vi.mock('motion/react')` in `CaseForm.test.tsx`
- Clarified `getStageIndex` JSDoc (closed=4)
- `NotesTab`: wrapped `visibleNotes` in `useMemo`

### Test Coverage (+8 tests)
- I-140 "Wait for Decision" path
- I-140 denial path
- Recruitment "Place Sunday Ads" sub-stage
- Recruitment "Complete Additional Recruitment" for professional occupations
- `calculateNextDeadline` past-deadline filtering
- `computeWindowStatus` zero-length window behavior

## Verification
- `pnpm typecheck`: clean (0 errors)
- `pnpm test:fast`: 1924/1924 tests pass
