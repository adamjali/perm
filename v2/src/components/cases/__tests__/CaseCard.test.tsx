// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CaseCard } from "../CaseCard";
import type { CaseCardData } from "../../../../../convex/lib/caseListTypes";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({ googleCalendarConnected: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/cases",
}));

function createMockCaseCardData(overrides?: Partial<CaseCardData>): CaseCardData {
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
    dates: { created: Date.now(), updated: Date.now() },
    ...overrides,
  } as CaseCardData;
}

describe("CaseCard - Rendering", () => {
  it("renders employer name and beneficiary", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ employerName: "Tech LLC", beneficiaryIdentifier: "Jane Smith" })} />);
    expect(screen.getByText("Tech LLC")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders folder tab with uppercase stage label", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ caseStatus: "recruitment" })} />);
    expect(screen.getByText("RECRUITMENT")).toBeInTheDocument();
  });
});

describe("CaseCard - Badges", () => {
  it.each([
    ["PRO", { isProfessionalOccupation: true }],
    ["RFI", { hasActiveRfi: true }],
    ["RFE", { hasActiveRfe: true }],
  ] as const)("shows %s badge when applicable", (badge, overrides) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData(overrides)} />);
    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it.each([
    ["PRO", { isProfessionalOccupation: false }],
    ["RFI", { hasActiveRfi: false }],
    ["RFE", { hasActiveRfe: false }],
  ] as const)("hides %s badge when not applicable", (badge, overrides) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData(overrides)} />);
    expect(screen.queryByText(badge)).not.toBeInTheDocument();
  });

  it("shows both RFI and RFE badges when both active", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ hasActiveRfi: true, hasActiveRfe: true })} />);
    expect(screen.getByText("RFI")).toBeInTheDocument();
    expect(screen.getByText("RFE")).toBeInTheDocument();
  });
});

describe("CaseCard - Favorite Star", () => {
  it.each([
    [true, "true"],
    [false, "false"],
  ])("shows star with aria-pressed=%s when isFavorite=%s", (isFavorite, pressed) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ isFavorite })} />);
    expect(screen.getByRole("button", { name: /favorite/i })).toHaveAttribute("aria-pressed", pressed);
  });
});

describe("CaseCard - Calendar Sync", () => {
  it("shows Synced indicator when enabled and connected", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ calendarSyncEnabled: true })} />);
    expect(screen.getByLabelText(/syncing to google calendar/i)).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("hides calendar indicator when disabled", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ calendarSyncEnabled: false })} />);
    expect(screen.queryByLabelText(/syncing to google calendar/i)).not.toBeInTheDocument();
  });
});

describe("CaseCard - Next Deadline", () => {
  it("shows formatted deadline when provided", () => {
    const futureDateStr = "2026-02-08";
    const parsedDate = new Date(`${futureDateStr}T12:00:00`);
    renderWithProviders(<CaseCard case={createMockCaseCardData({ nextDeadline: futureDateStr, nextDeadlineLabel: "PWD expires" })} />);
    const expected = parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });

  it("shows urgency indicators based on days remaining", () => {
    const urgentDate = new Date();
    urgentDate.setDate(urgentDate.getDate() + 5);
    renderWithProviders(
      <CaseCard case={createMockCaseCardData({ nextDeadline: urgentDate.toISOString().split("T")[0] })} />
    );
    expect(screen.getByText(/\d+ days\)/i)).toBeInTheDocument();
  });

  it("handles missing deadline gracefully", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ nextDeadline: undefined })} />);
    expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
  });
});

describe("CaseCard - Action Buttons", () => {
  it("renders View, Edit, and More buttons", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData()} />);
    expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more options/i })).toBeInTheDocument();
  });

  it.each(["delete", "archive"])("shows %s option in More menu", async (option) => {
    const { user } = renderWithProviders(<CaseCard case={createMockCaseCardData()} />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    expect(await screen.findByRole("menuitem", { name: new RegExp(option, "i") })).toBeInTheDocument();
  });
});

describe("CaseCard - Selection Mode", () => {
  it("shows checkbox when selectionMode is true, hides when false", () => {
    renderWithProviders(
      <CaseCard case={createMockCaseCardData()} selectionMode={true} isSelected={false} />
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("hides checkbox when selectionMode is false", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData()} selectionMode={false} isSelected={false} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each([
    [true, true],
    [false, false],
  ])("checkbox checked=%s when isSelected=%s", (isSelected, shouldBeChecked) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData()} selectionMode={true} isSelected={isSelected} />);
    shouldBeChecked ? expect(screen.getByRole("checkbox")).toBeChecked() : expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls onSelect with case ID when clicked", async () => {
    const onSelect = vi.fn();
    const { user } = renderWithProviders(
      <CaseCard case={createMockCaseCardData({ _id: "test-789" as any })} selectionMode={true} isSelected={false} onSelect={onSelect} />
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onSelect).toHaveBeenCalledWith("test-789");
  });
});
