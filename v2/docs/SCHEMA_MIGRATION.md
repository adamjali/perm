# Schema Migration Guide

This document tracks schema changes, migrations, and backwards compatibility notes.

## Completed Migrations

### RFI/RFE Single Fields → Entry Arrays (v2.0)

**Status:** ✅ **Completed** - Legacy fields removed from schema

The original schema stored RFI and RFE data as single fields per case. This was limiting because:
1. Cases can have multiple RFIs/RFEs over their lifecycle
2. No way to track RFI/RFE history
3. Couldn't store additional metadata per entry

**Migrated Fields:**

| Removed Field | Replacement | Notes |
|---------------|-------------|-------|
| `rfiReceivedDate` | `rfiEntries[].receivedDate` | Array supports multiple RFIs |
| `rfiResponseDueDate` | `rfiEntries[].responseDueDate` | Auto-calculated: +30 days |
| `rfeReceivedDate` | `rfeEntries[].receivedDate` | Array supports multiple RFEs |
| `rfeResponseDueDate` | `rfeEntries[].responseDueDate` | User-editable due date |

**Import Compatibility:** The import utility (`src/lib/import/caseImport.ts`) still supports
legacy export files that contain these fields, converting them to the new array format.

### New Entry Schema

```typescript
// RFI Entry
{
  id: string,                    // Unique ID for the entry
  title?: string,                // Optional title
  description?: string,          // Optional description
  notes?: string,                // Optional notes
  receivedDate: string,          // ISO date (YYYY-MM-DD)
  responseDueDate: string,       // Auto: receivedDate + 30 days
  responseSubmittedDate?: string, // When response was submitted
  createdAt: number,             // Timestamp
}

// RFE Entry (same structure, but responseDueDate is user-editable)
{
  id: string,
  title?: string,
  description?: string,
  notes?: string,
  receivedDate: string,
  responseDueDate: string,       // USER EDITABLE
  responseSubmittedDate?: string,
  createdAt: number,
}
```

## Working with RFI/RFE Entries

### Reading Data

Use the entries array directly:

```typescript
function getActiveRfi(caseDoc: CaseDoc) {
  if (!caseDoc.rfiEntries?.length) {
    return null;
  }

  // Find first entry without a submitted date
  return caseDoc.rfiEntries.find(e => !e.responseSubmittedDate) ?? null;
}
```

### Writing Data

Always write to the entries array:

```typescript
// Add a new RFI entry
await ctx.db.patch(caseId, {
  rfiEntries: [
    ...existingEntries,
    {
      id: generateId(),
      receivedDate: '2024-01-15',
      responseDueDate: '2024-02-14', // Auto-calculated: +30 days
      createdAt: Date.now(),
    },
  ],
});
```

## Optional Fields for Backwards Compatibility

Some fields are marked as `v.optional()` for backwards compatibility with documents
created before the field was added. These fields default to sensible values:

| Field | Default | Notes |
|-------|---------|-------|
| `isPinned` | `false` | Pinned cases appear at top of list |
| `showOnTimeline` | `true` | Whether to show on timeline view |
| `rfiEntries` | `[]` | Empty array for cases without RFIs |
| `rfeEntries` | `[]` | Empty array for cases without RFEs |

## See Also

- [convex/schema.ts](../convex/schema.ts) - Full schema with documentation
- [convex/lib/deadlineTypeMapping.ts](../convex/lib/deadlineTypeMapping.ts) - DeadlineType conversion utilities
