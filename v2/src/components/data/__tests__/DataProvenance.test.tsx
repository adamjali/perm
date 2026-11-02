import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const getFreshness = vi.fn();
vi.mock("@/lib/db/publicData", () => ({ getFreshness: () => getFreshness() }));

const { DataProvenance } = await import("../DataProvenance");

/**
 * The whole point of the stale state is that it fires when an ingest has
 * silently died and NOT otherwise. Both halves are pinned here: a warning
 * that never appears is useless, and one that appears on every page teaches
 * people to ignore the real one.
 */

function row(over: Record<string, unknown> = {}) {
  return {
    dataset: "perm-month-stats",
    asOf: "2026-08-20",
    fetchedAt: 0,
    source: "example.test (mirror)",
    cadence: "Daily",
    note: null,
    maxAgeDays: 7,
    ageDays: 2,
    stale: false,
    ...over,
  };
}

/** Server components are async; render the resolved element. */
async function renderProvenance(rows: Record<string, unknown>) {
  getFreshness.mockResolvedValue(rows);
  render(await DataProvenance({ datasets: Object.keys(rows) }));
}

beforeEach(() => {
  getFreshness.mockReset();
});

describe("DataProvenance", () => {
  it("renders the ordinary line when the data is current", async () => {
    await renderProvenance({ "perm-month-stats": row() });
    expect(screen.getByText("Pending case counts:")).toBeInTheDocument();
    expect(screen.getByText(/example\.test \(mirror\)/)).toBeInTheDocument();
    expect(screen.queryByText(/has not refreshed/)).not.toBeInTheDocument();
  });

  it("dates a news feed by when we checked it, with its newest item beside it", async () => {
    // BALCA's newest decision was Aug 24 while its reader ran on Nov 2: "through Aug 24" read as a feed nobody
    // had looked at since (date audit, Nov 2 2026).
    const checked = Date.UTC(2026, 10, 2, 15, 0);
    await renderProvenance({
      "policy-notices-balca": row({ dataset: "policy-notices-balca", asOf: "2026-08-24", fetchedAt: checked }),
      "policy-notices-oflc": row({ dataset: "policy-notices-oflc", asOf: "2026-11-02", fetchedAt: checked }),
    });
    const line = document.querySelector("[data-provenance] p")?.textContent ?? "";
    expect(line).toContain("checked Nov 2, 2026, newest Aug 24, 2026");
    // A feed whose newest item is the day it was checked says the day once.
    expect(line).toMatch(/OFLC[^·]*checked Nov 2, 2026(?!, newest)/);
    expect(line).not.toContain("through Aug 24");
  });

  it("says how the figures are counted and how to report a mistake", async () => {
    await renderProvenance({ "perm-month-stats": row() });
    expect(screen.getByRole("link", { name: "How these figures are counted" })).toHaveAttribute("href", "/methodology");
    expect(screen.getByRole("link", { name: "Tell us" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "corrections log" })).toHaveAttribute("href", "/changelog/corrections");
  });

  it("says plainly that a stale dataset has stopped, and how old it is", async () => {
    await renderProvenance({
      "perm-month-stats": row({ stale: true, ageDays: 41, maxAgeDays: 7 }),
    });
    expect(
      screen.getByText(/Pending case counts has not refreshed in 41 days\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/should update daily/)).toBeInTheDocument();
  });

  it("keeps the figures and the source when stale rather than hiding them", async () => {
    await renderProvenance({
      "perm-month-stats": row({ stale: true, ageDays: 41 }),
    });
    // The last true measurement stays; only the implication of currency goes.
    expect(screen.getByText(/example\.test \(mirror\)/)).toBeInTheDocument();
    expect(screen.getByText(/data through Aug 20, 2026/)).toBeInTheDocument();
  });

  it("never invents a stale state when the age is unknown", async () => {
    await renderProvenance({
      "perm-month-stats": row({ ageDays: null, maxAgeDays: null, stale: false }),
    });
    expect(screen.queryByText(/has not refreshed/)).not.toBeInTheDocument();
  });

  it("degrades to a plain sentence when stale but the age is unreadable", async () => {
    await renderProvenance({
      "perm-month-stats": row({ stale: true, ageDays: null }),
    });
    // Never "has not refreshed in null days".
    expect(screen.getByText(/has not refreshed\./)).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it("says a day, not 1 days", async () => {
    await renderProvenance({
      "perm-month-stats": row({ stale: true, ageDays: 1 }),
    });
    expect(screen.getByText(/has not refreshed in a day\./)).toBeInTheDocument();
  });

  it("keeps what a dataset includes in the page, folded under the source lines", async () => {
    await renderProvenance({
      "perm-cases": row({ dataset: "perm-cases", cadence: "Quarterly", source: "flag.dol.gov" }),
    });
    const fold = screen.getByText("The sources in full").closest("details");
    expect(fold).not.toBeNull();
    expect(fold).not.toHaveAttribute("open");
    // In the DOM while shut, so search engines and screen readers still get it.
    expect(fold).toHaveTextContent(/Decided PERM cases only/);
    expect(fold).toHaveTextContent("What this data includes");
    // The visible line names the dataset and its date; the source's full name waits in the fold.
    expect(fold).toHaveTextContent(/flag\.dol\.gov/);
  });

  it("names the fold for several sources when there are several", async () => {
    await renderProvenance({
      "perm-cases": row({ dataset: "perm-cases" }),
      "perm-case-status": row({ dataset: "perm-case-status" }),
    });
    expect(screen.getByText("What each source includes")).toBeInTheDocument();
  });

  it("says nothing about coverage when no dataset has a coverage sentence", async () => {
    await renderProvenance({ "not-a-dataset": row({ dataset: "not-a-dataset" }) });
    // Two folds: the sources in full, and the citation every source block carries.
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByText("Cite this page")).toBeInTheDocument();
    expect(screen.queryByText(/includes$/)).not.toBeInTheDocument();
  });

  it("warns only about the stale dataset when others are fine", async () => {
    await renderProvenance({
      "perm-month-stats": row({ stale: true, ageDays: 41 }),
      "perm-cases": row({
        dataset: "perm-cases",
        cadence: "Quarterly",
        source: "flag.dol.gov",
      }),
    });
    expect(screen.getAllByText(/has not refreshed/)).toHaveLength(1);
    // Named once in its source line and once in the coverage fold.
    expect(screen.getAllByText("Case data:")).toHaveLength(2);
  });
});
