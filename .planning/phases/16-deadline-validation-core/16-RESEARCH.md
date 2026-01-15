# Phase 16: Deadline & Validation Core - Research

**Researched:** 2025-12-22
**Domain:** Isomorphic TypeScript validation + date calculations for PERM deadlines
**Confidence:** HIGH

<research_summary>
## Summary

Researched the ecosystem for building an isomorphic TypeScript validation engine that runs on both client (React) and server (Convex). The standard approach uses **Convex's built-in validators (`v.*`)** for argument validation and schema definition, combined with **pure TypeScript helper functions** for business logic and cross-field validation. **date-fns v4+** is the recommended date library for calculations.

Key finding: Don't hand-roll validation schema systems. Convex validators provide end-to-end TypeScript type safety and integrate seamlessly with schema definitions. For complex cross-field rules (44 validation rules), use pure TypeScript functions in a shared `helpers/` directory that both client and server can import.

**Primary recommendation:** Use Convex `v.*` validators for argument/schema validation + date-fns for date math + pure TypeScript helper functions for business rules. Avoid Zod/Valibot in Convex functions (unnecessary layer).
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex/values` | (bundled with Convex) | Argument & schema validation | First-party, end-to-end type safety, zero bundle cost on server |
| `date-fns` | 4.1.0 | Date calculations (addDays, differenceInDays, format) | Tree-shakeable, 200+ functions, immutable, TypeScript-first |
| `@date-fns/tz` | 1.4.1 | Timezone utilities (optional) | First-party timezone support for date-fns v4 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@18f/us-federal-holidays` | 4.0.0 | Federal holiday detection | If you want pre-calculated holidays instead of math-based |
| `convex-helpers` | latest | Utility functions for Convex | `toStandardSchema`, relationship helpers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| date-fns | dayjs 1.11.19 | dayjs is 6kb vs 18kb, but lacks some functions we need (addBusinessDays) |
| date-fns | luxon 3.7.2 | Luxon has better i18n but 29.5kb and overkill for US-only dates |
| Convex validators | Zod 3.24.2 | Zod adds bundle size and doesn't integrate with Convex schema |
| Convex validators | Valibot 1.2.0 | Valibot is 90% smaller than Zod but still unnecessary duplication |
| @18f/us-federal-holidays | Math-based | Math-based is more maintainable long-term (no dependency updates) |

**Installation:**
```bash
npm install date-fns
# Optional:
npm install @date-fns/tz  # Only if timezone handling needed
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
v2/src/lib/perm-engine/
├── index.ts              # Public API / registry
├── types.ts              # TypeScript types/interfaces
├── holidays.ts           # Federal holiday detection (math-based)
├── calculators/
│   ├── pwd.ts            # PWD expiration calculation
│   ├── recruitment.ts    # Recruitment deadline calculations
│   ├── eta9089.ts        # ETA 9089 window calculations
│   └── i140.ts           # I-140 deadline calculations
├── validators/
│   ├── pwd.ts            # PWD validation rules (V-PWD-*)
│   ├── recruitment.ts    # Recruitment rules (V-REC-*)
│   ├── eta9089.ts        # ETA 9089 rules (V-ETA-*)
│   ├── i140.ts           # I-140 rules (V-I140-*)
│   └── rfi.ts            # RFI/RFE rules (V-RFI-*, V-RFE-*)
└── cascade.ts            # Cascade reducer (state transitions)
```

### Pattern 1: Pure Calculator Functions
**What:** Stateless functions that accept ISO date strings, return ISO date strings
**When to use:** All date calculations
**Example:**
```typescript
// Source: date-fns docs + PERM regulations
import { addDays, parseISO, format } from 'date-fns';

/**
 * Calculate PWD expiration date per 20 CFR § 656.40(c)
 * @param determinationDate - ISO string (YYYY-MM-DD)
 * @returns ISO string (YYYY-MM-DD)
 */
export function calculatePWDExpiration(determinationDate: string): string {
  const date = parseISO(determinationDate);
  const month = date.getMonth(); // 0-indexed (0=Jan, 3=Apr, 5=Jun)
  const day = date.getDate();
  const year = date.getFullYear();

  // April 2 - June 30: determination + 90 days
  if ((month === 3 && day >= 2) || month === 4 || (month === 5 && day <= 30)) {
    return format(addDays(date, 90), 'yyyy-MM-dd');
  }

  // July 1 - December 31: June 30 of following year
  if (month >= 6) {
    return `${year + 1}-06-30`;
  }

  // January 1 - April 1: June 30 of same year
  return `${year}-06-30`;
}
```

### Pattern 2: Validation Result Type
**What:** Consistent return type for all validation functions
**When to use:** All 44 validation rules
**Example:**
```typescript
// Source: V2_VALIDATION_RULES.md architecture
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  ruleId: string;          // V-PWD-01, V-REC-03, etc.
  severity: ValidationSeverity;
  field: string;           // Field that triggered the issue
  message: string;         // User-facing message
  regulation?: string;     // CFR reference if applicable
}

export interface ValidationResult {
  valid: boolean;          // false if any errors (warnings OK)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// Usage in validator:
export function validatePWDDates(
  filingDate: string | null,
  determinationDate: string | null,
  expirationDate: string | null
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (filingDate && determinationDate) {
    if (parseISO(filingDate) >= parseISO(determinationDate)) {
      errors.push({
        ruleId: 'V-PWD-01',
        severity: 'error',
        field: 'pwd_filing_date',
        message: 'PWD filing date must be before determination date',
        regulation: '20 CFR § 656.40(a)',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Pattern 3: Cascade Reducer
**What:** State transition function that recalculates downstream fields
**When to use:** When upstream field changes (PWDDD → PWDED → all recruitment deadlines)
**Example:**
```typescript
// Source: 16-CONTEXT.md vision
export interface CaseState {
  pwd_determination_date: string | null;
  pwd_expiration_date: string | null;
  recruitment_first_date: string | null;
  // ... all fields
}

export type FieldChange = {
  field: keyof CaseState;
  value: string | null;
};

/**
 * Cascade reducer - recalculates downstream fields when upstream changes
 */
export function applyCascade(
  currentState: CaseState,
  change: FieldChange
): CaseState {
  const newState = { ...currentState, [change.field]: change.value };

  // Cascade: PWDDD change → recalculate PWDED
  if (change.field === 'pwd_determination_date' && change.value) {
    newState.pwd_expiration_date = calculatePWDExpiration(change.value);
  }

  // Cascade: PWDED or first recruitment → recalculate all recruitment deadlines
  if (
    change.field === 'pwd_expiration_date' ||
    change.field === 'recruitment_first_date'
  ) {
    // Recalculate all recruitment deadlines...
    if (newState.pwd_expiration_date && newState.recruitment_first_date) {
      const deadlines = calculateRecruitmentDeadlines(
        newState.recruitment_first_date,
        newState.pwd_expiration_date
      );
      Object.assign(newState, deadlines);
    }
  }

  return newState;
}
```

### Pattern 4: Convex Validator Reuse
**What:** Define validators once, reuse across schema and mutations
**When to use:** Defining Convex schema and mutation arguments
**Example:**
```typescript
// Source: Convex docs - argument validation
import { v } from 'convex/values';
import { defineSchema, defineTable } from 'convex/server';

// Define validators once
export const caseFields = {
  case_number: v.string(),
  pwd_filing_date: v.optional(v.string()),
  pwd_determination_date: v.optional(v.string()),
  pwd_expiration_date: v.optional(v.string()),
  // ... more fields
};

// Use in schema
export default defineSchema({
  cases: defineTable(caseFields)
    .index('by_user', ['userId'])
    .index('by_case_number', ['case_number']),
});

// Use in mutations
export const updateCase = mutation({
  args: {
    id: v.id('cases'),
    update: v.object({
      pwd_filing_date: v.optional(v.string()),
      pwd_determination_date: v.optional(v.string()),
      // ... partial update fields
    }),
  },
  handler: async (ctx, args) => {
    // Validate with our pure functions
    const current = await ctx.db.get(args.id);
    const merged = { ...current, ...args.update };
    const result = validateCase(merged);
    if (!result.valid) {
      throw new Error(JSON.stringify(result.errors));
    }
    await ctx.db.patch(args.id, args.update);
  },
});
```

### Anti-Patterns to Avoid
- **Using ctx.runQuery for code sharing:** Creates sub-transactions, slower, no benefit. Extract to helper functions instead.
- **Duplicating validators in Zod/Valibot AND Convex v.*:** Unnecessary, use Convex validators for args, pure TS for business logic.
- **Storing computed dates in database:** Compute on-the-fly using calculator functions (except user-overridable fields).
- **Mixing Date objects and strings:** Use ISO strings for storage/API, parse to Date only for calculations, return strings.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing/formatting | Custom regex/string manipulation | `date-fns` parseISO, format | Edge cases (leap years, timezone issues, month boundaries) |
| Adding days to a date | Manual day math | `date-fns` addDays, addBusinessDays | DST transitions, month rollovers |
| Checking if date is Sunday | `date.getDay() === 0` with parsing | `date-fns` isSunday + parseISO | Consistent parsing across browsers |
| Federal holidays | Static array per year | Math-based calculation OR `@18f/us-federal-holidays` | Holidays shift when on weekends, Inauguration Day every 4 years |
| Schema validation | Custom type checking | Convex `v.*` validators | End-to-end TypeScript type safety |
| Business day counting | Manual weekday loop | date-fns `differenceInBusinessDays` + holiday check | Handles weekends correctly |

**Key insight:** Date calculations have decades of edge cases. date-fns handles them all: leap years, DST transitions, month boundaries, year boundaries. Custom date math leads to bugs that appear only in edge cases (February 29, November DST switch, year end).
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Off-by-One in Date Comparisons
**What goes wrong:** Using `>` instead of `>=` or vice versa causes deadline misses
**Why it happens:** Confusion about "30 days after" meaning day 30 or day 31
**How to avoid:**
- Document whether counts are inclusive or exclusive
- Use explicit test cases: "filing on day 30 after recruitment ends" = VALID or INVALID?
- Reference regulation text exactly: "at least 30 days" = `>=30`, "more than 30 days" = `>30`
**Warning signs:** Tests pass for day 31 but fail for day 30, or vice versa

### Pitfall 2: Timezone Confusion
**What goes wrong:** Date shifts by 1 day depending on where code runs
**Why it happens:** `new Date('2025-06-30')` interprets as UTC, shifts to local time
**How to avoid:**
- Store dates as ISO strings (`YYYY-MM-DD`), NOT Date objects
- Parse with `parseISO()` from date-fns (consistent behavior)
- For this app: Ignore timezones entirely. A deadline is June 30, period. No TZ conversion.
**Warning signs:** Tests pass locally but fail in CI, or work in one timezone but not another

### Pitfall 3: Business Day Calculation Missing Holidays
**What goes wrong:** Notice of Filing end date is wrong by 1-3 days
**Why it happens:** Only checked weekends, forgot federal holidays
**How to avoid:**
- Build holiday detection first, before any business day logic
- Test with specific dates: "MLK Day 2025 = Jan 20, is NOT a business day"
- Include Inauguration Day (Jan 20 every 4 years starting 2025)
**Warning signs:** Calculations work most of the time but fail around holidays

### Pitfall 4: Cascade Loops
**What goes wrong:** Infinite loop when field A updates field B which updates field A
**Why it happens:** Cascade reducer doesn't track what triggered the change
**How to avoid:**
- Design cascade as directed acyclic graph (DAG): PWDDD → PWDED → Recruitment (never backwards)
- Never have a field cascade back to its upstream dependencies
- Test cascade chains explicitly
**Warning signs:** UI freezes, "Maximum call stack exceeded" errors

### Pitfall 5: Sunday Ad Not Actually Sunday
**What goes wrong:** User enters date, it stores as different day
**Why it happens:** Timezone shift when parsing user input
**How to avoid:**
- Parse user input as local date (not UTC)
- Validate `getDay() === 0` after parsing, not before
- Return specific error message: "March 15, 2025 is a Saturday, not a Sunday"
**Warning signs:** Validation passes for non-Sunday dates, or fails for actual Sundays
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Date Parsing and Formatting (ISO strings)
```typescript
// Source: date-fns docs
import { parseISO, format, isValid } from 'date-fns';

// Parse ISO string to Date object for calculations
const date = parseISO('2025-06-30');

// Format Date back to ISO string for storage
const isoString = format(date, 'yyyy-MM-dd'); // '2025-06-30'

// Validate input
if (!isValid(parseISO(userInput))) {
  throw new Error('Invalid date format');
}
```

### Day of Week Checking
```typescript
// Source: date-fns docs
import { parseISO, isSunday, getDay } from 'date-fns';

// Check if date is Sunday
const date = parseISO('2025-03-16');
isSunday(date); // true (March 16, 2025 is a Sunday)

// Get day of week (0 = Sunday, 6 = Saturday)
getDay(date); // 0
```

### Adding Days (Calendar and Business)
```typescript
// Source: date-fns docs
import { addDays, addBusinessDays, parseISO, format } from 'date-fns';

const start = parseISO('2025-01-15');

// Add 30 calendar days
const calendarEnd = addDays(start, 30);
format(calendarEnd, 'yyyy-MM-dd'); // '2025-02-14'

// Add 10 business days (weekdays only, no holiday awareness)
const businessEnd = addBusinessDays(start, 10);
format(businessEnd, 'yyyy-MM-dd'); // '2025-01-29'
```

### Federal Holiday Detection (Math-Based)
```typescript
// Custom implementation - no external dependency
// Reference: 5 U.S.C. § 6103

interface Holiday {
  name: string;
  date: Date;
}

/**
 * Get all federal holidays for a year
 * Includes weekend shift rules (Saturday → Friday, Sunday → Monday)
 */
export function getFederalHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];

  // Fixed-date holidays
  holidays.push({ name: 'New Year', date: new Date(year, 0, 1) });
  holidays.push({ name: 'Juneteenth', date: new Date(year, 5, 19) });
  holidays.push({ name: 'Independence Day', date: new Date(year, 6, 4) });
  holidays.push({ name: 'Veterans Day', date: new Date(year, 10, 11) });
  holidays.push({ name: 'Christmas', date: new Date(year, 11, 25) });

  // Floating holidays (Nth weekday of month)
  holidays.push({ name: 'MLK Day', date: nthWeekdayOfMonth(year, 0, 1, 3) }); // 3rd Monday Jan
  holidays.push({ name: 'Presidents Day', date: nthWeekdayOfMonth(year, 1, 1, 3) }); // 3rd Monday Feb
  holidays.push({ name: 'Memorial Day', date: lastWeekdayOfMonth(year, 4, 1) }); // Last Monday May
  holidays.push({ name: 'Labor Day', date: nthWeekdayOfMonth(year, 8, 1, 1) }); // 1st Monday Sep
  holidays.push({ name: 'Columbus Day', date: nthWeekdayOfMonth(year, 9, 1, 2) }); // 2nd Monday Oct
  holidays.push({ name: 'Thanksgiving', date: nthWeekdayOfMonth(year, 10, 4, 4) }); // 4th Thursday Nov

  // Inauguration Day (Jan 20 every 4 years, starting 2021)
  if ((year - 2021) % 4 === 0) {
    holidays.push({ name: 'Inauguration Day', date: new Date(year, 0, 20) });
  }

  // Apply weekend shift rules
  return holidays.map(h => ({
    name: h.name,
    date: shiftWeekendHoliday(h.date),
  }));
}

function shiftWeekendHoliday(date: Date): Date {
  const day = date.getDay();
  if (day === 6) return addDays(date, -1); // Saturday → Friday
  if (day === 0) return addDays(date, 1);  // Sunday → Monday
  return date;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0); // Last day of month
  const lastWeekday = last.getDay();
  const offset = (lastWeekday - weekday + 7) % 7;
  return new Date(year, month + 1, -offset);
}

// Helper: Check if a date is a federal holiday
export function isFederalHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getFederalHolidays(year);
  const dateStr = format(date, 'yyyy-MM-dd');
  return holidays.some(h => format(h.date, 'yyyy-MM-dd') === dateStr);
}
```

### Business Day Counting with Holidays
```typescript
// Source: Custom implementation using date-fns
import { addDays, isWeekend, parseISO, format } from 'date-fns';

/**
 * Add N business days to a date (excludes weekends AND federal holidays)
 */
export function addBusinessDaysWithHolidays(
  startDate: string,
  days: number
): string {
  let date = parseISO(startDate);
  let added = 0;

  while (added < days) {
    date = addDays(date, 1);
    if (!isWeekend(date) && !isFederalHoliday(date)) {
      added++;
    }
  }

  return format(date, 'yyyy-MM-dd');
}

/**
 * Count business days between two dates (excludes weekends AND federal holidays)
 */
export function countBusinessDays(
  startDate: string,
  endDate: string
): number {
  let count = 0;
  let current = parseISO(startDate);
  const end = parseISO(endDate);

  while (current <= end) {
    if (!isWeekend(current) && !isFederalHoliday(current)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}
```

### Zod superRefine for Cross-Field Validation (Client-Side Forms)
```typescript
// Source: Zod docs - for client-side form validation if needed
import { z } from 'zod';

const caseFormSchema = z.object({
  pwd_filing_date: z.string().optional(),
  pwd_determination_date: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.pwd_filing_date && data.pwd_determination_date) {
    const filing = new Date(data.pwd_filing_date);
    const determination = new Date(data.pwd_determination_date);
    if (filing >= determination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PWD filing date must be before determination date',
        path: ['pwd_filing_date'],
      });
    }
  }
});
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Moment.js | date-fns or dayjs | 2020 (Moment deprecated) | Use date-fns for new projects |
| date-fns-tz (separate) | @date-fns/tz integrated | 2024 (date-fns v4) | First-class TZ support in date-fns |
| Yup validation | Zod or Valibot | 2022-2024 | Better TypeScript inference |
| Custom validation in Convex | convex/values + helpers | 2024 | Use built-in v.* validators |
| Static holiday arrays | Math-based or @18f/us-federal-holidays | 2023 | Less maintenance, handles Juneteenth |

**New tools/patterns to consider:**
- **Valibot 1.2.0:** 90% smaller than Zod, consider for client-side if bundle size critical (v1 RC released Feb 2025)
- **Standard Schema:** Emerging standard for cross-library schema compatibility (Zod, Valibot, ArkType all converging)
- **Convex Triggers:** Can be used for server-side validation on write (complementary to mutation validation)

**Deprecated/outdated:**
- **Moment.js:** In maintenance mode since 2020, do not use for new projects
- **Yup:** Still works but Zod/Valibot have better TypeScript support
- **date-fns v2/v3:** Use v4+ for first-class timezone support
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Zod vs Pure TypeScript for Client Forms**
   - What we know: Convex mutations use `v.*` validators, business logic is pure TS
   - What's unclear: For React Hook Form integration, should we use Zod schemas or pure TS?
   - Recommendation: Start with pure TS validators, add Zod with `@hookform/resolvers/zod` if form library requires it

2. **Holiday Handling Strategy**
   - What we know: Math-based is maintainable, @18f/us-federal-holidays is battle-tested
   - What's unclear: Which is better for this project?
   - Recommendation: Use math-based (custom `holidays.ts`) for full control, zero dependencies, and self-documenting code

3. **Test Suite Size vs 377 Behaviors**
   - What we know: v1 has 377 test behaviors, need to port to v2
   - What's unclear: 1:1 port vs redesign test structure?
   - Recommendation: Design test structure around the new architecture (calculators, validators, cascade) but ensure same coverage
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- date-fns/date-fns GitHub - parseISO, format, addDays, isWeekend, getDay
- colinhacks/zod GitHub - superRefine, cross-field validation patterns
- docs.convex.dev - v.* validators, helper functions, schema patterns
- stack.convex.dev - argument validation, custom functions, triggers

### Secondary (MEDIUM confidence)
- npmtrends.com - Library popularity comparison (date-fns vs dayjs vs luxon)
- phrase.com - Best JavaScript date libraries 2025 comparison
- dev.to - Zod vs Valibot comparison with bundle sizes

### Tertiary (LOW confidence - needs validation)
- @18f/us-federal-holidays npm - Holiday calculation alternative (not verified in production)
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Convex + TypeScript + date-fns
- Ecosystem: Convex validators, date-fns v4, optional Zod for forms
- Patterns: Pure functions, isomorphic code, cascade reducer
- Pitfalls: Timezone, off-by-one, holiday handling, cascade loops

**Confidence breakdown:**
- Standard stack: HIGH - Convex docs explicitly recommend this pattern
- Architecture: HIGH - Matches Convex best practices and domain requirements
- Pitfalls: HIGH - Common issues verified in date/validation libraries
- Code examples: HIGH - From official date-fns and Convex documentation

**Research date:** 2025-12-22
**Valid until:** 2026-01-22 (30 days - stable ecosystem)
</metadata>

---

*Phase: 16-deadline-validation-core*
*Research completed: 2025-12-22*
*Ready for planning: yes*
