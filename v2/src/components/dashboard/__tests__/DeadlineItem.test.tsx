// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { createMockDeadlineItem, createOverdueDeadline } from "../../../../test-utils/deadline-fixtures";
import DeadlineItem, { countdownWords } from "../DeadlineItem";
import { formatDeadlineDate } from "@/components/cases/case-card.utils";

describe("DeadlineItem", () => {
  it("names the employer, what's due and the role, and links to the case", () => {
    const d = createMockDeadlineItem({ positionTitle: "Data Engineer" });
    renderWithProviders(<DeadlineItem deadline={d} />);
    expect(screen.getByText(d.employerName)).toBeInTheDocument();
    expect(screen.getByText(`${d.label} · Data Engineer`)).toBeInTheDocument();
    expect(screen.getByText(countdownWords(d.daysUntil))).toBeInTheDocument();
    expect(screen.getByText(formatDeadlineDate(d.dueDate))).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/cases/${d.caseId}`);
  });

  it("says how late an overdue deadline is, in red", () => {
    renderWithProviders(<DeadlineItem deadline={createOverdueDeadline({ daysUntil: -5 })} />);
    const late = screen.getByText("5 days late");
    expect(late.className).toMatch(/text-destructive/);
  });
});

describe("countdownWords", () => {
  it("reads today, one day and several days, ahead and behind", () => {
    expect(countdownWords(0)).toBe("Today");
    expect(countdownWords(1)).toBe("In 1 day");
    expect(countdownWords(7)).toBe("In 7 days");
    expect(countdownWords(-1)).toBe("1 day late");
    expect(countdownWords(-3)).toBe("3 days late");
  });
});
