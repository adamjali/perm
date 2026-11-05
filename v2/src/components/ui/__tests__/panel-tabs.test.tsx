import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PanelTabs } from "../panel-tabs";

const tabs = [
  { id: "behind-employment", label: "Employment", panel: <p>employment rows</p> },
  { id: "behind-family", label: "Family preference", panel: <p>family rows</p> },
  { id: "behind-immediate", label: "Immediate relative", panel: <p>immediate rows</p> },
];

describe("PanelTabs", () => {
  it("puts every panel in the page and shows the first", () => {
    render(<PanelTabs tabs={tabs} label="Category of immigrant visa" />);
    expect(screen.getByText("family rows")).toBeInTheDocument();
    expect(screen.getByText("employment rows").closest("[role=tabpanel]")).not.toHaveAttribute("hidden");
    expect(screen.getByText("family rows").closest("[role=tabpanel]")).toHaveAttribute("hidden");
    expect(screen.getByRole("tab", { name: "Employment" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches on a click and on the arrow keys", () => {
    render(<PanelTabs tabs={tabs} label="Category of immigrant visa" />);
    fireEvent.click(screen.getByRole("tab", { name: "Family preference" }));
    expect(screen.getByText("family rows").closest("[role=tabpanel]")).not.toHaveAttribute("hidden");
    expect(screen.getByText("employment rows").closest("[role=tabpanel]")).toHaveAttribute("hidden");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Immediate relative" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Employment" })).toHaveAttribute("aria-selected", "true");
  });
});
