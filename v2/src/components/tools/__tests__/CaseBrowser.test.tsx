// @vitest-environment jsdom
/**
 * The /perm-cases search forms answer every press of a button.
 *
 * Oct 4 2026: an iPhone pressed Search twenty times with a name and two months
 * on screen, the form's own submit handler ran each time, and no request went
 * out, because the component's copy of the name was empty. The same day a
 * reader reported that the month boxes carried a pattern written with doubled
 * backslashes, which no month can match, so any browser that draws them as
 * text boxes refused to submit at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const usePublicQuery = vi.fn();
vi.mock("@/hooks/usePublicQuery", () => ({ usePublicQuery }));
let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/perm-cases",
}));
vi.mock("@/lib/analytics", () => ({ analytics: { capture: vi.fn() } }));

const { CaseBrowser } = await import("../CaseBrowser");

const EMPTY_PAGE = { page: [], isDone: true, continueCursor: "" };

function searchUrls(): string[] {
  return usePublicQuery.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("action=search"));
}

beforeEach(() => {
  search = "";
  usePublicQuery.mockReset();
  usePublicQuery.mockImplementation((url: string) =>
    url === "skip" ? { data: undefined, failed: false } : { data: url.includes("action=search") ? { cases: [], live: [] } : EMPTY_PAGE, failed: false },
  );
});

describe("CaseBrowser search by name", () => {
  it("says why when the name is too short, instead of doing nothing", () => {
    render(<CaseBrowser meta={null} occupations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("status")).toHaveTextContent("Type at least two letters of the employer's name.");
    expect(searchUrls()).toEqual([]);
  });

  it("searches for the name the box holds even when React never heard it typed", () => {
    render(<CaseBrowser meta={null} occupations={[]} />);
    const box = screen.getByPlaceholderText("Start of a name") as HTMLInputElement;
    // What an autofill does: the value changes with no event React acts on.
    // Setting it through the node keeps React's value tracker in step, which
    // is exactly why a later input event would not reach onChange.
    box.value = "google";
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(searchUrls().some((u) => u.includes("text=google"))).toBe(true);
  });

  it("carries no input pattern on the month boxes, which no month could match", () => {
    const { container } = render(<CaseBrowser meta={null} occupations={[]} />);
    const months = container.querySelectorAll('input[type="month"]');
    expect(months.length).toBe(2);
    for (const m of months) expect(m.hasAttribute("pattern")).toBe(false);
  });

  it("runs the search a plain form submit put in the URL, as before the script loaded", () => {
    search = "field=employer&q=google&from=2025-10&to=2026-10";
    render(<CaseBrowser meta={null} occupations={[]} />);
    expect(searchUrls().some((u) => u.includes("text=google") && u.includes("from=2025-10") && u.includes("to=2026-10"))).toBe(true);
  });
});

describe("CaseBrowser case lookup", () => {
  it("says what to type when the box is empty", () => {
    render(<CaseBrowser meta={null} occupations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Look it up" }));
    expect(screen.getByRole("status")).toHaveTextContent("Type a case number first");
    expect(usePublicQuery.mock.calls.map((c) => String(c[0])).some((u) => u.includes("action=lookup"))).toBe(false);
  });
});
