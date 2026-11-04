import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CaseListFilters, CaseListSort } from "@convex/lib/caseListTypes";
import { CaseFilterBar } from "../CaseFilterBar";

function Bar({ onPageSizeChange = vi.fn() }: { onPageSizeChange?: (n: number) => void }) {
  const [filters, setFilters] = useState<CaseListFilters>({ activeOnly: true });
  const [sort, setSort] = useState<CaseListSort>({ sortBy: "deadline", sortOrder: "desc" });
  const [pageSize, setPageSize] = useState(12);
  return (
    <CaseFilterBar
      filters={filters}
      sort={sort}
      onFiltersChange={setFilters}
      onSortChange={setSort}
      pageSize={pageSize}
      onPageSizeChange={(n) => {
        setPageSize(n);
        onPageSizeChange(n);
      }}
    />
  );
}

describe("CaseFilterBar's Filters panel", () => {
  it("stays open while a stage and a progress are picked, counting them as it goes, and closes on Done", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Bar />);
    // Act
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = within(screen.getByRole("dialog", { name: "Filters" }));
    await user.click(panel.getByRole("radio", { name: "Recruitment" }));
    // Assert
    expect(panel.getByRole("radio", { name: "Recruitment" })).toBeChecked();
    expect(panel.getByRole("status")).toHaveTextContent("1 on");
    // Act
    await user.click(panel.getByRole("radio", { name: "Filed" }));
    await user.click(panel.getByRole("checkbox", { name: "Duplicates only" }));
    // Assert
    expect(panel.getByRole("status")).toHaveTextContent("3 on");
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    // Act
    await user.click(panel.getByRole("button", { name: "Done" }));
    // Assert
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters, 3 on" })).toBeInTheDocument();
  });

  it("names its groups for a screen reader", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Bar />);
    // Act
    await user.click(screen.getByRole("button", { name: "Filters" }));
    // Assert
    expect(screen.getByRole("group", { name: "Stage" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Any stage" })).toBeChecked();
  });
});

describe("CaseFilterBar's Sort panel", () => {
  it("takes the order and the page size without closing, the size in one tap", async () => {
    // Arrange
    const onPageSizeChange = vi.fn();
    const user = userEvent.setup();
    render(<Bar onPageSizeChange={onPageSizeChange} />);
    // Act
    await user.click(screen.getByRole("button", { name: "Sort by: Next deadline" }));
    const panel = within(screen.getByRole("dialog", { name: "Sort" }));
    await user.click(panel.getByRole("radio", { name: "Employer name" }));
    await user.click(panel.getByRole("button", { name: "24 per page" }));
    // Assert
    expect(onPageSizeChange).toHaveBeenCalledWith(24);
    expect(panel.getByRole("button", { name: "24 per page" })).toHaveAttribute("aria-pressed", "true");
    expect(panel.getByRole("radio", { name: "Employer name" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Sort by: Employer name" })).toBeInTheDocument();
  });
});
