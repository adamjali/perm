import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { summarizeReports, type ReportRecord } from "@/lib/consularReport";

import { ConsularReports } from "../ConsularReports";
import { ReportedPosts } from "../ReportedPosts";

/**
 * The figures above the form, built from the real summary (summarizeReports), so the floor under test is the one
 * the query applies. What must hold: under three reports no outcome, kind of visa, week or median prints, only
 * "too few reports yet"; at three they print, every figure labelled self-reported; a median after the interview
 * never prints without the count still waiting; the index panel names only consulates State lists.
 */

const TODAY = new Date().toISOString().slice(0, 10);
const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

function rec(over: Partial<ReportRecord> = {}): ReportRecord {
  return { post: "mumbai", category: "h1b", outcome: "issued", interviewOn: daysAgo(3), createdAt: NOW, updatedAt: NOW, ...over } as ReportRecord;
}

beforeEach(() => {
  // The form inside posts nowhere in these tests.
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
});

describe("ConsularReports: the three-report floor", () => {
  it("prints only \"too few reports yet\" under three reports", () => {
    const view = summarizeReports([rec(), rec({ outcome: "221g" })], TODAY);
    render(<ConsularReports name="Mumbai" post="mumbai" view={view} all={view} />);
    const section = screen.getByRole("region", { name: /what people report/i });
    const text = section.textContent ?? "";
    expect(text).toMatch(/Too few reports yet: 2 reports so far/);
    // No outcome breakdown, no share and no week count escape.
    expect(text).not.toMatch(/Visa issued/);
    expect(within(section).getAllByText("Not yet").length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/no week in the last 12 has 3 interviews reported/);
    // No kind of visa is listed until three people report one, and the plate says so.
    expect(text).toMatch(/Too few reports yet for any kind of visa/);
    expect(text).not.toMatch(/H-1B/);
  });

  it("prints the figures from three reports, each labelled self-reported", () => {
    const view = summarizeReports([rec(), rec({ outcome: "221g" }), rec({ outcome: "issued" })], TODAY);
    render(<ConsularReports name="Mumbai" post="mumbai" view={view} all={view} />);
    const section = screen.getByRole("region", { name: /what people report/i });
    const text = section.textContent ?? "";
    expect(text).toMatch(/1 of 3 interviews with a result/);
    expect(text).toMatch(/Visa issued/);
    expect(text).toMatch(/H-1B/);
    // The one kind past the floor is listed; the rest are one line, never a row each.
    expect(text).toMatch(/Too few reports yet for every other kind of visa/);
    expect(text).not.toMatch(/Employment green card/);
    expect((text.match(/Self-reported by visitors, not State's data/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("never prints a median after the interview without the count still waiting", () => {
    const finished = (d: number) => rec({ outcome: "approved", approvedOn: daysAgo(3 - d), interviewOn: daysAgo(3) });
    const view = summarizeReports([finished(0), finished(1), finished(2), rec({ outcome: "waiting" })], TODAY);
    render(<ConsularReports name="Mumbai" post="mumbai" view={view} all={view} />);
    const plate = screen.getByText("From the interview to the visa").closest("figure")!;
    expect(plate.textContent).toMatch(/1 day/);
    expect(plate.textContent).toMatch(/3 finished, 1 still waiting/);
  });

  it("says the reports can't be read when the query failed", () => {
    render(<ConsularReports name="Mumbai" post="mumbai" view={null} all={null} />);
    expect(screen.getByText(/can't be read right now/)).toBeInTheDocument();
  });
});

describe("ReportedPosts: the index panel", () => {
  it("names only consulates State lists, with the 221(g) share only from three results", () => {
    render(
      <ReportedPosts
        busiest={[
          { post: "mumbai", reports30: 5, results: 4, g221: 1 },
          { post: "made-up-post", reports30: 4, results: 3, g221: 3 },
          { post: "manila", reports30: 3, results: null, g221: null },
        ]}
        posts={[
          { slug: "mumbai", name: "Mumbai" },
          { slug: "manila", name: "Manila" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Mumbai" })).toHaveAttribute("href", "/consular-posts/mumbai#reports");
    expect(screen.getByText(/25% of 4 results ended in 221\(g\)/)).toBeInTheDocument();
    expect(screen.getByText(/Too few results yet/)).toBeInTheDocument();
    expect(screen.queryByText(/made-up-post/)).toBeNull();
    expect(screen.getByText(/Self-reported by visitors, not State's data/)).toBeInTheDocument();
  });

  it("says so when no consulate has three reports yet", () => {
    render(<ReportedPosts busiest={[]} posts={[{ slug: "mumbai", name: "Mumbai" }]} />);
    expect(screen.getByText(/No consulate has/)).toBeInTheDocument();
  });
});
