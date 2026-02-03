// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createManyDeadlinesGroup,
  createOverdueDeadline,
} from "../../../../test-utils/deadline-fixtures";
import type { Id } from "../../../../convex/_generated/dataModel";
import UrgencyGroup from "../UrgencyGroup";

describe("UrgencyGroup", () => {
  const overdueItems = [
    createOverdueDeadline({ caseId: "case_001" as Id<"cases">, caseNumber: "CASE-001" }),
    createOverdueDeadline({ caseId: "case_002" as Id<"cases">, caseNumber: "CASE-002" }),
  ];

  beforeEach(() => vi.clearAllMocks());

  it("renders group title, item count, and all items", () => {
    renderWithProviders(
      <UrgencyGroup title="Overdue" items={overdueItems} urgency="overdue" />
    );

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("Tech Corp Inc")).toHaveLength(2);
  });

  it("shows empty state when no items", () => {
    renderWithProviders(
      <UrgencyGroup title="Overdue" items={[]} urgency="overdue" />
    );
    expect(screen.getByText(/no deadlines/i)).toBeInTheDocument();
  });

  describe("overflow (+N more)", () => {
    const manyItems = createManyDeadlinesGroup(8, "overdue");

    it("shows only maxItems initially with +N more button", () => {
      renderWithProviders(
        <UrgencyGroup title="Overdue" items={manyItems} urgency="overdue" maxItems={5} />
      );

      expect(screen.getAllByText("Tech Corp Inc")).toHaveLength(5);
      expect(screen.getByText("+3 more")).toBeInTheDocument();
    });

    it("expands all items and shows Show less on click", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <UrgencyGroup title="Overdue" items={manyItems} urgency="overdue" maxItems={5} />
      );

      await user.click(screen.getByText("+3 more"));
      expect(screen.getAllByText("Tech Corp Inc")).toHaveLength(8);
      expect(screen.getByText("Show less")).toBeInTheDocument();
    });

    it("does not show +N more when items <= maxItems", () => {
      renderWithProviders(
        <UrgencyGroup title="Overdue" items={createManyDeadlinesGroup(3, "overdue")} urgency="overdue" maxItems={5} />
      );
      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });
  });
});
