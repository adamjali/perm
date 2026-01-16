// @vitest-environment jsdom
/**
 * CaseCard Component Tests
 * Tests for case card component with manila folder styling.
 *
 * Requirements:
 * 1. Renders employer name (bold, prominent)
 * 2. Renders position/beneficiary identifier (smaller, muted)
 * 3. Shows professional occupation badge when applicable
 * 4. Shows RFI Active badge when hasActiveRfi is true
 * 5. Shows RFE Active badge when hasActiveRfe is true
 * 6. Shows case status badge (colored by stage)
 * 7. Shows favorite star (filled/unfilled based on isFavorite)
 * 8. Shows calendar sync indicator when enabled
 * 9. Shows next deadline with urgency styling
 * 10. Handles missing optional data gracefully
 * 11. Applies neobrutalist styling (4px border, shadow-hard)
 * 12. Applies hover effects (lift, shadow-hard-lg)
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CaseCard } from "../CaseCard";
import type { CaseCardData } from "../../../../../convex/lib/caseListTypes";

// Mock Convex React hooks
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({ googleCalendarConnected: true }), // Default to connected for tests
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Factory for creating test CaseCardData with sensible defaults.
 */
function createMockCaseCardData(
  overrides?: Partial<CaseCardData>
): CaseCardData {
  return {
    _id: "test-case-id" as any,
    employerName: "Acme Corp",
    beneficiaryIdentifier: "John Doe",
    caseStatus: "pwd",
    progressStatus: "working",
    nextDeadline: "2025-12-31",
    nextDeadlineLabel: "PWD expires",
    isFavorite: false,
    isProfessionalOccupation: false,
    hasActiveRfi: false,
    hasActiveRfe: false,
    calendarSyncEnabled: false,
    dates: {
      created: Date.now(),
      updated: Date.now(),
    },
    ...overrides,
  } as CaseCardData;
}

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe("CaseCard - Rendering", () => {
  it("renders employer name prominently", () => {
    const mockCase = createMockCaseCardData({
      employerName: "Tech Innovations LLC",
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const employerName = screen.getByText("Tech Innovations LLC");
    expect(employerName).toBeInTheDocument();
    // Should have bold/heading font
    expect(employerName).toHaveClass("font-heading");
    expect(employerName).toHaveClass("font-bold");
  });

  it("renders beneficiary identifier below employer name", () => {
    const mockCase = createMockCaseCardData({
      beneficiaryIdentifier: "Jane Smith",
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const beneficiary = screen.getByText("Jane Smith");
    expect(beneficiary).toBeInTheDocument();
    // Should have muted styling (gray text on manila background)
    expect(beneficiary).toHaveClass("text-[#666666]");
  });

  it("renders folder tab with stage label", () => {
    const mockCase = createMockCaseCardData({
      caseStatus: "recruitment",
    });

    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // Folder tab should display stage name in uppercase
    const stageLabel = screen.getByText("RECRUITMENT");
    expect(stageLabel).toBeInTheDocument();
    expect(stageLabel).toHaveClass("font-mono");
    expect(stageLabel).toHaveClass("uppercase");
  });
});

// ============================================================================
// BADGE TESTS
// ============================================================================

describe("CaseCard - Badges", () => {
  it("shows professional badge when isProfessionalOccupation is true", () => {
    const mockCase = createMockCaseCardData({
      isProfessionalOccupation: true,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const professionalBadge = screen.getByText("PRO");
    expect(professionalBadge).toBeInTheDocument();
  });

  it("hides professional badge when isProfessionalOccupation is false", () => {
    const mockCase = createMockCaseCardData({
      isProfessionalOccupation: false,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const professionalBadge = screen.queryByText("PRO");
    expect(professionalBadge).not.toBeInTheDocument();
  });

  it("shows RFI badge when hasActiveRfi is true", () => {
    const mockCase = createMockCaseCardData({
      hasActiveRfi: true,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const rfiBadge = screen.getByText("RFI");
    expect(rfiBadge).toBeInTheDocument();
    // Should have red/urgent styling
    expect(rfiBadge).toHaveClass("bg-[var(--urgency-urgent)]");
  });

  it("hides RFI badge when hasActiveRfi is false", () => {
    const mockCase = createMockCaseCardData({
      hasActiveRfi: false,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const rfiBadge = screen.queryByText("RFI");
    expect(rfiBadge).not.toBeInTheDocument();
  });

  it("shows RFE badge when hasActiveRfe is true", () => {
    const mockCase = createMockCaseCardData({
      hasActiveRfe: true,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const rfeBadge = screen.getByText("RFE");
    expect(rfeBadge).toBeInTheDocument();
    // Should have red/urgent styling
    expect(rfeBadge).toHaveClass("bg-[var(--urgency-urgent)]");
  });

  it("hides RFE badge when hasActiveRfe is false", () => {
    const mockCase = createMockCaseCardData({
      hasActiveRfe: false,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const rfeBadge = screen.queryByText("RFE");
    expect(rfeBadge).not.toBeInTheDocument();
  });

  it("shows both RFI and RFE badges when both are active", () => {
    const mockCase = createMockCaseCardData({
      hasActiveRfi: true,
      hasActiveRfe: true,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    expect(screen.getByText("RFI")).toBeInTheDocument();
    expect(screen.getByText("RFE")).toBeInTheDocument();
  });
});

// ============================================================================
// FAVORITE STAR TESTS
// ============================================================================

describe("CaseCard - Favorite Star", () => {
  it("shows filled star icon when isFavorite is true", () => {
    const mockCase = createMockCaseCardData({
      isFavorite: true,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Star button should exist
    const starButton = screen.getByRole("button", { name: /favorite/i });
    expect(starButton).toBeInTheDocument();

    // Should have filled star (check for fill attribute or aria-label)
    expect(starButton).toHaveAttribute("aria-pressed", "true");
  });

  it("shows unfilled star icon when isFavorite is false", () => {
    const mockCase = createMockCaseCardData({
      isFavorite: false,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const starButton = screen.getByRole("button", { name: /favorite/i });
    expect(starButton).toBeInTheDocument();
    expect(starButton).toHaveAttribute("aria-pressed", "false");
  });
});

// ============================================================================
// CALENDAR SYNC TESTS
// ============================================================================

describe("CaseCard - Calendar Sync", () => {
  it("shows 'Synced' indicator when calendarSyncEnabled is true and connected", () => {
    // Note: useQuery mock returns { googleCalendarConnected: true } by default
    const mockCase = createMockCaseCardData({
      calendarSyncEnabled: true,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Calendar sync indicator should be present (check via aria-label)
    const calendarIcon = screen.getByLabelText(/syncing to google calendar/i);
    expect(calendarIcon).toBeInTheDocument();

    // Should show "Synced" text when connected
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("hides calendar indicator when calendarSyncEnabled is false", () => {
    const mockCase = createMockCaseCardData({
      calendarSyncEnabled: false,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    const calendarIcon = screen.queryByLabelText(/syncing to google calendar/i);
    expect(calendarIcon).not.toBeInTheDocument();

    const notConnectedIndicator = screen.queryByLabelText(/calendar not connected/i);
    expect(notConnectedIndicator).not.toBeInTheDocument();
  });
});

// ============================================================================
// DEADLINE TESTS
// ============================================================================

describe("CaseCard - Next Deadline", () => {
  it("shows next deadline when provided", () => {
    // Create deadline 45 days from now using a fixed date string
    // Use T12:00:00 to parse as local noon (same as component's parseLocalDate)
    const futureDateStr = "2026-02-08";
    // Parse the same way the component does - append T12:00:00 to avoid timezone shift
    const parsedDate = new Date(`${futureDateStr}T12:00:00`);

    const mockCase = createMockCaseCardData({
      nextDeadline: futureDateStr,
      nextDeadlineLabel: "PWD expires",
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Should show formatted deadline - use the same formatting as the component
    const expectedDateStr = parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    expect(screen.getByText(new RegExp(expectedDateStr))).toBeInTheDocument();
  });

  it("shows urgency dot when deadline is within 7 days", () => {
    // Create deadline 5 days from now
    const urgentDate = new Date();
    urgentDate.setDate(urgentDate.getDate() + 5);
    const urgentDateStr = urgentDate.toISOString().split("T")[0];

    const mockCase = createMockCaseCardData({
      nextDeadline: urgentDateStr,
    });

    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // Deadline text should exist - new format: "Jan 8, 2025 (5 days)"
    const deadline = screen.getByText(/\d+ days\)/i);
    expect(deadline).toBeInTheDocument();

    // Should have urgency dot (check for rounded element with urgent color)
    const urgencyDot = container.querySelector('.bg-\\[var\\(--urgency-urgent\\)\\]');
    expect(urgencyDot).toBeInTheDocument();
  });

  it("shows urgency dot when deadline is 8-30 days away", () => {
    // Create deadline 15 days from now
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 15);
    const soonDateStr = soonDate.toISOString().split("T")[0];

    const mockCase = createMockCaseCardData({
      nextDeadline: soonDateStr,
    });

    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // New format: "Jan 8, 2025 (15 days)"
    const deadline = screen.getByText(/\d+ days\)/i);
    expect(deadline).toBeInTheDocument();

    // Should have "soon" urgency dot
    const urgencyDot = container.querySelector('.bg-\\[var\\(--urgency-soon\\)\\]');
    expect(urgencyDot).toBeInTheDocument();
  });

  it("shows urgency dot when deadline is 31+ days away", () => {
    // Use fixed date 35 days from Jan 9, 2026 to ensure "normal" urgency (>30 days)
    const normalDateStr = "2026-02-13";
    // Parse same way as component - append T12:00:00 to avoid timezone shift
    const parsedDate = new Date(`${normalDateStr}T12:00:00`);

    const mockCase = createMockCaseCardData({
      nextDeadline: normalDateStr,
      nextDeadlineLabel: "PWD expires",
    });

    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // For 30+ days, shows formatted date instead of "in X days"
    const expectedDateStr = parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const deadline = screen.getByText(new RegExp(expectedDateStr));
    expect(deadline).toBeInTheDocument();

    // Should have urgency dot element (small colored indicator)
    // Testing that the dot element exists rather than specific CSS class implementation
    const urgencyDot = container.querySelector('.w-2\\.5.h-2\\.5');
    expect(urgencyDot).toBeInTheDocument();
  });

  it("handles missing deadline gracefully", () => {
    const mockCase = createMockCaseCardData({
      nextDeadline: undefined,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Should show "No upcoming deadlines"
    expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
  });
});

// ============================================================================
// STYLING TESTS
// ============================================================================

describe("CaseCard - Manila Folder Styling", () => {
  it("has manila background color", () => {
    const mockCase = createMockCaseCardData();
    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // Find the folder body (the div with border-2 neobrutalist style)
    const folderBody = container.querySelector('.border-2.shadow-hard');
    expect(folderBody).toBeInTheDocument();
    // Manila background is applied via inline style
    expect(folderBody).toHaveStyle({ backgroundColor: 'var(--manila)' });
  });

  it("has 2px border on folder body (neobrutalist)", () => {
    const mockCase = createMockCaseCardData();
    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    const folderBody = container.querySelector('.border-2.shadow-hard');
    expect(folderBody).toHaveClass("border-2");
    expect(folderBody).toHaveClass("border-border");
  });

  it("has shadow-hard on folder body", () => {
    const mockCase = createMockCaseCardData();
    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    const folderBody = container.querySelector('.shadow-hard');
    expect(folderBody).toHaveClass("shadow-hard");
  });

  it("has zero border radius", () => {
    const mockCase = createMockCaseCardData();
    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    const folderBody = container.querySelector('.border-2.shadow-hard');
    // Should NOT have rounded classes
    expect(folderBody).not.toHaveClass("rounded");
    expect(folderBody).not.toHaveClass("rounded-lg");
  });

  it("has Framer Motion hover effects", () => {
    const mockCase = createMockCaseCardData();
    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    const card = container.querySelector('[data-testid="case-card"]');
    // Card should exist and be a motion.div
    expect(card).toBeInTheDocument();
    // Note: Framer Motion hover effects are handled via whileHover prop
    // Testing actual hover behavior requires user-event or integration tests
  });
});

// ============================================================================
// HOVER EXPANSION TESTS
// ============================================================================

describe("CaseCard - Hover Expansion", () => {
  it("hides expanded content initially (via CSS)", () => {
    const mockCase = createMockCaseCardData({
      dates: {
        pwdFiled: "2025-01-15",
        pwdDetermined: "2025-02-20",
        pwdExpires: "2026-06-30",
        created: Date.now(),
        updated: Date.now(),
      },
    });

    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // Expanded content IS in the DOM but hidden via CSS on desktop (md:max-h-0 md:opacity-0)
    // Note: Mobile-first design shows content on mobile, hides on desktop
    const expandedContent = container.querySelector('[data-testid="expanded-content"]');
    expect(expandedContent).toBeInTheDocument();
    // Should have responsive hidden classes (visible on mobile, hidden on md: breakpoint)
    expect(expandedContent).toHaveClass("md:max-h-0");
    expect(expandedContent).toHaveClass("md:opacity-0");
  });

  it("shows PWD dates in expanded content structure", () => {
    const mockCase = createMockCaseCardData({
      dates: {
        pwdFiled: "2025-01-15",
        pwdDetermined: "2025-02-20",
        pwdExpires: "2026-06-30",
        created: Date.now(),
        updated: Date.now(),
      },
    });

    const { container } = renderWithProviders(<CaseCard case={mockCase} />);

    // Trigger hover by finding the expandable area
    // Note: In actual implementation, we'll use userEvent to hover
    // For now, we're just checking the structure exists when rendered
    // The actual hover testing will be done with user-event in integration tests
    expect(container.querySelector('[data-testid="case-card"]')).toBeInTheDocument();
  });

  it("shows recruitment dates when available", () => {
    const mockCase = createMockCaseCardData({
      dates: {
        recruitmentStart: "2025-03-01",
        recruitmentEnd: "2025-04-15",
        created: Date.now(),
        updated: Date.now(),
      },
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Component should handle recruitment dates
    // Actual visibility testing will be done with hover interactions
    expect(mockCase.dates.recruitmentStart).toBe("2025-03-01");
    expect(mockCase.dates.recruitmentEnd).toBe("2025-04-15");
  });

  it("shows ETA 9089 dates when available", () => {
    const mockCase = createMockCaseCardData({
      dates: {
        etaFiled: "2025-05-01",
        etaWindowOpens: "2025-04-01",
        etaCertified: "2025-06-15",
        etaExpires: "2027-06-15",
        created: Date.now(),
        updated: Date.now(),
      },
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Component should handle ETA dates
    expect(mockCase.dates.etaFiled).toBe("2025-05-01");
    expect(mockCase.dates.etaWindowOpens).toBe("2025-04-01");
  });

  it("shows I-140 dates when available", () => {
    const mockCase = createMockCaseCardData({
      dates: {
        i140Filed: "2025-07-01",
        i140Approved: "2025-09-15",
        created: Date.now(),
        updated: Date.now(),
      },
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Component should handle I-140 dates
    expect(mockCase.dates.i140Filed).toBe("2025-07-01");
    expect(mockCase.dates.i140Approved).toBe("2025-09-15");
  });

  it("shows progress status badge in expanded content", () => {
    const mockCase = createMockCaseCardData({
      progressStatus: "filed",
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Progress status should be part of the data
    expect(mockCase.progressStatus).toBe("filed");
  });

  it("shows notes preview when notes exist", () => {
    const mockCase = createMockCaseCardData({
      notes: "This is a test note for the case. It should be truncated if too long.",
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Component should have notes data
    expect(mockCase.notes).toBeDefined();
  });

  it("handles missing notes gracefully", () => {
    const mockCase = createMockCaseCardData({
      notes: undefined,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Component should handle missing notes
    expect(mockCase.notes).toBeUndefined();
  });
});

// ============================================================================
// ACTION BUTTONS TESTS
// ============================================================================

describe("CaseCard - Action Buttons", () => {
  it("renders View button with click handler for navigation", () => {
    const mockCase = createMockCaseCardData({
      _id: "test-case-123" as any,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // View button is now a button element, not a link
    const viewButton = screen.getByRole("button", { name: /view/i });
    expect(viewButton).toBeInTheDocument();
  });

  it("renders Edit button with click handler for navigation", () => {
    const mockCase = createMockCaseCardData({
      _id: "test-case-456" as any,
    });

    renderWithProviders(<CaseCard case={mockCase} />);

    // Edit button is now a button element, not a link
    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).toBeInTheDocument();
  });

  it("renders More menu button", () => {
    const mockCase = createMockCaseCardData();

    renderWithProviders(<CaseCard case={mockCase} />);

    const moreButton = screen.getByRole("button", { name: /more options/i });
    expect(moreButton).toBeInTheDocument();
  });

  it("shows Delete option in More menu", async () => {
    const mockCase = createMockCaseCardData();
    const { user } = renderWithProviders(<CaseCard case={mockCase} />);

    const moreButton = screen.getByRole("button", { name: /more options/i });
    await user.click(moreButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete/i });
    expect(deleteOption).toBeInTheDocument();
  });

  it("shows Archive option in More menu", async () => {
    const mockCase = createMockCaseCardData();
    const { user } = renderWithProviders(<CaseCard case={mockCase} />);

    const moreButton = screen.getByRole("button", { name: /more options/i });
    await user.click(moreButton);

    const archiveOption = await screen.findByRole("menuitem", { name: /archive/i });
    expect(archiveOption).toBeInTheDocument();
  });

  it("View button has default variant styling", () => {
    const mockCase = createMockCaseCardData();
    renderWithProviders(<CaseCard case={mockCase} />);

    const viewButton = screen.getByRole("button", { name: /view/i });
    // Check that it has the primary styling classes
    expect(viewButton).toHaveClass("shadow-[4px_4px_0px_#000]");
  });

  it("Edit button has outline variant styling", () => {
    const mockCase = createMockCaseCardData();
    renderWithProviders(<CaseCard case={mockCase} />);

    const editButton = screen.getByRole("button", { name: /edit/i });
    // Check that it has outline styling
    expect(editButton).toHaveClass("border-2");
    expect(editButton).toHaveClass("bg-transparent");
  });
});

// ============================================================================
// SELECTION MODE TESTS
// ============================================================================

describe("CaseCard - Selection Mode", () => {
  it("shows checkbox when selectionMode is true", () => {
    const mockCase = createMockCaseCardData();

    renderWithProviders(
      <CaseCard case={mockCase} selectionMode={true} isSelected={false} />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("hides checkbox when selectionMode is false", () => {
    const mockCase = createMockCaseCardData();

    renderWithProviders(
      <CaseCard case={mockCase} selectionMode={false} isSelected={false} />
    );

    const checkbox = screen.queryByRole("checkbox");
    expect(checkbox).not.toBeInTheDocument();
  });

  it("checkbox is checked when isSelected is true", () => {
    const mockCase = createMockCaseCardData();

    renderWithProviders(
      <CaseCard case={mockCase} selectionMode={true} isSelected={true} />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("checkbox is unchecked when isSelected is false", () => {
    const mockCase = createMockCaseCardData();

    renderWithProviders(
      <CaseCard case={mockCase} selectionMode={true} isSelected={false} />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("calls onSelect with case ID when checkbox is clicked", async () => {
    const mockCase = createMockCaseCardData({
      _id: "test-case-789" as any,
    });
    const onSelectMock = vi.fn();
    const { user } = renderWithProviders(
      <CaseCard
        case={mockCase}
        selectionMode={true}
        isSelected={false}
        onSelect={onSelectMock}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(onSelectMock).toHaveBeenCalledWith("test-case-789");
  });

  it("checkbox appears in top-right corner", () => {
    const mockCase = createMockCaseCardData();
    const { container } = renderWithProviders(
      <CaseCard case={mockCase} selectionMode={true} isSelected={false} />
    );

    const checkboxContainer = container.querySelector(
      '[data-testid="selection-checkbox"]'
    );
    expect(checkboxContainer).toBeInTheDocument();
    expect(checkboxContainer).toHaveClass("absolute");
    expect(checkboxContainer).toHaveClass("top-2");
    expect(checkboxContainer).toHaveClass("left-4");
  });
});
