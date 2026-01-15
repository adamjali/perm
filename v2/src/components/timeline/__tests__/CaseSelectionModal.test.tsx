// @vitest-environment jsdom
/**
 * CaseSelectionModal Component Tests
 * Tests for the case selection modal with search, filter, sort, and bulk actions.
 *
 * Requirements tested:
 * 1. Renders search input and dropdowns
 * 2. Displays correct case count ("Showing X of Y cases")
 * 3. Individual checkbox toggles selection
 * 4. Select All button works
 * 5. Deselect All button works
 * 6. Save Changes calls onSelectionChange with correct ids
 * 7. Cancel closes without saving
 * 8. Empty state shows when no matches
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CaseSelectionModal } from "../CaseSelectionModal";
import type { CaseForSelection } from "../CaseSelectionItem";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Mock case data for testing.
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
 * Default props for modal tests.
 */
function createDefaultProps(
  overrides: Partial<React.ComponentProps<typeof CaseSelectionModal>> = {}
) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    allCases: mockCases,
    selectedIds: new Set<string>(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// RENDER TESTS
// ============================================================================

describe("CaseSelectionModal - Render", () => {
  it("renders when isOpen is true", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByTestId("case-selection-modal")).toBeInTheDocument();
    expect(
      screen.getByText("Select Cases")
    ).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const props = createDefaultProps({ isOpen: false });
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(
      screen.queryByTestId("case-selection-modal")
    ).not.toBeInTheDocument();
  });

  it("renders search input", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByTestId("case-search-input")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search cases...")
    ).toBeInTheDocument();
  });

  it("renders sort dropdown", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByTestId("case-sort-select")).toBeInTheDocument();
  });

  it("renders filter dropdown", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByTestId("case-filter-select")).toBeInTheDocument();
  });

  it("renders bulk action buttons", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByTestId("select-all-btn")).toBeInTheDocument();
    expect(screen.getByTestId("deselect-all-btn")).toBeInTheDocument();
    expect(screen.getByTestId("active-only-btn")).toBeInTheDocument();
  });

  it("renders Save Changes and Cancel buttons", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByTestId("save-selection-btn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

// ============================================================================
// CASE COUNT DISPLAY TESTS
// ============================================================================

describe("CaseSelectionModal - Case Count Display", () => {
  it("displays correct case count 'Showing X of Y cases'", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(
      screen.getByText("Showing 5 of 5 cases")
    ).toBeInTheDocument();
  });

  it("updates count when search filters cases", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const searchInput = screen.getByTestId("case-search-input");
    await user.type(searchInput, "Corp");

    await waitFor(() => {
      // "Acme Corp" and "Delta Corp"
      expect(screen.getByText(/Showing 2 of 5 cases/)).toBeInTheDocument();
    });
  });

  it("shows selected count in parentheses", async () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1", "2"]),
    });
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
  });
});

// ============================================================================
// CASE LIST TESTS
// ============================================================================

describe("CaseSelectionModal - Case List", () => {
  it("displays all cases", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.getByText("Closed LLC")).toBeInTheDocument();
    expect(screen.getByText("Delta Corp")).toBeInTheDocument();
    expect(screen.getByText("Alpha Labs")).toBeInTheDocument();
  });

  it("displays position titles", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText("Analyst")).toBeInTheDocument();
    expect(screen.getByText("Engineer Lead")).toBeInTheDocument();
  });

  it("shows checkbox for each case", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    // Each case item should have a checkbox
    mockCases.forEach((c) => {
      const caseItem = screen.getByTestId(`case-selection-item-${c._id}`);
      expect(within(caseItem).getByRole("checkbox")).toBeInTheDocument();
    });
  });

  it("shows selected cases as checked", () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1", "3"]),
    });
    renderWithProviders(<CaseSelectionModal {...props} />);

    const case1 = screen.getByTestId("case-selection-item-1");
    const case2 = screen.getByTestId("case-selection-item-2");
    const case3 = screen.getByTestId("case-selection-item-3");

    expect(within(case1).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
    expect(within(case2).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
    expect(within(case3).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
  });
});

// ============================================================================
// CHECKBOX TOGGLE TESTS
// ============================================================================

describe("CaseSelectionModal - Checkbox Toggle", () => {
  it("clicking case item toggles selection", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const caseItem = screen.getByTestId("case-selection-item-1");
    await user.click(caseItem);

    expect(within(caseItem).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
  });

  it("clicking checkbox directly toggles selection", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const caseItem = screen.getByTestId("case-selection-item-1");
    const checkbox = within(caseItem).getByRole("checkbox");

    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("deselects already selected case when clicked", async () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1"]),
    });
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const caseItem = screen.getByTestId("case-selection-item-1");
    const checkbox = within(caseItem).getByRole("checkbox");

    expect(checkbox).toHaveAttribute("data-state", "checked");

    await user.click(caseItem);

    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });
});

// ============================================================================
// SELECT ALL BUTTON TESTS
// ============================================================================

describe("CaseSelectionModal - Select All Button", () => {
  it("selects all visible cases when clicked", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.click(screen.getByTestId("select-all-btn"));

    // All cases should be checked
    mockCases.forEach((c) => {
      const caseItem = screen.getByTestId(`case-selection-item-${c._id}`);
      expect(within(caseItem).getByRole("checkbox")).toHaveAttribute(
        "data-state",
        "checked"
      );
    });
  });

  it("only selects filtered cases when search is active", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    // Search for "Corp"
    await user.type(screen.getByTestId("case-search-input"), "Corp");

    await waitFor(() => {
      expect(screen.queryByText("Beta Inc")).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId("select-all-btn"));

    // Save and check what was passed
    await user.click(screen.getByTestId("save-selection-btn"));

    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(["1", "4"])
    );
    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.not.arrayContaining(["2", "3", "5"])
    );
  });
});

// ============================================================================
// DESELECT ALL BUTTON TESTS
// ============================================================================

describe("CaseSelectionModal - Deselect All Button", () => {
  it("deselects all visible cases when clicked", async () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1", "2", "3", "4", "5"]),
    });
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.click(screen.getByTestId("deselect-all-btn"));

    // All cases should be unchecked
    mockCases.forEach((c) => {
      const caseItem = screen.getByTestId(`case-selection-item-${c._id}`);
      expect(within(caseItem).getByRole("checkbox")).toHaveAttribute(
        "data-state",
        "unchecked"
      );
    });
  });

  it("only deselects filtered cases, keeps others selected", async () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1", "2", "3", "4", "5"]),
    });
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    // Search for "Corp"
    await user.type(screen.getByTestId("case-search-input"), "Corp");

    await waitFor(() => {
      expect(screen.queryByText("Beta Inc")).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId("deselect-all-btn"));

    // Save and check: Beta Inc (2), Closed LLC (3), Alpha Labs (5) should remain
    await user.click(screen.getByTestId("save-selection-btn"));

    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(["2", "3", "5"])
    );
    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.not.arrayContaining(["1", "4"])
    );
  });
});

// ============================================================================
// ACTIVE ONLY BUTTON TESTS
// ============================================================================

describe("CaseSelectionModal - Active Only Button", () => {
  it("selects only non-closed cases", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.click(screen.getByTestId("active-only-btn"));
    await user.click(screen.getByTestId("save-selection-btn"));

    // Should select 1, 2, 4, 5 but not 3 (closed)
    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(["1", "2", "4", "5"])
    );
    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.not.arrayContaining(["3"])
    );
  });
});

// ============================================================================
// SAVE CHANGES BUTTON TESTS
// ============================================================================

describe("CaseSelectionModal - Save Changes", () => {
  it("calls onSelectionChange with selected IDs", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    // Select some cases
    await user.click(screen.getByTestId("case-selection-item-1"));
    await user.click(screen.getByTestId("case-selection-item-3"));

    await user.click(screen.getByTestId("save-selection-btn"));

    expect(props.onSelectionChange).toHaveBeenCalledTimes(1);
    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(["1", "3"])
    );
  });

  it("calls onClose after saving", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.click(screen.getByTestId("save-selection-btn"));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("saves empty array when nothing selected", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.click(screen.getByTestId("save-selection-btn"));

    expect(props.onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("saves correct IDs when some cases are toggled off", async () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1", "2", "3"]),
    });
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    // Deselect case 2
    await user.click(screen.getByTestId("case-selection-item-2"));

    await user.click(screen.getByTestId("save-selection-btn"));

    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(["1", "3"])
    );
    expect(props.onSelectionChange).toHaveBeenCalledWith(
      expect.not.arrayContaining(["2"])
    );
  });
});

// ============================================================================
// CANCEL BUTTON TESTS
// ============================================================================

describe("CaseSelectionModal - Cancel", () => {
  it("calls onClose when Cancel is clicked", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelectionChange when Cancel is clicked", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    // Make some changes
    await user.click(screen.getByTestId("case-selection-item-1"));
    await user.click(screen.getByTestId("case-selection-item-2"));

    // Cancel
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onSelectionChange).not.toHaveBeenCalled();
  });

  it("resets selection to original when reopened after cancel", async () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1"]),
    });
    const { user, rerender } = renderWithProviders(
      <CaseSelectionModal {...props} />
    );

    // Make changes
    await user.click(screen.getByTestId("case-selection-item-2"));

    // Cancel
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Close and reopen modal
    rerender(<CaseSelectionModal {...props} isOpen={false} />);
    rerender(<CaseSelectionModal {...props} isOpen={true} />);

    // Should show original selection
    const case1 = screen.getByTestId("case-selection-item-1");
    const case2 = screen.getByTestId("case-selection-item-2");

    expect(within(case1).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
    expect(within(case2).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
  });
});

// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe("CaseSelectionModal - Empty State", () => {
  it("shows empty message when no cases match search", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.type(
      screen.getByTestId("case-search-input"),
      "NonexistentCompany"
    );

    await waitFor(() => {
      expect(
        screen.getByText("No cases match your search or filter")
      ).toBeInTheDocument();
    });
  });

  it("shows empty message when filter returns no results", async () => {
    // All cases are active, so filtering to a specific status that doesn't exist
    const singleStatusCases = mockCases.filter((c) => c.caseStatus === "pwd");
    const props = createDefaultProps({
      allCases: singleStatusCases,
    });
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    // Change filter to recruitment (which has no cases)
    const filterSelect = screen.getByTestId("case-filter-select");
    await user.selectOptions(filterSelect, "recruitment");

    await waitFor(() => {
      expect(
        screen.getByText("No cases match your search or filter")
      ).toBeInTheDocument();
    });
  });

  it("shows 'No cases available' when allCases is empty", () => {
    const props = createDefaultProps({
      allCases: [],
    });
    renderWithProviders(<CaseSelectionModal {...props} />);

    expect(screen.getByText("No cases available")).toBeInTheDocument();
  });
});

// ============================================================================
// SEARCH FUNCTIONALITY TESTS
// ============================================================================

describe("CaseSelectionModal - Search Functionality", () => {
  it("filters cases by employer name", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.type(screen.getByTestId("case-search-input"), "Acme");

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.queryByText("Beta Inc")).not.toBeInTheDocument();
    });
  });

  it("filters cases by position title", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.type(screen.getByTestId("case-search-input"), "Manager");

    await waitFor(() => {
      expect(screen.getByText("Beta Inc")).toBeInTheDocument();
      expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    });
  });

  it("search is case-insensitive", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    await user.type(screen.getByTestId("case-search-input"), "ACME");

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
  });

  it("clears search when input is cleared", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const searchInput = screen.getByTestId("case-search-input");
    await user.type(searchInput, "Acme");

    await waitFor(() => {
      expect(screen.queryByText("Beta Inc")).not.toBeInTheDocument();
    });

    await user.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByText("Beta Inc")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// SORT FUNCTIONALITY TESTS
// ============================================================================

describe("CaseSelectionModal - Sort Functionality", () => {
  it("sorts by name alphabetically by default", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    const container = screen.getByTestId("case-list-container");
    const caseNames = within(container)
      .getAllByRole("button")
      .map((el) => within(el).getByText(/Corp|Inc|LLC|Labs/).textContent);

    // Alphabetical order
    expect(caseNames).toEqual([
      "Acme Corp",
      "Alpha Labs",
      "Beta Inc",
      "Closed LLC",
      "Delta Corp",
    ]);
  });

  it("changes sort when sort dropdown changes", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const sortSelect = screen.getByTestId("case-sort-select");
    await user.selectOptions(sortSelect, "date");

    const container = screen.getByTestId("case-list-container");
    const firstCase = within(container).getAllByRole("button")[0];

    // Newest first (createdAt: 5000) is Alpha Labs
    expect(within(firstCase).getByText("Alpha Labs")).toBeInTheDocument();
  });
});

// ============================================================================
// FILTER FUNCTIONALITY TESTS
// ============================================================================

describe("CaseSelectionModal - Filter Functionality", () => {
  it("filters to active cases when Active is selected", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const filterSelect = screen.getByTestId("case-filter-select");
    await user.selectOptions(filterSelect, "active");

    await waitFor(() => {
      expect(screen.queryByText("Closed LLC")).not.toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
  });

  it("filters to specific status when selected", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const filterSelect = screen.getByTestId("case-filter-select");
    await user.selectOptions(filterSelect, "pwd");

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.queryByText("Beta Inc")).not.toBeInTheDocument();
      expect(screen.queryByText("Closed LLC")).not.toBeInTheDocument();
    });
  });

  it("shows closed cases when Complete filter is selected", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const filterSelect = screen.getByTestId("case-filter-select");
    await user.selectOptions(filterSelect, "closed");

    await waitFor(() => {
      expect(screen.getByText("Closed LLC")).toBeInTheDocument();
      expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// KEYBOARD ACCESSIBILITY TESTS
// ============================================================================

describe("CaseSelectionModal - Keyboard Accessibility", () => {
  it("case items are focusable", () => {
    const props = createDefaultProps();
    renderWithProviders(<CaseSelectionModal {...props} />);

    const caseItem = screen.getByTestId("case-selection-item-1");
    expect(caseItem).toHaveAttribute("tabIndex", "0");
  });

  it("pressing Enter on case item toggles selection", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const caseItem = screen.getByTestId("case-selection-item-1");
    caseItem.focus();
    await user.keyboard("{Enter}");

    expect(within(caseItem).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
  });

  it("pressing Space on case item toggles selection", async () => {
    const props = createDefaultProps();
    const { user } = renderWithProviders(<CaseSelectionModal {...props} />);

    const caseItem = screen.getByTestId("case-selection-item-1");
    caseItem.focus();
    await user.keyboard(" ");

    expect(within(caseItem).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
  });
});

// ============================================================================
// DIALOG BEHAVIOR TESTS
// ============================================================================

describe("CaseSelectionModal - Dialog Behavior", () => {
  it("syncs local selection when modal opens", () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1", "2"]),
    });
    renderWithProviders(<CaseSelectionModal {...props} />);

    const case1 = screen.getByTestId("case-selection-item-1");
    const case2 = screen.getByTestId("case-selection-item-2");
    const case3 = screen.getByTestId("case-selection-item-3");

    expect(within(case1).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
    expect(within(case2).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
    expect(within(case3).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
  });

  it("updates local selection when selectedIds prop changes", () => {
    const props = createDefaultProps({
      selectedIds: new Set(["1"]),
    });
    const { rerender } = renderWithProviders(
      <CaseSelectionModal {...props} />
    );

    // Initially case 1 is selected
    let case1 = screen.getByTestId("case-selection-item-1");
    expect(within(case1).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );

    // Update selectedIds prop
    const newProps = {
      ...props,
      selectedIds: new Set(["2", "3"]),
    };
    rerender(<CaseSelectionModal {...newProps} />);

    // Now case 2 and 3 should be selected, case 1 should not
    case1 = screen.getByTestId("case-selection-item-1");
    const case2 = screen.getByTestId("case-selection-item-2");
    const case3 = screen.getByTestId("case-selection-item-3");

    expect(within(case1).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
    expect(within(case2).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
    expect(within(case3).getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked"
    );
  });
});
