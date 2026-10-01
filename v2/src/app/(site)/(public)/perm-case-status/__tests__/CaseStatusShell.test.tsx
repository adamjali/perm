import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CaseStatusHead } from "../CaseStatusShell";

/**
 * The loading state and its fallback stay in the streamed HTML, so three real
 * <h1> tags gave crawlers the page's heading three times (Oct 1 2026). Only
 * the page's own copy is an <h1>; the loading copies look the same and keep a
 * level-1 heading role for screen readers.
 */
describe("CaseStatusHead", () => {
  it("renders the page's one <h1>", () => {
    const { container } = render(<CaseStatusHead typed="" />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("renders no <h1> while loading, still announced as a level-1 heading", () => {
    const { container } = render(<CaseStatusHead typed="G-100-26239-123456" loading />);
    expect(container.querySelectorAll("h1")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1, name: "Check a PERM case" })).toBeInTheDocument();
  });

  it("looks the same either way", () => {
    const page = render(<CaseStatusHead typed="" />).container.querySelector("h1")!.className;
    const loading = render(<CaseStatusHead typed="" loading />).container.querySelector('[role="heading"]')!.className;
    expect(loading).toBe(page);
  });
});
