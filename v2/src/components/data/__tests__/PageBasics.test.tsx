import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageBasics } from "../PageBasics";

describe("PageBasics", () => {
  it("heads the block FAQs", () => {
    render(<PageBasics page="lca-cases" />);
    expect(screen.getByRole("heading", { level: 2, name: "FAQs" })).toBeTruthy();
  });

  it("takes another heading from a page with its own questions above", () => {
    render(<PageBasics page="uscis-processing-times" title="More questions" />);
    expect(screen.getByRole("heading", { level: 2, name: "More questions" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "FAQs" })).toBeNull();
  });

  it("answers how the LCA list is built in the owner's words", () => {
    const { container } = render(<PageBasics page="lca-cases" />);
    expect(screen.getByRole("heading", { level: 3, name: "How does this work?" })).toBeTruthy();
    expect(container.textContent).toContain(
      "DOL numbers every filing from one running counter. This site walks it two or three times a day for new filings, then re-checks each LCA until DOL decides.",
    );
  });

  it.each([
    ["pwd-cases", "re-checks each request until DOL decides."],
    ["lca-cases", "re-checks each LCA until DOL decides."],
    ["seasonal-cases", "re-checks each application until DOL decides."],
  ])("%s says how it works and why a case can be missing", (page, phrase) => {
    const { container } = render(<PageBasics page={page} />);
    expect(container.textContent).toContain(phrase);
    expect(screen.getByRole("heading", { level: 3, name: "Why might one case be missing?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "case lookup" }).getAttribute("href")).toBe("/perm-case-status");
  });
});
