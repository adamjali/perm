// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CaseCard } from "../CaseCard";
import type { CaseCardData } from "@convex/lib/caseListTypes";

// One spy for every mutation, so a test can prove none ran.
const mutationSpy = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: () => mutationSpy,
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

  it("names the stage on its chip", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ caseStatus: "recruitment" })} />);
    expect(screen.getByText("Recruitment")).toBeInTheDocument();
  });

  it("writes I-140 with its hyphen, not the internal id", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ caseStatus: "i140" })} />);
    expect(screen.getAllByText("I-140").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^I140$/i)).not.toBeInTheDocument();
  });
});

describe("CaseCard - Badges", () => {
  it.each([
    ["RFI open", { hasActiveRfi: true }],
    ["RFE open", { hasActiveRfe: true }],
  ] as const)("shows %s badge when applicable", (badge, overrides) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData(overrides)} />);
    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it.each([
    ["RFI open", { hasActiveRfi: false }],
    ["RFE open", { hasActiveRfe: false }],
  ] as const)("hides %s badge when not applicable", (badge, overrides) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData(overrides)} />);
    expect(screen.queryByText(badge)).not.toBeInTheDocument();
  });

  // A folder carries only what needs acting on: whether the job is a
  // professional occupation is on the case itself, not its folder.
  it("never shows a Professional chip", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ isProfessionalOccupation: true })} />);
    expect(screen.queryByText("Professional")).not.toBeInTheDocument();
  });

  it("shows both RFI and RFE badges when both active", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ hasActiveRfi: true, hasActiveRfe: true })} />);
    expect(screen.getByText("RFI open")).toBeInTheDocument();
    expect(screen.getByText("RFE open")).toBeInTheDocument();
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
  // Calendar sync is a setting, read on the case and in Settings; the folder
  // stays clear of it.
  it("puts no calendar mark on the folder, synced or not", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ calendarSyncEnabled: true })} />);
    expect(screen.queryByLabelText(/google calendar/i)).not.toBeInTheDocument();
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

  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  it.each([
    [5, "5", "days left", "bg-data-bad"],
    [20, "20", "days left", "bg-data-warn"],
    [90, "90", "days left", "bg-primary"],
    [0, "Due", "today", "bg-data-bad"],
    [-3, "3", "days late", "bg-data-bad"],
  ])("in %i days: shows %s %s on the urgency colour", (n, value, unit, fill) => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ nextDeadline: inDays(n), nextDeadlineLabel: "PWD expires" })} />);
    const figure = screen.getByText(value);
    expect(figure.parentElement).toHaveClass(fill);
    expect(figure.parentElement).toHaveTextContent(unit);
    expect(screen.getByText("PWD expires")).toBeInTheDocument();
  });

  it("handles missing deadline gracefully", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ nextDeadline: undefined })} />);
    expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
  });
});

describe("CaseCard - Action Buttons", () => {
  it("opens the case from the employer's name, and keeps the other actions in the menu", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData()} />);
    expect(screen.getByRole("link", { name: "Acme Corp" })).toHaveAttribute("href", "/cases/test-case-id");
    expect(screen.getByRole("button", { name: /more options/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^view$/i })).not.toBeInTheDocument();
  });

  it.each(["edit", "delete", "archive"])("shows %s option in More menu", async (option) => {
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

// The dates sit in a native fold: it keeps them in the page for search and
// screen readers whether open or shut, and a pinned case starts open.
describe("CaseCard - Dates fold", () => {
  const withDates = { created: 1, updated: 2, pwdFiled: "2025-01-10", pwdExpires: "2025-06-30" } as CaseCardData["dates"];
  const fold = () => screen.getByText(/^Dates \(/).closest("details")!;

  it("counts only the dates the card lists", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ dates: withDates })} />);
    expect(screen.getByText("Dates (2)")).toBeInTheDocument();
    expect(fold()).not.toHaveAttribute("open");
  });

  it("starts open on a pinned case", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ dates: withDates, isPinned: true })} />);
    expect(fold()).toHaveAttribute("open");
  });

  it("names notes when the case has them", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ dates: withDates, notes: "Waiting on the employer" })} />);
    expect(screen.getByText("Dates (2) and notes")).toBeInTheDocument();
  });

  it("shows no fold when nothing is recorded", () => {
    renderWithProviders(<CaseCard case={createMockCaseCardData({ dates: { created: 1, updated: 2 } as CaseCardData["dates"] })} />);
    expect(screen.queryByText(/^Dates \(|^Notes$/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("expanded-content")).not.toBeInTheDocument();
  });
});
