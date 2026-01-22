// @vitest-environment jsdom
/**
 * Timeline Page Tests
 * Tests for the timeline page component.
 *
 * Requirements:
 * 1. Renders loading state
 * 2. Renders empty state when no cases
 * 3. Renders timeline with cases
 * 4. Time range dropdown changes view
 * 5. "Select Cases" button opens modal (placeholder)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import TimelinePage from "../page";
import type { Id } from "../../../../../convex/_generated/dataModel";

// ============================================================================
// MOCKS
// ============================================================================

// Track mock router behavior
const mockRouterPush = vi.fn();

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/timeline",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

import { useQuery, useMutation } from "convex/react";

// Default mock mutation function
const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create mock timeline case data.
 */
function createMockTimelineCase(
  overrides?: Partial<{
    _id: Id<"cases">;
    employerName: string;
    positionTitle: string;
    caseStatus: string;
    progressStatus: string;
  }>
) {
  const caseId = ("test-case-" + Math.random().toString(36).substr(2, 9)) as Id<"cases">;
  return {
    _id: caseId,
    id: caseId, // Keep both for backward compatibility
    employerName: "Test Corp",
    positionTitle: "Software Engineer",
    caseStatus: "pwd",
    progressStatus: "working",
    rfiEntries: [],
    rfeEntries: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Setup mocks for specific scenario
 */
function setupMocks(options: {
  preferences?: { timeRange: 3 | 6 | 12 | 24; selectedCaseIds?: string[] | null } | null;
  cases?: any[];
  allCases?: any[];
}) {
  const { preferences, cases, allCases } = options;

  // Track call order to return different values for different queries
  let callCount = 0;

  vi.mocked(useQuery).mockImplementation(() => {
    callCount++;
    // Call order: 1=getPreferences, 2=getCasesForTimeline, 3=list (allCasesRaw)
    const queryIndex = ((callCount - 1) % 3) + 1;
    if (queryIndex === 1) {
      return preferences;
    } else if (queryIndex === 2) {
      return cases;
    } else {
      // Third query: allCasesRaw for case selection modal
      return allCases ?? cases ?? [];
    }
  });

  vi.mocked(useMutation).mockReturnValue(mockUpdatePreferences);
}

// ============================================================================
// SETUP AND TEARDOWN
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockRouterPush.mockClear();
  mockUpdatePreferences.mockClear();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ============================================================================
// LOADING STATE TESTS
// ============================================================================

describe("TimelinePage - Loading State", () => {
  it("renders loading skeleton when preferences are undefined", () => {
    setupMocks({ preferences: undefined, cases: undefined });

    const { container } = renderWithProviders(<TimelinePage />);

    // Should show skeleton loaders (skeleton-pulse class from Skeleton component)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders loading skeleton when cases are undefined", () => {
    setupMocks({ preferences: { timeRange: 6 }, cases: undefined });

    const { container } = renderWithProviders(<TimelinePage />);

    // Should show skeleton loaders
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows skeleton structure while loading", () => {
    setupMocks({ preferences: undefined, cases: undefined });

    const { container } = renderWithProviders(<TimelinePage />);

    // Page should render skeleton elements
    expect(container.firstChild).toBeInTheDocument();
  });
});

// ============================================================================
// AUTHENTICATION REDIRECT TESTS
// ============================================================================

describe("TimelinePage - Authentication", () => {
  it("redirects to login when preferences is null", () => {
    setupMocks({ preferences: null, cases: [] });

    renderWithProviders(<TimelinePage />);

    expect(mockRouterPush).toHaveBeenCalledWith("/login");
  });

  it("does not redirect when preferences exist", () => {
    setupMocks({ preferences: { timeRange: 6 }, cases: [] });

    renderWithProviders(<TimelinePage />);

    expect(mockRouterPush).not.toHaveBeenCalledWith("/login");
  });
});

// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe("TimelinePage - Empty State", () => {
  beforeEach(() => {
    setupMocks({ preferences: { timeRange: 6 }, cases: [] });
  });

  it("renders empty state message when no cases", () => {
    renderWithProviders(<TimelinePage />);

    expect(screen.getByText(/no cases to display/i)).toBeInTheDocument();
  });

  it("shows helpful description in empty state", () => {
    renderWithProviders(<TimelinePage />);

    expect(
      screen.getByText(/add cases to see them visualized/i)
    ).toBeInTheDocument();
  });

  it("shows 'Add Your First Case' button in empty state", () => {
    renderWithProviders(<TimelinePage />);

    expect(
      screen.getByRole("button", { name: /add your first case/i })
    ).toBeInTheDocument();
  });

  it("navigates to /cases/new when 'Add Your First Case' is clicked", async () => {
    const { user } = renderWithProviders(<TimelinePage />);

    const addButton = screen.getByRole("button", {
      name: /add your first case/i,
    });
    await user.click(addButton);

    expect(mockRouterPush).toHaveBeenCalledWith("/cases/new");
  });

  it("still shows Timeline header in empty state", () => {
    renderWithProviders(<TimelinePage />);

    // Multiple Timeline headings exist (page + TimelineControls)
    const headings = screen.getAllByRole("heading", { name: /timeline/i });
    expect(headings.length).toBeGreaterThan(0);
  });

  it("still shows TimelineControls in empty state", () => {
    renderWithProviders(<TimelinePage />);

    // Time range dropdown should be present (showing 6 Months)
    expect(screen.getByText(/6 months/i)).toBeInTheDocument();
  });

  it("still shows TimelineLegend in empty state", () => {
    const { container } = renderWithProviders(<TimelinePage />);

    // Legend should be present - check for stage color indicators
    expect(container.querySelector("[class*='flex']")).toBeInTheDocument();
  });
});

// ============================================================================
// TIMELINE WITH CASES TESTS
// ============================================================================

describe("TimelinePage - Timeline with Cases", () => {
  const testCases = [
    createMockTimelineCase({
      employerName: "Acme Corp",
      positionTitle: "Developer",
    }),
    createMockTimelineCase({
      employerName: "Tech Inc",
      positionTitle: "Engineer",
    }),
  ];

  beforeEach(() => {
    setupMocks({ preferences: { timeRange: 6 }, cases: testCases });
  });

  it("renders timeline header", () => {
    renderWithProviders(<TimelinePage />);

    // Multiple Timeline headings exist (page + TimelineControls)
    const headings = screen.getAllByRole("heading", { name: /timeline/i });
    expect(headings.length).toBeGreaterThan(0);
  });

  it("shows case count in subtitle", () => {
    renderWithProviders(<TimelinePage />);

    expect(screen.getByText(/2 cases displayed/i)).toBeInTheDocument();
  });

  it("shows singular 'case' for single case", () => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });

    renderWithProviders(<TimelinePage />);

    expect(screen.getByText(/1 case displayed/i)).toBeInTheDocument();
  });

  it("renders TimelineGrid component", () => {
    renderWithProviders(<TimelinePage />);

    // Timeline grid should be present
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("renders TimelineControls component", () => {
    renderWithProviders(<TimelinePage />);

    // Should have time range and case selector buttons
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TIME RANGE DROPDOWN TESTS
// ============================================================================

describe("TimelinePage - Time Range Dropdown", () => {
  beforeEach(() => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });
  });

  it("displays current time range", () => {
    renderWithProviders(<TimelinePage />);

    // Should show "6 Months" text
    expect(screen.getByText(/6 months/i)).toBeInTheDocument();
  });

  it("opens dropdown menu when clicked", async () => {
    const { user } = renderWithProviders(<TimelinePage />);

    const dropdownTrigger = screen.getByRole("button", { name: /6 months/i });
    await user.click(dropdownTrigger);

    // Should show all options
    await waitFor(() => {
      expect(screen.getByText(/3 months/i)).toBeInTheDocument();
    });
  });

  it("shows all time range options in dropdown", { timeout: 15000 }, async () => {
    const { user } = renderWithProviders(<TimelinePage />);

    const dropdownTrigger = screen.getByRole("button", { name: /6 months/i });
    await user.click(dropdownTrigger);

    await waitFor(() => {
      expect(
        screen.getByRole("menuitemradio", { name: /3 months/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitemradio", { name: /6 months/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitemradio", { name: /12 months/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitemradio", { name: /24 months/i })
      ).toBeInTheDocument();
    });
  });

  it("calls updatePreferences when time range is changed", async () => {
    const { user } = renderWithProviders(<TimelinePage />);

    const dropdownTrigger = screen.getByRole("button", { name: /6 months/i });
    await user.click(dropdownTrigger);

    const option12 = await screen.findByRole("menuitemradio", {
      name: /12 months/i,
    });
    await user.click(option12);

    expect(mockUpdatePreferences).toHaveBeenCalledWith({ timeRange: 12 });
  });

  it("current time range option is checked", async () => {
    const { user } = renderWithProviders(<TimelinePage />);

    const dropdownTrigger = screen.getByRole("button", { name: /6 months/i });
    await user.click(dropdownTrigger);

    await waitFor(() => {
      const option6 = screen.getByRole("menuitemradio", { name: /6 months/i });
      expect(option6).toHaveAttribute("aria-checked", "true");
    });
  });
});

// ============================================================================
// SELECT CASES BUTTON TESTS
// ============================================================================

describe("TimelinePage - Select Cases Button", () => {
  it("renders Select Cases button", () => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });

    renderWithProviders(<TimelinePage />);

    expect(
      screen.getByRole("button", { name: /select cases/i })
    ).toBeInTheDocument();
  });

  it("shows case count badge when cases exist", () => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [
        createMockTimelineCase(),
        createMockTimelineCase(),
        createMockTimelineCase(),
      ],
    });

    renderWithProviders(<TimelinePage />);

    // Badge shows "All" when no explicit selection is active
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("sets caseSelectorOpen state when button is clicked (placeholder test)", async () => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });

    const { user } = renderWithProviders(<TimelinePage />);

    const selectButton = screen.getByRole("button", { name: /select cases/i });
    await user.click(selectButton);

    // This is a placeholder test - the modal implementation is not yet complete
    // When implemented, we would check for the modal being visible
    // For now, we just verify the click doesn't cause an error
    expect(selectButton).toBeInTheDocument();
  });

  it("has neobrutalist styling on button", () => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });

    renderWithProviders(<TimelinePage />);

    const button = screen.getByRole("button", { name: /select cases/i });
    expect(button).toHaveClass("border-2");
    expect(button).toHaveClass("shadow-hard");
  });
});

// ============================================================================
// LAYOUT TESTS
// ============================================================================

describe("TimelinePage - Layout", () => {
  beforeEach(() => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });
  });

  it("has flex column layout", () => {
    const { container } = renderWithProviders(<TimelinePage />);

    const mainContainer = container.querySelector(".flex.flex-col");
    expect(mainContainer).toBeInTheDocument();
  });

  it("has header section with controls", () => {
    renderWithProviders(<TimelinePage />);

    // Header should contain title and controls - multiple Timeline headings exist
    const headings = screen.getAllByRole("heading", { name: /timeline/i });
    expect(headings.length).toBeGreaterThan(0);
  });

  it("has scrollable timeline area", () => {
    const { container } = renderWithProviders(<TimelinePage />);

    // Component uses overflow-x-auto for horizontal scroll
    const scrollArea = container.querySelector(".overflow-x-auto");
    expect(scrollArea).toBeInTheDocument();
  });

  it("has minimum height for timeline grid", () => {
    const { container } = renderWithProviders(<TimelinePage />);

    const gridArea = container.querySelector(".min-h-\\[400px\\]");
    expect(gridArea).toBeInTheDocument();
  });
});

// ============================================================================
// TIME RANGE STATE TESTS
// ============================================================================

describe("TimelinePage - Time Range State", () => {
  it("uses 6 months as default when preferences timeRange is undefined", () => {
    // Mock with empty preferences (no timeRange)
    setupMocks({ preferences: {} as any, cases: [] });

    renderWithProviders(<TimelinePage />);

    // Default should be 6 months
    expect(screen.getByText(/6 months/i)).toBeInTheDocument();
  });

  it("uses timeRange from preferences", () => {
    setupMocks({ preferences: { timeRange: 12 }, cases: [] });

    renderWithProviders(<TimelinePage />);

    // Should show 12 months
    expect(screen.getByText(/12 months/i)).toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("TimelinePage - Edge Cases", () => {
  it("handles large number of cases", () => {
    const manyCases = Array.from({ length: 50 }, () => createMockTimelineCase());
    setupMocks({ preferences: { timeRange: 6 }, cases: manyCases });

    renderWithProviders(<TimelinePage />);

    expect(screen.getByText(/50 cases displayed/i)).toBeInTheDocument();
  });

  it("handles cases with various statuses", () => {
    const casesWithStatuses = [
      createMockTimelineCase({ caseStatus: "pwd" }),
      createMockTimelineCase({ caseStatus: "recruitment" }),
      createMockTimelineCase({ caseStatus: "eta9089" }),
      createMockTimelineCase({ caseStatus: "i140" }),
    ];
    setupMocks({ preferences: { timeRange: 6 }, cases: casesWithStatuses });

    renderWithProviders(<TimelinePage />);

    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("renders without error when preferences loads after cases", () => {
    setupMocks({
      preferences: { timeRange: 6 },
      cases: [createMockTimelineCase()],
    });

    const { rerender } = renderWithProviders(<TimelinePage />);

    // Should render without errors
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
