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
    // The one fold left is the citation, which every source block carries.
    expect(screen.getAllByRole("group")).toHaveLength(1);
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

describe("DataProvenance in another language", () => {
  it("speaks the page's language, keeps DOL's source names, and dates in its own form", async () => {
    getFreshness.mockResolvedValue({
      "perm-case-status": row({ dataset: "perm-case-status", source: "flag.dol.gov (DOL, direct)", asOf: "2026-10-28" }),
    });
    const { container } = render(await DataProvenance({ datasets: ["perm-case-status"], lang: "es" }));
    const text = container.textContent ?? "";
    // The label names the line and its coverage note.
    expect(screen.getAllByText("Estados de cada caso:").length).toBeGreaterThanOrEqual(1);
    expect(text).toContain("flag.dol.gov (DOL, direct) · datos hasta el 28 de octubre de 2026 · a diario");
    expect(text).toContain("Todos los casos PERM que el DOL indexa");
    expect(screen.getByRole("link", { name: "Avísenos" })).toHaveAttribute("href", "/contact");
  });

  it("falls back to the English name for a dataset not yet translated, never a blank", async () => {
    getFreshness.mockResolvedValue({ "perm-month-stats": row() });
    render(await DataProvenance({ datasets: ["perm-month-stats"], lang: "zh" }));
    expect(screen.getAllByText("Pending case counts:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "告诉我们" })).toBeInTheDocument();
  });

  it("warns about a stale dataset in the page's language", async () => {
    getFreshness.mockResolvedValue({
      "perm-cases": row({ dataset: "perm-cases", stale: true, ageDays: 41, cadence: "Quarterly" }),
    });
    render(await DataProvenance({ datasets: ["perm-cases"], lang: "pt-br" }));
    expect(screen.getByText("Dados de casos não é atualizado há 41 dias.")).toBeInTheDocument();
    expect(screen.getByText(/Deveria ser atualizado trimestralmente/)).toBeInTheDocument();
  });
});
