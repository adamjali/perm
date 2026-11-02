import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DidYouMean } from "../DidYouMean";

/** Close names arrive after "Nothing matched": while they're looked up, a line says so (owner, Nov 2 2026). */
describe("DidYouMean", () => {
  it("says it's looking while the close names load", () => {
    render(<DidYouMean suggestions={[]} loading />);
    expect(screen.getByText("Looking for close names…")).toBeInTheDocument();
  });

  it("shows nothing once the lookup found no close name", () => {
    const { container } = render(<DidYouMean suggestions={[]} />);
    expect(container.textContent).toBe("");
  });

  it("shows the names, not the loading line, once they're in", () => {
    render(<DidYouMean suggestions={[{ label: "Amazon.com Services LLC", href: "/perm-employers/amazon" }]} loading />);
    expect(screen.getByRole("link", { name: "Amazon.com Services LLC" })).toBeInTheDocument();
    expect(screen.queryByText("Looking for close names…")).toBeNull();
  });
});
