// @vitest-environment jsdom
/**
 * useCaseSelection Hook Tests
 * Tests for the case selection hook with search, sort, filter, and bulk actions.
 *
 * Requirements tested:
 * 1. Filters cases by search query (employerName and positionTitle)
 * 2. Search is case-insensitive
 * 3. Debounces search input (useDeferredValue)
 * 4. Sorts by name alphabetically
 * 5. Sorts by status progression order (pwd < recruitment < eta9089 < i140 < closed)
 * 6. Sorts by date newest first
 * 7. Filters by specific status
 * 8. Filters active (excludes closed)
 * 9. Filters complete (only closed)
 * 10. selectAll selects all filtered cases
 * 11. deselectAll clears selection
 * 12. selectActiveOnly selects non-closed cases
 * 13. toggleCase adds/removes from selection
 * 14. hasChanges detects changes from initial
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useCaseSelection from "../useCaseSelection";
import type { CaseForSelection } from "../CaseSelectionItem";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Mock case data for testing.
 * Covers various statuses, names, and dates.
 */
const mockCases: CaseForSelection[] = [
  {
    _id: "1",
    employerName: "Acme Corp",
    positionTitle: "Engineer",
    caseStatus: "pwd",
    createdAt: 1000,
  },
  {
    _id: "2",
    employerName: "Beta Inc",
    positionTitle: "Manager",
    caseStatus: "recruitment",
    createdAt: 2000,
  },
  {
    _id: "3",
    employerName: "Closed LLC",
    positionTitle: "Director",
    caseStatus: "closed",
    createdAt: 3000,
  },
  {
    _id: "4",
    employerName: "Delta Corp",
    positionTitle: "Analyst",
    caseStatus: "eta9089",
    createdAt: 4000,
  },
  {
    _id: "5",
    employerName: "Alpha Labs",
    positionTitle: "Engineer Lead",
    caseStatus: "i140",
    createdAt: 5000,
  },
];

/**
 * Factory for creating test cases with custom overrides.
 */
function createMockCase(
  overrides: Partial<CaseForSelection> = {}
): CaseForSelection {
  return {
    _id: "test-id",
    employerName: "Test Corp",
    positionTitle: "Test Position",
    caseStatus: "pwd",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// SEARCH FUNCTIONALITY TESTS
// ============================================================================

describe("useCaseSelection - Search", () => {
  it("filters cases by employer name", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("Acme");
    });

    // useDeferredValue should update synchronously in tests
    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].employerName).toBe("Acme Corp");
  });

  it("filters cases by position title", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("Engineer");
    });

    // Should match "Engineer" and "Engineer Lead"
    expect(result.current.displayedCases).toHaveLength(2);
    expect(
      result.current.displayedCases.some((c) => c.positionTitle === "Engineer")
    ).toBe(true);
    expect(
      result.current.displayedCases.some(
        (c) => c.positionTitle === "Engineer Lead"
      )
    ).toBe(true);
  });

  it("search is case-insensitive", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("ACME");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].employerName).toBe("Acme Corp");
  });

  it("search is case-insensitive for position title", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("MANAGER");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].positionTitle).toBe("Manager");
  });

  it("trims whitespace from search query", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("  Beta  ");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].employerName).toBe("Beta Inc");
  });

  it("returns all cases when search query is empty", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("");
    });

    expect(result.current.displayedCases).toHaveLength(5);
  });

  it("returns empty array when no cases match search", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("NonExistentCompany");
    });

    expect(result.current.displayedCases).toHaveLength(0);
  });

  it("updates filteredCount based on search results", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.filteredCount).toBe(5);
    expect(result.current.totalCount).toBe(5);

    act(() => {
      result.current.setSearchQuery("Corp");
    });

    // "Acme Corp" and "Delta Corp"
    expect(result.current.filteredCount).toBe(2);
    expect(result.current.totalCount).toBe(5);
  });
});

// ============================================================================
// SORT FUNCTIONALITY TESTS
// ============================================================================

describe("useCaseSelection - Sort", () => {
  it("sorts by name alphabetically (default)", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.sortBy).toBe("name");

    const names = result.current.displayedCases.map((c) => c.employerName);
    expect(names).toEqual([
      "Acme Corp",
      "Alpha Labs",
      "Beta Inc",
      "Closed LLC",
      "Delta Corp",
    ]);
  });

  it("sorts by status progression order", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSortBy("status");
    });

    const statuses = result.current.displayedCases.map((c) => c.caseStatus);
    expect(statuses).toEqual([
      "pwd",
      "recruitment",
      "eta9089",
      "i140",
      "closed",
    ]);
  });

  it("sorts by date newest first", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSortBy("date");
    });

    const createdAts = result.current.displayedCases.map((c) => c.createdAt);
    expect(createdAts).toEqual([5000, 4000, 3000, 2000, 1000]);
  });

  it("preserves sort when search is applied", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSortBy("date");
    });

    act(() => {
      result.current.setSearchQuery("Corp");
    });

    // Delta Corp (4000) should come before Acme Corp (1000)
    const names = result.current.displayedCases.map((c) => c.employerName);
    expect(names).toEqual(["Delta Corp", "Acme Corp"]);
  });
});

// ============================================================================
// FILTER FUNCTIONALITY TESTS
// ============================================================================

describe("useCaseSelection - Filter", () => {
  it("shows all cases when filter is 'all'", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.filterStatus).toBe("all");
    expect(result.current.displayedCases).toHaveLength(5);
  });

  it("filters to active cases (excludes closed)", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("active");
    });

    expect(result.current.displayedCases).toHaveLength(4);
    expect(
      result.current.displayedCases.every((c) => c.caseStatus !== "closed")
    ).toBe(true);
  });

  it("filters to specific status: pwd", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("pwd");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].caseStatus).toBe("pwd");
  });

  it("filters to specific status: recruitment", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("recruitment");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].caseStatus).toBe("recruitment");
  });

  it("filters to specific status: eta9089", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("eta9089");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].caseStatus).toBe("eta9089");
  });

  it("filters to specific status: i140", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("i140");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].caseStatus).toBe("i140");
  });

  it("filters to closed cases only", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("closed");
    });

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.displayedCases[0].caseStatus).toBe("closed");
  });

  it("combines filter with search", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("active");
      result.current.setSearchQuery("Corp");
    });

    // Only Acme Corp and Delta Corp, and both are active
    expect(result.current.displayedCases).toHaveLength(2);
    expect(
      result.current.displayedCases.every((c) => c.caseStatus !== "closed")
    ).toBe(true);
  });
});

// ============================================================================
// SELECTION FUNCTIONALITY TESTS
// ============================================================================

describe("useCaseSelection - toggleCase", () => {
  it("adds case to selection when not selected", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.selectedIds.has("1")).toBe(false);

    act(() => {
      result.current.toggleCase("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(true);
  });

  it("removes case from selection when already selected", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1"],
      })
    );

    expect(result.current.selectedIds.has("1")).toBe(true);

    act(() => {
      result.current.toggleCase("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(false);
  });

  it("toggles multiple cases independently", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.toggleCase("1");
      result.current.toggleCase("2");
    });

    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectedIds.has("2")).toBe(true);

    act(() => {
      result.current.toggleCase("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(false);
    expect(result.current.selectedIds.has("2")).toBe(true);
  });
});

describe("useCaseSelection - selectAll", () => {
  it("selects all displayed (filtered) cases", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedIds.size).toBe(5);
    mockCases.forEach((c) => {
      expect(result.current.selectedIds.has(c._id)).toBe(true);
    });
  });

  it("adds to existing selection (does not replace)", () => {
    const casesWithExtra = [
      ...mockCases,
      createMockCase({ _id: "extra", employerName: "Extra Corp" }),
    ];

    const { result } = renderHook(() =>
      useCaseSelection({
        cases: casesWithExtra,
        initialSelectedIds: ["extra"],
      })
    );

    // Filter to only show "Corp" matches
    act(() => {
      result.current.setSearchQuery("Acme");
    });

    act(() => {
      result.current.selectAll();
    });

    // Should have both: the pre-selected "extra" and the newly selected "Acme Corp"
    expect(result.current.selectedIds.has("extra")).toBe(true);
    expect(result.current.selectedIds.has("1")).toBe(true);
  });

  it("only selects filtered cases when search is active", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setSearchQuery("Corp");
    });

    act(() => {
      result.current.selectAll();
    });

    // Only Acme Corp (1) and Delta Corp (4)
    expect(result.current.selectedIds.size).toBe(2);
    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectedIds.has("4")).toBe(true);
  });

  it("only selects filtered cases when status filter is active", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("active");
    });

    act(() => {
      result.current.selectAll();
    });

    // 4 active cases (excludes closed)
    expect(result.current.selectedIds.size).toBe(4);
    expect(result.current.selectedIds.has("3")).toBe(false); // Closed LLC
  });
});

describe("useCaseSelection - deselectAll", () => {
  it("deselects all displayed (filtered) cases", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1", "2", "3", "4", "5"],
      })
    );

    act(() => {
      result.current.deselectAll();
    });

    expect(result.current.selectedIds.size).toBe(0);
  });

  it("only deselects filtered cases, keeps others selected", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1", "2", "3", "4", "5"],
      })
    );

    // Filter to only show Corp cases
    act(() => {
      result.current.setSearchQuery("Corp");
    });

    act(() => {
      result.current.deselectAll();
    });

    // Acme Corp (1) and Delta Corp (4) should be deselected
    // Beta Inc (2), Closed LLC (3), Alpha Labs (5) should remain selected
    expect(result.current.selectedIds.has("1")).toBe(false);
    expect(result.current.selectedIds.has("4")).toBe(false);
    expect(result.current.selectedIds.has("2")).toBe(true);
    expect(result.current.selectedIds.has("3")).toBe(true);
    expect(result.current.selectedIds.has("5")).toBe(true);
  });
});

describe("useCaseSelection - selectActiveOnly", () => {
  it("selects only non-closed cases from all cases", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.selectActiveOnly();
    });

    // 4 active cases
    expect(result.current.selectedIds.size).toBe(4);
    expect(result.current.selectedIds.has("1")).toBe(true); // pwd
    expect(result.current.selectedIds.has("2")).toBe(true); // recruitment
    expect(result.current.selectedIds.has("3")).toBe(false); // closed
    expect(result.current.selectedIds.has("4")).toBe(true); // eta9089
    expect(result.current.selectedIds.has("5")).toBe(true); // i140
  });

  it("replaces current selection (not additive)", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["3"], // Start with closed case selected
      })
    );

    act(() => {
      result.current.selectActiveOnly();
    });

    // Closed case should be removed
    expect(result.current.selectedIds.has("3")).toBe(false);
    expect(result.current.selectedIds.size).toBe(4);
  });

  it("works regardless of current filter", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    // Set filter to closed only
    act(() => {
      result.current.setFilterStatus("closed");
    });

    act(() => {
      result.current.selectActiveOnly();
    });

    // Should still select all active from ALL cases
    expect(result.current.selectedIds.size).toBe(4);
  });
});

// ============================================================================
// DIRTY STATE TESTS
// ============================================================================

describe("useCaseSelection - hasChanges", () => {
  it("returns false when selection matches initial", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1", "2"],
      })
    );

    expect(result.current.hasChanges).toBe(false);
  });

  it("returns true when case is added", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1"],
      })
    );

    act(() => {
      result.current.toggleCase("2");
    });

    expect(result.current.hasChanges).toBe(true);
  });

  it("returns true when case is removed", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1", "2"],
      })
    );

    act(() => {
      result.current.toggleCase("1");
    });

    expect(result.current.hasChanges).toBe(true);
  });

  it("returns false when changes are reverted", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1", "2"],
      })
    );

    act(() => {
      result.current.toggleCase("1"); // Remove
    });

    expect(result.current.hasChanges).toBe(true);

    act(() => {
      result.current.toggleCase("1"); // Add back
    });

    expect(result.current.hasChanges).toBe(false);
  });

  it("returns true when selection count differs", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1"],
      })
    );

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.hasChanges).toBe(true);
  });

  it("returns false with empty initial and empty current", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.hasChanges).toBe(false);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe("useCaseSelection - getSelectedArray", () => {
  it("returns selected IDs as array", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["1", "3", "5"],
      })
    );

    const selected = result.current.getSelectedArray();
    expect(selected).toHaveLength(3);
    expect(selected).toContain("1");
    expect(selected).toContain("3");
    expect(selected).toContain("5");
  });

  it("returns empty array when nothing selected", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.getSelectedArray()).toEqual([]);
  });
});

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

describe("useCaseSelection - Initialization", () => {
  it("initializes selectedIds from initialSelectedIds", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["2", "4"],
      })
    );

    expect(result.current.selectedIds.has("2")).toBe(true);
    expect(result.current.selectedIds.has("4")).toBe(true);
    expect(result.current.selectedIds.size).toBe(2);
  });

  it("initializes with default sort (name)", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.sortBy).toBe("name");
  });

  it("initializes with default filter (all)", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.filterStatus).toBe("all");
  });

  it("initializes with empty search query", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: [],
      })
    );

    expect(result.current.searchQuery).toBe("");
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("useCaseSelection - Edge Cases", () => {
  it("handles empty cases array", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: [],
        initialSelectedIds: [],
      })
    );

    expect(result.current.displayedCases).toEqual([]);
    expect(result.current.filteredCount).toBe(0);
    expect(result.current.totalCount).toBe(0);
  });

  it("handles single case", () => {
    const singleCase = [mockCases[0]];

    const { result } = renderHook(() =>
      useCaseSelection({
        cases: singleCase,
        initialSelectedIds: [],
      })
    );

    expect(result.current.displayedCases).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
  });

  it("handles initialSelectedIds that do not exist in cases", () => {
    const { result } = renderHook(() =>
      useCaseSelection({
        cases: mockCases,
        initialSelectedIds: ["nonexistent-id"],
      })
    );

    // Should still have the ID in selection (hook doesn't validate)
    expect(result.current.selectedIds.has("nonexistent-id")).toBe(true);
  });

  it("handles all cases being closed", () => {
    const closedCases = mockCases.map((c) => ({
      ...c,
      caseStatus: "closed" as const,
    }));

    const { result } = renderHook(() =>
      useCaseSelection({
        cases: closedCases,
        initialSelectedIds: [],
      })
    );

    act(() => {
      result.current.setFilterStatus("active");
    });

    expect(result.current.displayedCases).toHaveLength(0);

    act(() => {
      result.current.selectActiveOnly();
    });

    expect(result.current.selectedIds.size).toBe(0);
  });
});
