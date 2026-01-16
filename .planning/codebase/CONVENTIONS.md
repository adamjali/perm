# Coding Conventions

**Analysis Date:** 2026-01-16

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `CaseCard.tsx`, `SummaryTile.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useFormCalculations.ts`, `useDateFieldValidation.ts`)
- Utilities: camelCase (e.g., `date.ts`, `validation.ts`)
- Tests: Same name with `.test.ts`/`.test.tsx` suffix (e.g., `pwd.test.ts`, `SummaryTile.test.tsx`)
- Test directories: `__tests__/` within component folders

**Functions:**
- camelCase for all functions (e.g., `calculatePWDExpiration`, `validateCase`)
- Prefix private/internal helpers with underscore in tests only
- Factory functions: `create` prefix (e.g., `createISODate`, `createValidationResult`, `createTestCase`)
- Type guards: `is` prefix (e.g., `isISODateString`, `isCaseStatus`)

**Variables:**
- camelCase for variables and parameters
- SCREAMING_SNAKE_CASE for constants (e.g., `STAGGER_DELAY`, `MOBILE_BREAKPOINT`)
- Descriptive names over abbreviations

**Types:**
- PascalCase for all types and interfaces
- Suffix with purpose: `Props`, `Data`, `Result`, `Input` (e.g., `ButtonProps`, `CaseData`, `ValidationResult`)
- Branded types use unique symbols (e.g., `ISODateString`, `ValidationResult`)

**Database (Convex Schema):**
- Tables: camelCase (e.g., `cases`, `userProfiles`, `auditLogs`)
- Fields: camelCase (e.g., `employerName`, `pwdFilingDate`, `rfiEntries`)
- Indexes: snake_case with `by_` prefix (e.g., `by_user_id`, `by_deleted_at`)

## Code Style

**Formatting:**
- ESLint with `eslint-config-next` (core-web-vitals + TypeScript)
- No dedicated Prettier config - uses ESLint rules
- Indentation: 2 spaces
- Single quotes for imports, double quotes allowed in JSX

**Linting:**
- Tool: ESLint 9 with flat config (`eslint.config.mjs`)
- Key rules:
  - `@typescript-eslint/no-unused-vars`: warn (ignore `_` prefixed)
  - `@typescript-eslint/no-explicit-any`: warn (off in tests)
  - `react-hooks/set-state-in-effect`: off (valid patterns exist)
- Test files have relaxed rules for mocking flexibility

**TypeScript:**
- Strict mode enabled (`"strict": true`)
- `noUncheckedIndexedAccess`: true (safer array access)
- `noImplicitOverride`: true (explicit override keyword)
- No `any` types in production code (warn level)
- Target: ES2017

## Import Organization

**Order:**
1. External packages (React, Next.js, third-party)
2. Internal aliases (`@/lib/...`, `@/components/...`)
3. Relative imports (`./`, `../`)
4. Type imports (use `import type` when importing only types)

**Path Aliases:**
- `@/*` → `./src/*`
- `@/test-utils` → `./test-utils`
- `@/convex` → `./convex`

**Example:**
```typescript
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { PWDSection } from "../PWDSection";
import type { CaseData } from "./types";
```

## Error Handling

**Patterns:**
- Validators return `ValidationResult` with `errors[]` and `warnings[]`
- Never throw for validation failures - return structured results
- Use early returns for auth checks:
  ```typescript
  const userId = await getCurrentUserIdOrNull(ctx);
  if (userId === null) {
    return []; // Graceful empty response for unauthenticated
  }
  ```
- Mutations throw for unauthorized access (security)
- Queries return `null` for missing/unauthorized resources (no information leakage)

**Validation Result Pattern:**
```typescript
import { createValidationResult } from '@/lib/perm';

// Factory ensures valid === (errors.length === 0)
const result = createValidationResult(
  [{ ruleId: 'V-PWD-01', severity: 'error', field: 'pwd_filing_date', message: 'Required' }],
  [{ ruleId: 'V-PWD-02', severity: 'warning', field: 'pwd_expiration_date', message: 'Expires soon' }]
);
```

## Logging

**Framework:** Custom `loggers` module from `convex/lib/logging`

**Patterns:**
```typescript
import { loggers } from "./lib/logging";
const log = loggers.cases;

// Use appropriate log levels
log.debug("Processing case", { caseId });
log.info("Case created", { caseId, userId });
log.warn("Missing expected field", { field });
log.error("Operation failed", { error });
```

## Comments

**When to Comment:**
- Complex PERM regulation logic (cite CFR references)
- Non-obvious business rules
- Public API functions (JSDoc with examples)
- Test file headers explaining coverage scope

**JSDoc Pattern:**
```typescript
/**
 * Validate PWD dates according to PERM regulations.
 *
 * Rules:
 * - V-PWD-01: Filing date must be before determination date
 * - V-PWD-02: Determination date must be before expiration date
 *
 * @example
 * const result = validatePWD({
 *   pwd_filing_date: '2024-01-15',
 *   pwd_determination_date: '2024-02-20',
 *   pwd_expiration_date: '2024-05-20'
 * });
 */
export function validatePWD(input: PWDValidationInput): ValidationResult { ... }
```

**Test File Headers:**
```typescript
/**
 * SummaryTile Component Tests
 *
 * Tests essential behavior:
 * - Renders label, count, subtext, and link
 * - Links to filtered cases list
 * - Handles edge cases (empty subtext, zero/large counts)
 * - Accessibility requirements met
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling verified via Storybook.
 */
```

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Extract helpers for complex logic
- Validators typically under 50 lines

**Parameters:**
- Use object parameters for 3+ args: `function create({ name, email, settings })`
- Optional parameters in options object: `{ timeout?: number }`
- Type all parameters explicitly

**Return Values:**
- Explicit return types on all exported functions
- Use branded types for domain-specific values (e.g., `ISODateString`)
- Factory functions for complex types to ensure invariants

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel files (`index.ts`) for module public API
- Internal helpers not exported

**Barrel Files:**
```typescript
// convex/lib/perm/index.ts
export { calculatePWDExpiration } from './calculators/pwd';
export { validatePWD } from './validators/pwd';
export { applyCascade } from './cascade';
export type { CaseData, ValidationResult } from './types';
```

## Date Handling

**Critical Pattern: All dates are ISO strings (YYYY-MM-DD).**

```typescript
// CORRECT
const date = '2024-06-15';
const expiration = calculatePWDExpiration(date); // Returns string

// WRONG
const date = new Date('2024-06-15'); // Never store Date objects
```

**Parsing/Formatting:**
```typescript
import { parseISO, format } from 'date-fns';

const parsed = parseISO('2024-06-15');
const result = addDays(parsed, 30);
const output = format(result, 'yyyy-MM-dd'); // Back to string
```

**Branded Type for Safety:**
```typescript
import { createISODate, isISODateString } from '@/lib/perm';

const date = createISODate(userInput); // Returns ISODateString | null
if (date) {
  // Use safely
}
```

## Component Patterns

**UI Components (shadcn/ui style):**
- Use `cva` (class-variance-authority) for variants
- Use `cn()` for class merging
- Forward refs when wrapping native elements
- Support `asChild` pattern with Radix Slot

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
      },
      size: {
        default: "h-9",
        sm: "h-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

**Form Sections:**
- Accept `values` and `onChange` props
- Use `onDateChange` for date cascade triggers
- Controlled inputs only

## Convex Patterns

**Query/Mutation Structure:**
```typescript
export const get = query({
  args: { id: v.id('cases') },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return null;

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;

    return doc;
  },
});
```

**Internal Functions:**
- Use `internalQuery`, `internalMutation`, `internalAction`
- Call via `ctx.runMutation(internal.module.function)`

**Soft Delete:**
- All tables support `deletedAt: v.optional(v.number())`
- Filter with `.filter(c => c.deletedAt === undefined)`

## Animation Patterns

**Use motion/react (framer-motion):**
```typescript
import { motion } from "motion/react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  <motion.div variants={fadeInUp}>Content</motion.div>
</motion.div>
```

**Respect Reduced Motion:**
```typescript
import { useReducedMotion, getReducedMotionVariants } from "@/lib/animations";

const prefersReducedMotion = useReducedMotion();
const variants = getReducedMotionVariants(fadeInUp, prefersReducedMotion);
```

---

*Convention analysis: 2026-01-16*
