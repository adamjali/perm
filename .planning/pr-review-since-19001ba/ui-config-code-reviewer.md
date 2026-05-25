# UI + Config/Observability Code Review — since `19001ba`

**Reviewer:** ui-config-code-reviewer (Opus 4.7, 1M)
**Scope:** UI (cases/forms/timeline detail) + config/observability (Sentry/PostHog/BotID/next.config/CI/semgrep)
**Verdict:** Ship-ready. No CRITICAL or IMPORTANT (≥80 confidence) issues. Several correct, well-reasoned modernizations. A few low-confidence suggestions below threshold are noted for completeness.

---

## Files reviewed

UI:
- `v2/src/app/(authenticated)/cases/[id]/CaseDetailPageClient.tsx` (+10: `handleSaveRecruitmentText`)
- `v2/src/components/cases/detail/OverviewTab.tsx` (recruitment card wiring, mobile QuickStats gating, complex-action navigation)
- `v2/src/components/cases/detail/RecruitmentResultsCard.tsx` (NEW, 461 lines)
- `v2/src/components/cases/detail/RecruitmentChecklist.tsx` (DELETED — superseded)
- `v2/src/components/cases/detail/index.ts` (+1 export)
- `v2/src/components/cases/detail/next-up-section.components.tsx` (removed `NextActionCard` + expand variants)
- `v2/src/components/forms/DateInput.tsx`, `FormField.tsx` (overflow→clip-path for hard shadows)
- `v2/src/components/forms/sections/ProfessionalSection.tsx` (DELETED — dead code)
- `v2/src/components/forms/sections/RecruitmentSection.tsx` (comment only)
- `v2/src/lib/forms/case-form-schema.ts` (validation gating change)

Config:
- `.github/workflows/claude-code-review.yml`, `claude.yml`, `.semgrepignore` (NEW)
- `v2/.env.example`, `v2/next.config.ts`
- `v2/instrumentation-client.ts` (DELETED, root) → `v2/src/instrumentation-client.ts` (NEW, merged PostHog+BotID)
- `v2/sentry.client.config.ts` (DELETED), `v2/src/components/layout/SentryClientInit.tsx`, `v2/src/lib/sentry.ts`

---

## CRITICAL (90–100)

None.

## IMPORTANT (80–89)

None.

---

## SUGGESTIONS (below the 80 report threshold — informational only)

### S1 — `next-up-main` clickable div not keyboard-accessible (confidence 55, PRE-EXISTING)
`OverviewTab.tsx:233-240` — the `<div className="next-up-main" onClick={...}>` (now navigates on complex actions or expands on editable ones) has no `role="button"`, `tabIndex={0}`, or `onKeyDown`. Mouse-only. **This predates the PR** (the `onClick`/expand pattern existed at `19001ba`; the diff only added the `navigateUrl` branch to the existing handler), so it is not a regression introduced here. If touched again, add `role="button" tabIndex={0}` + Enter/Space handler, or render an `<a href={navigateUrl}>`/`<button>`.

### S2 — Recruitment required-date validation now gated on `isProfessionalOccupation` (confidence 50)
`case-form-schema.ts:254-260` moved `validateRecruitmentMethodRequiredDates(data, ctx)` inside `if (data.isProfessionalOccupation)`. Combined with `RecruitmentSection.tsx:239` ("data preserved on re-check" — unchecking the professional box does NOT clear `additionalRecruitmentMethods`), a user could fill methods with missing dates, then uncheck professional, and the incomplete rows skip validation. **Not a real-world correctness bug**: the methods UI is fully gated behind `isProfessionalOccupation` (`RecruitmentSection.tsx:651`) and `resultsGenerator.ts:402-404` only emits those methods when professional — so orphaned rows are never displayed/used for non-professional cases. Verified consistent. Optional hardening: clear `additionalRecruitmentMethods` on uncheck, OR keep the validator unconditional (it already no-ops on empty `method`).

### S3 — `.semgrepignore` consumed by external integration only (confidence 40, informational)
No `.github` workflow references Semgrep, so this file is read by an external Semgrep GitHub App or local runs. File is well-formed. Note modern Semgrep increasingly prefers `.gitignore`/`--exclude`, but `.semgrepignore` is still honored. No action needed.

---

## Strengths / things verified correct

1. **Sentry v10 config migration is correct (modernization).** Verified via context7 against `@sentry/nextjs ^10.53.1`: `disableLogger` → `webpack.treeshake.removeDebugLogging: true` and `automaticVercelMonitors` → `webpack.automaticVercelMonitors: true` is exactly the documented v10 API. `hideSourceMaps` correctly stays top-level. (`next.config.ts:155-175`)
2. **instrumentation-client merge is sound and the comment is accurate.** Next.js loads exactly one `instrumentation-client` file; with `src/` present, `src/instrumentation-client.ts` wins and a root one is ignored. Merging PostHog + BotID `initBotId` into the single `src/` file is the correct fix for the "BotID silently dropped PostHog" regression. Each initializer is independently try/caught so one failure can't break the module's side-effect import. (`src/instrumentation-client.ts`)
3. **Deleting `sentry.client.config.ts` is safe.** It was an intentionally-empty no-op; Sentry is lazy-initialized via dynamic `import("@sentry/nextjs")` in `SentryClientInit.tsx:33-35`, preserving the ~287KB bundle-size win on public pages. No dangling references found.
4. **Revert/clear flow is wired end-to-end and correct.** `RecruitmentResultsCard` passes `null` to `onSaveCustomText` → `handleSaveRecruitmentText` → `updateMutation({ recruitmentSummaryCustom: null })`. The mutation arg is typed `v.union(v.string(), v.null())` (`cases.ts:831`) and the handler converts `null → undefined` for `db.patch` ("clear this field", `cases.ts:967-970`). Length-validated (`cases.ts:943`). Schema field exists (`schema.ts:337`).
5. **Central PERM-lib rule honored.** `RecruitmentResultsCard` imports `generateRecruitmentResultsText`, `calculateRecruitmentStatus`, `formatFilingWindowRange` from `@/lib/recruitment` and `isRecruitmentComplete` from `@/lib/perm`. No deadline/validation/cascade/date math recreated in UI. ISO-string date protocol respected (`fmtISODate`/`fmtISOShort`).
6. **`@/lib/toast` used (not `sonner`); `handleOperationError` used for all error paths.** Compliant with CLAUDE.md anti-patterns.
7. **No SWC `??`/`?.` minifier footgun.** Scanned all new/changed files (RecruitmentResultsCard, instrumentation-client, next.config, OverviewTab) — no dense nullish/optional-chain expressions; uses `||` per project rule.
8. **React 19 correctness in `RecruitmentResultsCard`.** All callbacks memoized with correct deps; auto-resize `useEffect` deps `[isEditing, editValue]` correct; AnimatePresence copy-icon swap keyed (`key="check"/"copy"`); `setTimeout` focus is acceptable for post-mount focus. No stale-closure or missing-dep issues. Save button correctly disabled on empty input; revert handled separately via dialog.
9. **`QuickStatsPanel` mobile gating is not a regression.** Desktop renders inline (`OverviewTab.tsx:383`); mobile renders in the dedicated mobile block (`OverviewTab.tsx:616`). No duplication, no loss on mobile.
10. **Dead-code removal is clean.** `NextActionCard` (removed from `next-up-section.components.tsx`) has no remaining importers (only a stale doc comment in `quick-edit/index.ts`). `ProfessionalSection.tsx` / `RecruitmentChecklist.tsx` deletions verified unreferenced.
11. **next.config `/ingest/array/:path*` rewrite is correct** — routes lazy posthog-js bundles (toolbar/surveys/replay/array config) to `us-assets.i.posthog.com` before the catch-all; matches PostHog's current asset layout. CSP additions for `challenges.cloudflare.com` (BotID/Turnstile) added consistently to `script-src`, `connect-src`, and `frame-src`. `withBotId(withSerwist(nextConfig))` wrap order is correct.
12. **CI workflow upgrade is correct.** `fetch-depth: 0` needed for full-diff review; `ready_for_review`/`reopened` triggers sensible; Bot-author skip rationale accurate (Dependabot secret isolation); pinned `--model claude-opus-4-7` per user preference; plugin-based `/code-review` migration valid.
13. **`FormField`/`DateInput` `overflow-hidden` → `[clip-path:inset(-5px)]`** correctly expands the visible area so neobrutalist 4px hard shadows aren't clipped while still containing the shake animation. Good CSS reasoning, documented inline.
