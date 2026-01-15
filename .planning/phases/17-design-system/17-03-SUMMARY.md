# 17-03 Summary: Status Components

## Completed

Created 4 PERM-specific status components in `v2/src/components/status/`:

### 1. CaseStageBadge
- Displays case status with v1-preserved colors
- Uses CSS variables from globals.css for theming
- 5 statuses: PWD (blue), Recruitment (purple), ETA 9089 (orange), I-140 (green), Closed (gray)

### 2. UrgencyIndicator
- Pulsing dot indicator for deadline urgency
- Uses Motion library for pulse animation on urgent items
- 3 levels: urgent (≤7 days, red pulse), soon (8-30 days, orange), normal (30+ days, green)
- Exports `getUrgencyLevel()` utility for calculating level from days

### 3. DeadlineIndicator
- Combines date display with urgency visualization
- Shows days until deadline, formatted date, and optional label
- Displays "OVERDUE" badge when deadline is past
- Uses date-fns for date calculations

### 4. ProgressStatusBadge
- Displays progress status with subtle styling (per perm_flow.md: "no box no color")
- 6 statuses from perm_flow.md source of truth:
  - `working` → "Working on it"
  - `waiting_intake` → "Waiting for Intake"
  - `filed` → "Filed"
  - `approved` → "Approved"
  - `under_review` → "Under Review"
  - `rfi_rfe` → "RFI/RFE"

## Deviations

- **Fixed plan during execution**: Original plan had incorrect ProgressStatus values (`not_started`, `in_progress`, `complete`, etc.). Corrected to match `perm_flow.md` source of truth and `types.ts` actual implementation.

## Files Created

- `v2/src/components/status/case-stage-badge.tsx`
- `v2/src/components/status/urgency-indicator.tsx`
- `v2/src/components/status/deadline-indicator.tsx`
- `v2/src/components/status/progress-status-badge.tsx`
- `v2/src/components/status/index.ts`

## Files Modified

- `.planning/phases/17-design-system/17-03-PLAN.md` (fixed ProgressStatus types)

## Code Review Fixes

Two issues found and fixed during code review:

1. **Accessibility**: Added `aria-hidden="true"` to pulse dot and `sr-only` span for screen reader label in UrgencyIndicator
2. **Timezone bug**: Fixed `differenceInDays` calculation by using `startOfDay(new Date())` to normalize local time, preventing off-by-one errors near midnight

## Verification

- `npm run build` - Passed
- TypeScript compilation - No errors
- All components use CSS variables for theming
- Dark mode compatible via Tailwind dark: variants
- Code review - Passed (2 issues fixed)
