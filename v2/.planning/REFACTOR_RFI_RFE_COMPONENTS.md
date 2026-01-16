# RFI/RFE Component Refactor Plan

**Status:** Proposed | **Priority:** Low | **Estimated Savings:** ~300 LOC

## Problem

The RFI and RFE entry components have significant code duplication (~450 LOC total):

| Component | Lines | Location |
|-----------|-------|----------|
| `RFIEntry.tsx` | ~180 | `src/components/forms/sections/` |
| `RFEEntry.tsx` | ~180 | `src/components/forms/sections/` |
| `RFIEntryList.tsx` | ~90 | `src/components/forms/sections/` |
| `RFEEntryList.tsx` | ~90 | `src/components/forms/sections/` |

Both entry components share:
- Card container with urgency border styling
- Header with remove button and status badges
- Date fields (received, due, submitted)
- Text fields (title, description, notes)
- Disabled state handling
- Date constraints (min/max)

## Proposed Solution

Create a generic `RequestEntry<T>` component that handles both RFI and RFE entries.

### Generic Entry Component

```typescript
// src/components/forms/sections/RequestEntry.tsx

type RequestType = 'rfi' | 'rfe';

interface RequestEntryProps<T extends RFIEntry | RFEEntry> {
  type: RequestType;
  entry: T;
  index: number;
  onRemove: (index: number) => void;
  // Date constraints
  minReceivedDate?: string;
  maxReceivedDate?: string;
  receivedDisabled?: { disabled: boolean; reason?: string };
  // RFI-specific: due date is auto-calculated (disabled)
  // RFE-specific: due date is editable
  dueDateEditable: boolean;
  dueDateHint: string;
  // Urgency threshold (7 days for both)
  urgencyDays?: number;
  // Constraint hint for received date
  receivedDateHint?: string;
}

function RequestEntry<T extends RFIEntry | RFEEntry>({
  type,
  entry,
  index,
  onRemove,
  ...props
}: RequestEntryProps<T>) {
  // Shared implementation
}
```

### Configuration by Type

```typescript
const RFI_CONFIG = {
  type: 'rfi' as const,
  dueDateEditable: false,
  dueDateHint: 'Strict 30 days from received date',
  receivedDateHint: 'Must be after ETA 9089 filing',
  urgencyDays: 7,
};

const RFE_CONFIG = {
  type: 'rfe' as const,
  dueDateEditable: true,
  dueDateHint: '30-90 days (standard 87 days)',
  receivedDateHint: 'Must be after I-140 filing',
  urgencyDays: 7,
};
```

### Wrapper Components (Backward Compatible)

```typescript
// src/components/forms/sections/RFIEntry.tsx
export const RFIEntry = (props: RFIEntryProps) => (
  <RequestEntry {...props} {...RFI_CONFIG} />
);

// src/components/forms/sections/RFEEntry.tsx
export const RFEEntry = (props: RFEEntryProps) => (
  <RequestEntry {...props} {...RFE_CONFIG} />
);
```

### List Component

Similarly, `RFIEntryList` and `RFEEntryList` can be unified:

```typescript
// src/components/forms/sections/RequestEntryList.tsx
interface RequestEntryListProps<T> {
  type: 'rfi' | 'rfe';
  fieldArrayName: 'rfiEntries' | 'rfeEntries';
  createEntry: () => T;
  EntryComponent: React.ComponentType<EntryProps<T>>;
  // ... other shared props
}
```

## Benefits

1. **Reduced duplication:** ~300 LOC savings
2. **Single source of truth:** Styling, validation, and behavior in one place
3. **Easier maintenance:** Changes apply to both RFI and RFE
4. **Better consistency:** Guaranteed identical behavior
5. **Type safety:** Generic types ensure correct data handling

## Risks

1. **Complexity:** Generic components can be harder to understand
2. **Testing:** Need to ensure both configurations are tested
3. **Divergence:** If RFI/RFE requirements diverge significantly, may need separate components again

## Implementation Steps

1. Create `RequestEntry` generic component
2. Create configuration objects
3. Update `RFIEntry` to use generic component
4. Run tests to verify no regressions
5. Update `RFEEntry` to use generic component
6. Run tests again
7. Create `RequestEntryList` generic component
8. Update both list components
9. Run full test suite
10. Remove duplicate code

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/components/forms/sections/RequestEntry.tsx` |
| Create | `src/components/forms/sections/RequestEntryList.tsx` |
| Modify | `src/components/forms/sections/RFIEntry.tsx` (becomes wrapper) |
| Modify | `src/components/forms/sections/RFEEntry.tsx` (becomes wrapper) |
| Modify | `src/components/forms/sections/RFIEntryList.tsx` (becomes wrapper) |
| Modify | `src/components/forms/sections/RFEEntryList.tsx` (becomes wrapper) |
| Update | Test files (ensure both types tested) |

## Test Strategy

1. Existing tests should pass without modification (backward compatible wrappers)
2. Add parameterized tests for generic component
3. Test both RFI and RFE configurations explicitly

## Decision

This refactor is **LOW PRIORITY** because:
- Current implementation works correctly
- No bugs or issues reported
- 300 LOC savings is modest
- Refactoring has risk of regression

**Recommended timing:** When making significant changes to RFI/RFE functionality, consider this refactor as part of that work.
