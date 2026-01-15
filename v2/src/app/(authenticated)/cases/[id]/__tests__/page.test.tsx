// @vitest-environment jsdom
/**
 * Case Detail Page Tests
 *
 * Tests for the case detail page component with sections,
 * quick actions, and timeline visualization.
 *
 * Requirements:
 * 1. Renders loading state initially (skeleton)
 * 2. Renders case details when data loads
 * 3. Shows all section headers (Basic Info, PWD, Recruitment, ETA 9089, I-140, RFI/RFE)
 * 4. Quick actions dropdown opens on click
 * 5. Edit navigates to edit page
 * 6. Delete shows confirmation dialog
 * 7. Delete calls mutation on confirm
 * 8. Archive sets status to closed
 * 9. Reopen changes status appropriately
 * 10. Back button navigates to /cases
 * 11. Shows not found state when case is null
 * 12. Timeline toggle button works
 */

import * as React from "react";
import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { renderWithProviders } from "../../../../../../test-utils/render-utils";

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock router
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/cases/test-case-id",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "test-case-id" }),
}));

// Mock Convex hooks
const mockCaseData = vi.fn();
const mockTimelinePrefs = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();
const mockReopenCase = vi.fn();
const mockToggleFavorite = vi.fn();
const mockToggleCalendarSync = vi.fn();
const mockAddToTimeline = vi.fn();
const mockRemoveFromTimeline = vi.fn();

// Counter to track query and mutation calls order
let queryCallIndex = 0;
let mutationCallIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: () => {
    // First call is case data, second call is timeline preferences
    // Both are called on each render, so we need to track parity
    const idx = queryCallIndex++;
    if (idx % 2 === 0) {
      // Case data query
      const result = mockCaseData();
      return result;
    }
    // Timeline preferences query - always return valid value
    const result = mockTimelinePrefs();
    // Ensure we always return a valid value, not undefined
    return result ?? { selectedCaseIds: null };
  },
  useMutation: () => {
    // Return mutations in order they are called in component:
    // 1. removeMutation (api.cases.remove)
    // 2. updateMutation (api.cases.update)
    // 3. reopenCaseMutation (api.cases.reopenCase)
    // 4. toggleFavoriteMutation (api.cases.toggleFavorite)
    // 5. toggleCalendarSyncMutation (api.cases.toggleCalendarSync)
    // 6. addToTimelineMutation
    // 7. removeFromTimelineMutation
    const idx = mutationCallIndex++;
    switch (idx % 7) {
      case 0: return mockRemove;
      case 1: return mockUpdate;
      case 2: return mockReopenCase;
      case 3: return mockToggleFavorite;
      case 4: return mockToggleCalendarSync;
      case 5: return mockAddToTimeline;
      case 6: return mockRemoveFromTimeline;
      default: return vi.fn();
    }
  },
}));

// Mock the detail section components to simplify testing
vi.mock("@/components/cases/detail/InlineCaseTimeline", () => ({
  InlineCaseTimeline: ({ caseData }: any) => (
    <div data-testid="inline-timeline">Timeline for {caseData?.employerName}</div>
  ),
}));

vi.mock("@/components/cases/detail/BasicInfoSection", () => ({
  BasicInfoSection: ({ data }: any) => (
    <div data-testid="basic-info-section">Basic Info: {data?.employerName}</div>
  ),
}));

vi.mock("@/components/cases/detail/PWDSection", () => ({
  PWDSection: ({ data }: any) => <div data-testid="pwd-section">PWD Section</div>,
}));

vi.mock("@/components/cases/detail/RecruitmentSection", () => ({
  RecruitmentSection: ({ data }: any) => (
    <div data-testid="recruitment-section">Recruitment Section</div>
  ),
}));

vi.mock("@/components/cases/detail/ETA9089Section", () => ({
  ETA9089Section: ({ data }: any) => (
    <div data-testid="eta9089-section">ETA 9089 Section</div>
  ),
}));

vi.mock("@/components/cases/detail/I140Section", () => ({
  I140Section: ({ data }: any) => <div data-testid="i140-section">I-140 Section</div>,
}));

vi.mock("@/components/cases/detail/RFIRFESection", () => ({
  RFIRFESection: ({ rfiEntries, rfeEntries }: any) => (
    <div data-testid="rfirfe-section">RFI/RFE Section</div>
  ),
}));

// Mock status badges
vi.mock("@/components/status/case-stage-badge", () => ({
  CaseStageBadge: ({ stage }: any) => (
    <span data-testid="case-stage-badge">{stage}</span>
  ),
}));

vi.mock("@/components/status/progress-status-badge", () => ({
  ProgressStatusBadge: ({ status }: any) => (
    <span data-testid="progress-status-badge">{status}</span>
  ),
}));

// ============================================================================
// IMPORT AFTER MOCKS
// ============================================================================

import CaseDetailPage from "../page";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Factory for creating mock case data.
 */
function createMockCaseData(overrides?: Partial<any>): any {
  return {
    _id: "test-case-id",
    employerName: "Acme Corp",
    positionTitle: "Software Engineer",
    beneficiaryIdentifier: "John Doe",
    caseStatus: "pwd",
    progressStatus: "working",
    isProfessionalOccupation: false,
    calendarSyncEnabled: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rfiEntries: [],
    rfeEntries: [],
    ...overrides,
  };
}

/**
 * Helper to render with Suspense boundary and wait for content.
 */
async function renderPageAndWait(caseId: string) {
  const params = Promise.resolve({ id: caseId });

  let rendered: ReturnType<typeof renderWithProviders>;

  await act(async () => {
    rendered = renderWithProviders(
      <Suspense fallback={<div data-testid="suspense-fallback">Loading...</div>}>
        <CaseDetailPage params={params} />
      </Suspense>
    );
  });

  // Wait for the suspense to resolve
  await waitFor(() => {
    expect(screen.queryByTestId("suspense-fallback")).not.toBeInTheDocument();
  }, { timeout: 3000 });

  return rendered!;
}

// ============================================================================
// LOADING STATE TESTS
// ============================================================================

describe("CaseDetailPage - Loading State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("renders skeleton when data is loading (useQuery returns undefined)", async () => {
    // useQuery returns undefined while loading
    mockCaseData.mockReturnValue(undefined);

    const params = Promise.resolve({ id: "test-id" });

    await act(async () => {
      renderWithProviders(
        <Suspense fallback={<div>Loading...</div>}>
          <CaseDetailPage params={params} />
        </Suspense>
      );
    });

    // Wait for suspense to resolve, then check for skeleton
    await waitFor(() => {
      // The skeleton component should be shown when useQuery returns undefined
      const skeletons = document.querySelectorAll('[class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

// ============================================================================
// NOT FOUND STATE TESTS
// ============================================================================

describe("CaseDetailPage - Not Found State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("shows not found state when case is null", async () => {
    mockCaseData.mockReturnValue(null);

    await renderPageAndWait("nonexistent-id");

    expect(screen.getByText("Case Not Found")).toBeInTheDocument();
  });

  it("shows descriptive message in not found state", async () => {
    mockCaseData.mockReturnValue(null);

    await renderPageAndWait("nonexistent-id");

    expect(
      screen.getByText(/doesn't exist or has been deleted/i)
    ).toBeInTheDocument();
  });

  it("shows back to cases button in not found state", async () => {
    mockCaseData.mockReturnValue(null);

    await renderPageAndWait("nonexistent-id");

    const backButton = screen.getByRole("button", { name: /back to cases/i });
    expect(backButton).toBeInTheDocument();
  });

  it("back button navigates to /cases from not found state", async () => {
    mockCaseData.mockReturnValue(null);

    const { user } = await renderPageAndWait("nonexistent-id");

    const backButton = screen.getByRole("button", { name: /back to cases/i });
    await user.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/cases");
  });
});

// ============================================================================
// CASE DETAILS RENDERING TESTS
// ============================================================================

describe("CaseDetailPage - Case Details Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("renders case employer name in header", async () => {
    const mockCase = createMockCaseData({ employerName: "Tech Innovations" });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByText("Tech Innovations")).toBeInTheDocument();
  });

  it("renders position title below employer name", async () => {
    const mockCase = createMockCaseData({ positionTitle: "Senior Developer" });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
  });

  it("shows case status badge", async () => {
    const mockCase = createMockCaseData({ caseStatus: "recruitment" });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByTestId("case-stage-badge")).toHaveTextContent("recruitment");
  });

  it("shows progress status badge", async () => {
    const mockCase = createMockCaseData({ progressStatus: "filed" });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByTestId("progress-status-badge")).toHaveTextContent("filed");
  });

  it("shows Professional badge when isProfessionalOccupation is true", async () => {
    const mockCase = createMockCaseData({ isProfessionalOccupation: true });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByText("Professional")).toBeInTheDocument();
  });

  it("renders inline timeline component", async () => {
    const mockCase = createMockCaseData({ employerName: "Timeline Test Corp" });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByTestId("inline-timeline")).toBeInTheDocument();
  });

  it("renders all detail sections", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    await renderPageAndWait("test-id");

    expect(screen.getByTestId("basic-info-section")).toBeInTheDocument();
    expect(screen.getByTestId("pwd-section")).toBeInTheDocument();
    expect(screen.getByTestId("recruitment-section")).toBeInTheDocument();
    expect(screen.getByTestId("eta9089-section")).toBeInTheDocument();
    expect(screen.getByTestId("i140-section")).toBeInTheDocument();
    expect(screen.getByTestId("rfirfe-section")).toBeInTheDocument();
  });
});

// ============================================================================
// SECTION HEADER TESTS
// ============================================================================

describe("CaseDetailPage - Section Headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("shows Case Timeline section header", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    await renderPageAndWait("test-id");

    expect(screen.getByText("Case Timeline")).toBeInTheDocument();
  });

  it("renders created date in footer", async () => {
    const mockCase = createMockCaseData({
      createdAt: new Date("2024-01-15").getTime(),
    });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByText(/created:/i)).toBeInTheDocument();
  });

  it("renders last updated date in footer", async () => {
    const mockCase = createMockCaseData({
      updatedAt: new Date("2024-03-20").getTime(),
    });
    mockCaseData.mockReturnValue(mockCase);

    await renderPageAndWait("test-id");

    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });
});

// ============================================================================
// QUICK ACTIONS DROPDOWN TESTS
// ============================================================================

describe("CaseDetailPage - Quick Actions Dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("shows actions button", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    expect(actionsButton).toBeInTheDocument();
  });

  it("opens dropdown menu on click", { timeout: 30000 }, async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    // Dropdown should be open with menu items
    expect(await screen.findByRole("menuitem", { name: /edit case/i })).toBeInTheDocument();
  });

  it("shows Edit Case option in dropdown", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    expect(await screen.findByRole("menuitem", { name: /edit case/i })).toBeInTheDocument();
  });

  it("shows Delete Case option in dropdown", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    expect(await screen.findByRole("menuitem", { name: /delete case/i })).toBeInTheDocument();
  });

  it("shows Archive Case option when case is not closed", async () => {
    mockCaseData.mockReturnValue(createMockCaseData({ caseStatus: "pwd" }));

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    expect(await screen.findByRole("menuitem", { name: /archive case/i })).toBeInTheDocument();
  });

  it("shows Reopen Case option when case is closed", async () => {
    mockCaseData.mockReturnValue(createMockCaseData({ caseStatus: "closed" }));

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    expect(await screen.findByRole("menuitem", { name: /reopen case/i })).toBeInTheDocument();
  });

  it("shows timeline toggle option in dropdown", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    // Should have either "Add to Timeline" or "Remove from Timeline"
    const timelineOption = await screen.findByRole("menuitem", { name: /timeline/i });
    expect(timelineOption).toBeInTheDocument();
  });
});

// ============================================================================
// NAVIGATION TESTS
// ============================================================================

describe("CaseDetailPage - Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("back button navigates to /cases", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const backButton = screen.getByRole("button", { name: /back to cases/i });
    await user.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/cases");
  });

  it("Edit Case navigates to edit page", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const editOption = await screen.findByRole("menuitem", { name: /edit case/i });
    await user.click(editOption);

    // The caseId comes from params, not from the case data
    expect(mockPush).toHaveBeenCalledWith("/cases/test-id/edit");
  });
});

// ============================================================================
// DELETE CONFIRMATION TESTS
// ============================================================================

describe("CaseDetailPage - Delete Confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset().mockResolvedValue(undefined);
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("shows delete confirmation dialog when Delete is clicked", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    // Dialog should appear
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
  });

  it("shows case name in delete confirmation", async () => {
    mockCaseData.mockReturnValue(
      createMockCaseData({
        employerName: "Delete Test Corp",
        positionTitle: "Test Position",
      })
    );

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    expect(
      await screen.findByText(/Delete Test Corp - Test Position/i)
    ).toBeInTheDocument();
  });

  it("has Cancel button in delete dialog", { timeout: 30000 }, async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    expect(await screen.findByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("closes dialog when Cancel is clicked", { timeout: 30000 }, async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    const cancelButton = await screen.findByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("calls remove mutation on confirm delete", { timeout: 15000 }, async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    // Wait for dialog to appear
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Find the confirm button within the dialog (destructive variant button)
    const dialogButtons = within(dialog).getAllByRole("button");
    const confirmButton = dialogButtons.find((btn) =>
      btn.textContent?.toLowerCase().includes("delete case")
    );
    expect(confirmButton).toBeTruthy();

    // Use fireEvent for more reliable click in dialogs
    await act(async () => {
      fireEvent.click(confirmButton!);
    });

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  it("navigates to /cases after successful delete", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    const confirmButtons = await screen.findAllByRole("button", { name: /delete case/i });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/cases");
    });
  });
});

// ============================================================================
// ARCHIVE/REOPEN TESTS
// ============================================================================

describe("CaseDetailPage - Archive and Reopen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockReopenCase.mockReset().mockResolvedValue({ success: true, newCaseStatus: "pwd", newProgressStatus: "working" });
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("calls update mutation with closed status on Archive", async () => {
    mockCaseData.mockReturnValue(createMockCaseData({ caseStatus: "pwd" }));

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const archiveOption = await screen.findByRole("menuitem", { name: /archive case/i });
    await user.click(archiveOption);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ caseStatus: "closed" })
      );
    });
  });

  it("calls reopenCase mutation on Reopen", async () => {
    mockCaseData.mockReturnValue(
      createMockCaseData({
        caseStatus: "closed",
        pwdDeterminationDate: "2024-01-15",
      })
    );

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const reopenOption = await screen.findByRole("menuitem", { name: /reopen case/i });
    await user.click(reopenOption);

    await waitFor(() => {
      expect(mockReopenCase).toHaveBeenCalled();
    });
  });

  it("reopens case without recruitment (status determined by backend)", async () => {
    mockCaseData.mockReturnValue(
      createMockCaseData({
        caseStatus: "closed",
        pwdDeterminationDate: "2024-01-15",
      })
    );

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const reopenOption = await screen.findByRole("menuitem", { name: /reopen case/i });
    await user.click(reopenOption);

    await waitFor(() => {
      expect(mockReopenCase).toHaveBeenCalled();
    });
  });

  it("reopens case with recruitment (status determined by backend)", { timeout: 30000 }, async () => {
    mockReopenCase.mockReset().mockResolvedValue({ success: true, newCaseStatus: "recruitment", newProgressStatus: "working" });
    mockCaseData.mockReturnValue(
      createMockCaseData({
        caseStatus: "closed",
        sundayAdFirstDate: "2024-02-01",
      })
    );

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const reopenOption = await screen.findByRole("menuitem", { name: /reopen case/i });
    await user.click(reopenOption);

    await waitFor(() => {
      expect(mockReopenCase).toHaveBeenCalled();
    });
  });

  it("reopens case with ETA 9089 filing (status determined by backend)", async () => {
    mockReopenCase.mockReset().mockResolvedValue({ success: true, newCaseStatus: "eta9089", newProgressStatus: "filed" });
    mockCaseData.mockReturnValue(
      createMockCaseData({
        caseStatus: "closed",
        eta9089FilingDate: "2024-03-01",
      })
    );

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const reopenOption = await screen.findByRole("menuitem", { name: /reopen case/i });
    await user.click(reopenOption);

    await waitFor(() => {
      expect(mockReopenCase).toHaveBeenCalled();
    });
  });

  it("reopens case with I-140 filing (status determined by backend)", async () => {
    mockReopenCase.mockReset().mockResolvedValue({ success: true, newCaseStatus: "i140", newProgressStatus: "filed" });
    mockCaseData.mockReturnValue(
      createMockCaseData({
        caseStatus: "closed",
        i140FilingDate: "2024-04-01",
      })
    );

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const reopenOption = await screen.findByRole("menuitem", { name: /reopen case/i });
    await user.click(reopenOption);

    await waitFor(() => {
      expect(mockReopenCase).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// TIMELINE TOGGLE TESTS
// ============================================================================

describe("CaseDetailPage - Timeline Toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
    mockAddToTimeline.mockReset().mockResolvedValue(undefined);
    mockRemoveFromTimeline.mockReset().mockResolvedValue(undefined);
  });

  it("shows timeline toggle button in Case Timeline section", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    await renderPageAndWait("test-id");

    // Look for the timeline toggle button (not in dropdown)
    const buttons = screen.getAllByRole("button");
    const timelineButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Remove from Timeline") ||
        btn.textContent?.includes("Add to Timeline")
    );
    expect(timelineButton).toBeInTheDocument();
  });
});

// ============================================================================
// DEADLINE DISPLAY TESTS
// ============================================================================

describe("CaseDetailPage - Deadline Display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("shows PWD expiration deadline", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const pwdExpiration = futureDate.toISOString().split("T")[0];

    mockCaseData.mockReturnValue(
      createMockCaseData({
        pwdExpirationDate: pwdExpiration,
      })
    );

    await renderPageAndWait("test-id");

    // Multiple sections may show PWD expiration, check that at least one exists
    const pwdElements = screen.getAllByText(/PWD Expires/i);
    expect(pwdElements.length).toBeGreaterThan(0);
  });

  it("shows urgent styling for deadline within 7 days", async () => {
    const urgentDate = new Date();
    urgentDate.setDate(urgentDate.getDate() + 5);
    const pwdExpiration = urgentDate.toISOString().split("T")[0];

    mockCaseData.mockReturnValue(
      createMockCaseData({
        pwdExpirationDate: pwdExpiration,
      })
    );

    const { container } = await renderPageAndWait("test-id");

    // Urgent deadline should have red/semibold styling
    const urgentText = container.querySelector(".text-red-600.font-semibold");
    expect(urgentText).toBeInTheDocument();
  });

  it("shows warning styling for deadline 8-30 days away", async () => {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 20);
    const pwdExpiration = warningDate.toISOString().split("T")[0];

    mockCaseData.mockReturnValue(
      createMockCaseData({
        pwdExpirationDate: pwdExpiration,
      })
    );

    const { container } = await renderPageAndWait("test-id");

    // Warning deadline should have orange styling
    const warningText = container.querySelector(".text-orange-600.font-medium");
    expect(warningText).toBeInTheDocument();
  });

  it("shows active RFI deadline when present", async () => {
    const rfiDueDate = new Date();
    rfiDueDate.setDate(rfiDueDate.getDate() + 10);

    mockCaseData.mockReturnValue(
      createMockCaseData({
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: new Date().toISOString().split("T")[0],
            responseDueDate: rfiDueDate.toISOString().split("T")[0],
          },
        ],
      })
    );

    await renderPageAndWait("test-id");

    // Multiple sections may show RFI deadline, check that at least one exists
    const rfiElements = screen.getAllByText(/RFI Response Due/i);
    expect(rfiElements.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe("CaseDetailPage - Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("back button has accessible name", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    await renderPageAndWait("test-id");

    const backButton = screen.getByRole("button", { name: /back to cases/i });
    expect(backButton).toBeInTheDocument();
  });

  it("actions button has accessible name", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    expect(actionsButton).toBeInTheDocument();
  });

  it("delete confirmation dialog has accessible structure", async () => {
    mockCaseData.mockReturnValue(createMockCaseData());

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    // Dialog should have heading
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /delete case/i })).toBeInTheDocument();
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("CaseDetailPage - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    mutationCallIndex = 0;
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockToggleFavorite.mockReset();
    mockToggleCalendarSync.mockReset();
    mockAddToTimeline.mockReset();
    mockRemoveFromTimeline.mockReset();
    mockTimelinePrefs.mockReturnValue({ selectedCaseIds: null });
  });

  it("handles delete mutation error gracefully", async () => {
    mockRemove.mockRejectedValue(new Error("Delete failed"));
    mockCaseData.mockReturnValue(createMockCaseData());

    // Suppress console error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const deleteOption = await screen.findByRole("menuitem", { name: /delete case/i });
    await user.click(deleteOption);

    // Wait for dialog and find confirm button
    const dialog = await screen.findByRole("dialog");
    const dialogButtons = within(dialog).getAllByRole("button");
    const confirmButton = dialogButtons.find((btn) =>
      btn.textContent?.toLowerCase().includes("delete case")
    );

    await act(async () => {
      fireEvent.click(confirmButton!);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to delete case:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("handles update mutation error gracefully", async () => {
    mockUpdate.mockRejectedValue(new Error("Update failed"));
    mockCaseData.mockReturnValue(createMockCaseData({ caseStatus: "pwd" }));

    // Suppress console error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { user } = await renderPageAndWait("test-id");

    const actionsButton = screen.getByRole("button", { name: /actions/i });
    await user.click(actionsButton);

    const archiveOption = await screen.findByRole("menuitem", { name: /archive case/i });
    await user.click(archiveOption);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to archive case:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
