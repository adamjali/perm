import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const getFreshness = vi.fn();
vi.mock("@/lib/turso/publicData", () => ({ getFreshness: () => getFreshness() }));

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
    const fold = screen.getByText("What this data includes").closest("details");
    expect(fold).not.toBeNull();
    expect(fold).not.toHaveAttribute("open");
    // In the DOM while shut, so search engines and screen readers still get it.
    expect(fold).toHaveTextContent(/Decided PERM cases only/);
  });

  it("names the fold for several sources when there are several", async () => {
    await renderProvenance({
      "perm-cases": row({ dataset: "perm-cases" }),
      "perm-case-status": row({ dataset: "perm-case-status" }),
    });
    expect(screen.getByText("What each source includes")).toBeInTheDocument();
  });

  it("draws no fold when no dataset has a coverage sentence", async () => {
    await renderProvenance({ "not-a-dataset": row({ dataset: "not-a-dataset" }) });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
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
