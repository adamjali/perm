# Coding Conventions

**Analysis Date:** 2026-01-03

## Naming Patterns

**Files:**
- PascalCase.tsx for React components (CaseForm.tsx, DeadlineHeroWidget.tsx)
- camelCase.ts for utilities and helpers (dashboardHelpers.ts, auth.ts)
- *.test.ts(x) for test files alongside source
- index.ts for barrel exports

**Functions:**
- camelCase for all functions (calculatePWDExpiration, validateRecruitment)
- handle* for event handlers (handleClick, handleSubmit)
- No special prefix for async functions

**Variables:**
- camelCase for variables
- SCREAMING_SNAKE_CASE for constants (DEADLINE_RELEVANT_FIELDS)
- No underscore prefix for private (TypeScript visibility)

**Types:**
- PascalCase for interfaces, no I prefix (User, CaseData)
- PascalCase for type aliases (ValidationResult, ISODateString)
- PascalCase for enum names, UPPER_CASE values (Status.PENDING)
- *Props suffix for component props (DateInputProps)

**Database:**
- camelCase for table names (cases, userProfiles)
- camelCase for field names (pwdFilingDate, beneficiaryIdentifier)
- by_* prefix for index names (by_userId, by_status)

## Code Style

**Formatting:**
- ESLint with Next.js config (no Prettier)
- 2 space indentation
- Single quotes for strings
- Semicolons required
- 100 character line length (approximate)

**Linting:**
- ESLint 9 with flat config (eslint.config.mjs)
- @typescript-eslint for TypeScript rules
- eslint-plugin-storybook for Storybook files
- Run: `npm run lint`

**Key ESLint Rules:**
```javascript
"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
"@typescript-eslint/no-explicit-any": "warn",
"react-hooks/set-state-in-effect": "off"
```

## Import Organization

**Order:**
1. React and framework imports (react, next/*)
2. Third-party packages (date-fns, zod, framer-motion)
3. Internal absolute imports (@/lib, @/components)
4. Convex imports (convex/*, @/convex)
5. Relative imports (./utils, ../types)
6. Type imports last (import type {})

**Grouping:**
- Blank line between groups
- Alphabetical within each group

**Path Aliases:**
- @/* maps to src/*
- Prefer absolute (@/lib/utils) over relative (../../lib/utils)

## Error Handling

**Patterns:**
- Early returns for guard clauses
- Throw errors, catch at boundaries (route handlers, top-level)
- Validation returns result objects: `{ valid: boolean, errors: [], warnings: [] }`

**Error Types:**
- Throw on: invalid input, authorization failures, invariant violations
- Return result on: expected validation failures
- Log with context before throwing: `console.error('[Push] Error:', error)`

**Async:**
- Use try/catch, avoid .catch() chains
- Include cause in errors: `new Error('Failed', { cause: originalError })`

## Logging

**Framework:**
- Console logging (console.log, console.error, console.warn)
- Sentry for production error tracking

**Patterns:**
- Prefix with context: `console.log('[Push] Sending notification...')`
- Log at service boundaries
- Log state transitions, external API calls, errors
- Avoid excessive logging in loops

**Note:** Should migrate to structured logging utility

## Comments

**When to Comment:**
- Explain WHY, not WHAT
- Document business rules: `// PWD expires Jun 30 following year if after Jun 30`
- Explain non-obvious algorithms or workarounds
- Avoid obvious comments

**JSDoc/TSDoc:**
- Required for public API functions
- Use @param, @returns, @throws, @example tags
- Comprehensive docs for branded types

**Section Headers:**
```typescript
// ============================================================================
// SECTION NAME
// ============================================================================
```

**TODO Comments:**
- Format: `// TODO: description`
- Link to issue if exists: `// TODO: Fix race condition (issue #123)`

## Function Design

**Size:**
- Keep under 50 lines
- Extract helpers for complex logic
- One level of abstraction per function

**Parameters:**
- Max 3 parameters
- Use options object for 4+ parameters: `function create(options: CreateOptions)`
- Destructure in parameter list: `function process({ id, name }: ProcessParams)`

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Use result pattern for validation: `{ valid, errors, warnings }`

## Module Design

**Exports:**
- Named exports preferred
- Default exports for page components
- Barrel exports from index.ts

**Organization:**
```typescript
// 1. Imports
// 2. Type definitions
// 3. Constants
// 4. Helper functions
// 5. Main exports
// 6. Default export (if any)
```

**Barrel Files:**
- index.ts re-exports public API
- Keep internal helpers private
- Avoid circular dependencies

## React Patterns

**Components:**
```typescript
"use client"; // Client component directive

interface ComponentProps {
  // Props with JSDoc
}

export default function Component({ prop }: ComponentProps) {
  // Hooks first
  const [state, setState] = useState();

  // Handlers
  const handleClick = () => {};

  // Render
  return <div>...</div>;
}
```

**Convex Functions:**
```typescript
export const getCase = query({
  args: { id: v.id('cases') },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    // ... implementation
  }
});
```

## Type Safety

**Branded Types:**
```typescript
declare const ISODateBrand: unique symbol;
export type ISODateString = string & { readonly [ISODateBrand]: true };

export function createISODate(dateStr: string): ISODateString | null { ... }
```

**Strict Mode:**
- TypeScript strict: true
- noUncheckedIndexedAccess: true
- noImplicitOverride: true

---

*Convention analysis: 2026-01-03*
*Update when patterns change*
