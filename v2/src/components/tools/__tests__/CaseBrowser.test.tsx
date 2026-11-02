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

describe("CaseBrowser links what has a page", () => {
  const decided = {
    caseNumber: "G-100-25001-123456",
    status: "certified",
    receivedDate: "2025-01-02",
    decisionDate: "2026-01-05",
    days: 368,
    employerName: "Google LLC",
    employerSlug: "google-llc",
    state: "CA",
    jobTitle: "Software Engineer",
    socCode: "15-1252.00",
    socTitle: "Software Developers",
    socSlug: "software-developers",
    attorneyName: "",
    attorneySlug: "",
    wage: 180000,
  };
  const live = {
    caseNumber: "G-100-26200-654321",
    filingDate: "2026-07-19",
    status: "ANALYST REVIEW",
    isFinal: false,
    employerName: "Google LLC",
    employerSlug: "google-llc",
    jobTitle: "Data Scientist",
  };

  // One answer object per test, as the real hook returns: a new object on every render would set the table's
  // state on every render and never settle.
  const answer = (data: unknown) => {
    const found = { data, failed: false };
    const empty = { data: EMPTY_PAGE, failed: false };
    const skip = { data: undefined, failed: false };
    usePublicQuery.mockImplementation((url: string) => (url === "skip" ? skip : url.includes("action=search") ? found : empty));
  };

  beforeEach(() => {
    search = "field=employer&q=google";
    answer({ cases: [decided], live: [live] });
  });

  it("opens a decided case's own page from its number, as the live list does", () => {
    render(<CaseBrowser meta={null} occupations={[]} />);
    expect(screen.getByRole("link", { name: decided.caseNumber }).getAttribute("href")).toBe(
      `/perm-case-status?case=${decided.caseNumber}`,
    );
  });

  it("opens the occupation's page from the job, and the employer's from a live filing", () => {
    render(<CaseBrowser meta={null} occupations={[]} />);
    expect(screen.getByRole("link", { name: "Software Developers" }).getAttribute("href")).toBe("/perm-wages/software-developers");
    const employers = screen.getAllByRole("link", { name: "Google LLC" }).map((a) => a.getAttribute("href"));
    expect(employers.length).toBeGreaterThanOrEqual(2);
    expect(new Set(employers)).toEqual(new Set(["/perm-employers/google-llc"]));
  });

  it("leaves the job as text when it has no occupation page", () => {
    answer({ cases: [{ ...decided, socSlug: null }], live: [] });
    render(<CaseBrowser meta={null} occupations={[]} />);
    expect(screen.queryByRole("link", { name: "Software Developers" })).toBeNull();
    expect(screen.getByText("Software Developers")).toBeTruthy();
  });
});
