import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RECRUITMENT_MIN_DAYS, type PlanFigures } from "@/lib/perm";

import { GreenCardPlanner } from "../GreenCardPlanner";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/tools/green-card-timeline",
  useSearchParams: () => nav.params,
}));

const FIGURES: PlanFigures = {
  pwdWaitDays: 97,
  recruitmentDays: RECRUITMENT_MIN_DAYS,
  permWaitDays: 290,
  i140Months: 3.9,
  i485Months: 6,
  pace: {
    "EB2|worldwide": { latest: { kind: "date", iso: "2025-04-01" }, movedDays: 180, spanMonths: 12, retrogressions: [] },
    "EB2|india": { latest: { kind: "unavailable" }, movedDays: null, spanMonths: null, retrogressions: [] },
  },
  bulletinMonth: "2026-11",
};

const renderPlanner = () =>
  render(<GreenCardPlanner figures={FIGURES} standing={{ perm: "Now: DOL is deciding PERM cases filed around Jan 9, 2026" }} check={null} today="2026-10-28" />);
const tile = (label: string) => screen.getByText(label).closest("li")!;

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockClear();
});

describe("GreenCardPlanner", () => {
  it("plans from today with no address, every step on the chart", () => {
    // Act
    renderPlanner();
    // Assert
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(6);
    expect(within(tile("Priority date")).getByText(/2027/)).toBeInTheDocument();
    expect(within(tile("Green card")).getByText(/^[A-Z][a-z]+ 20\d\d$/)).toBeInTheDocument();
    expect(screen.getByText("Now: DOL is deciding PERM cases filed around Jan 9, 2026")).toBeInTheDocument();
  });

  it("reads the case from the address, so a shared link opens the same plan", () => {
    // Arrange
    nav.params = new URLSearchParams("where=i140-approved&date=2025-12-15");
    // Act
    renderPlanner();
    // Assert: the plan starts at the bulletin, with the given priority date.
    expect(within(tile("Priority date")).getByText("Dec 15, 2025")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Wage request/ })).not.toBeInTheDocument();
  });

  it("writes a changed input back to the address without scrolling", () => {
    // Arrange
    renderPlanner();
    // Act
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "india" } });
    // Assert
    expect(nav.replace).toHaveBeenCalledWith("/tools/green-card-timeline?country=india", { scroll: false });
  });

  it("says why there's no green card date when the line is unavailable", () => {
    // Arrange
    nav.params = new URLSearchParams("country=india");
    // Act
    renderPlanner();
    // Assert
    expect(within(tile("Green card")).getByText("No date yet")).toBeInTheDocument();
    expect(screen.getByText(/unavailable in the November 2026 bulletin/)).toBeInTheDocument();
  });

  it("takes the reader's own assumption and puts today's figures back on reset", () => {
    // Arrange
    renderPlanner();
    const before = within(tile("PERM decided")).getByText(/2028/).textContent;
    // Act
    fireEvent.change(screen.getByLabelText("PERM, days"), { target: { value: "500" } });
    const changed = within(tile("PERM decided")).getByText(/20\d\d/).textContent;
    fireEvent.click(screen.getByRole("button", { name: /Back to today's figures/ }));
    // Assert
    expect(changed).not.toBe(before);
    expect(within(tile("PERM decided")).getByText(/2028/).textContent).toBe(before);
  });

  it("adds premium processing to the address and the fees", () => {
    // Arrange
    renderPlanner();
    // Act
    fireEvent.click(screen.getByLabelText("Premium processing on the I-140"));
    // Assert
    expect(nav.replace).toHaveBeenCalledWith("/tools/green-card-timeline?premium=1", { scroll: false });
  });
});

describe("GreenCardPlanner, starting from a certified PERM", () => {
  it("shows the steps behind the reader as done, with the certification day", () => {
    // Arrange
    nav.params = new URLSearchParams("where=perm-certified&date=2026-09-01&pd=2025-10-20");
    // Act
    renderPlanner();
    // Assert
    expect(within(tile("PERM decided")).getByText("Sep 1, 2026")).toBeInTheDocument();
    expect(within(tile("PERM decided")).getByText("Before this plan starts")).toBeInTheDocument();
    expect(within(tile("Priority date")).getByText("Oct 20, 2025")).toBeInTheDocument();
  });
});

describe("GreenCardPlanner, the priority date tile", () => {
  it("calls a priority date already passed filed, never done", () => {
    // Arrange
    nav.params = new URLSearchParams("where=perm-filed&date=2026-01-15");
    // Act
    renderPlanner();
    // Assert
    expect(within(tile("Priority date")).getByText("Filed")).toBeInTheDocument();
  });

  it("labels a decades-long wait every few years, never every year on top of each other", () => {
    // Arrange: a line that moved 30 days in a year against a cutoff a decade back.
    nav.params = new URLSearchParams("where=perm-filed&date=2026-03-16&country=china");
    const slow: PlanFigures = {
      ...FIGURES,
      pace: { ...FIGURES.pace, "EB2|china": { latest: { kind: "date", iso: "2021-10-01" }, movedDays: 30, spanMonths: 12, retrogressions: [] } },
    };
    // Act
    const { container } = render(<GreenCardPlanner figures={slow} standing={{}} check={null} today="2026-10-28" />);
    // Assert
    const labels = [...container.querySelectorAll('section[aria-label="Every step, dated"] > div span.absolute')].map((e) => e.textContent);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.length).toBeLessThanOrEqual(7);
    expect(tile("Green card")).toHaveTextContent(/In about \d+(½)? years/);
  });
});

