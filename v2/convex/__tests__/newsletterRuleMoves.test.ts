import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The digest's read of the rule pipeline: rows from the public-data database
 * become worded steps with where each is on record. Mocked at the mirror, so
 * the SQL's columns and the mapping are what's tested.
 */

const rows = vi.fn();
vi.mock("../lib/publicMirror", () => ({ rows, one: vi.fn() }));

const { readRuleMoves } = await import("../newsletter");

const AC29 = {
  rin: "1205-AC29",
  title: "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program (NPRM)",
  agency: "DOL's Employment and Training Administration",
  comments_close: null,
  effective_on: null,
  pi_url: null,
  proposed_url: null,
  final_url: null,
};

// Braces: a hook that returns the mock gets it called as the hook's cleanup.
beforeEach(() => {
  rows.mockReset();
});

describe("readRuleMoves", () => {
  it("words each step in the window and links OIRA's record for a review", async () => {
    rows.mockResolvedValue([
      { ...AC29, kind: "oira-completed", on_date: "2026-10-23", detail: "Consistent with Change" },
      { ...AC29, kind: "not-a-step", on_date: "2026-10-22", detail: null },
    ]);
    const moves = await readRuleMoves("2026-10-20", "2026-10-27");
    expect(rows.mock.calls[0]?.[1]).toEqual(["2026-10-20", "2026-10-27"]);
    expect(moves).toEqual([
      {
        rin: "1205-AC29",
        // The step, so the subject can lead with a rule published in the Register.
        kind: "oira-completed",
        date: "2026-10-23",
        sentence:
          'OIRA finished its review of "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program" on Oct 23, 2026. Its decision: "Consistent with Change".',
        url: "https://www.reginfo.gov/public/do/eAgendaViewRule?RIN=1205-AC29",
      },
    ]);
  });

  it("links the Register's copy for a published step", async () => {
    rows.mockResolvedValue([
      { ...AC29, kind: "proposed-published", on_date: "2026-10-29", detail: "2026-99901", comments_close: "2026-12-28", proposed_url: "https://www.federalregister.gov/d/2026-99901" },
    ]);
    const [m] = await readRuleMoves("2026-10-27", "2026-11-03");
    expect(m?.url).toBe("https://www.federalregister.gov/d/2026-99901");
    expect(m?.sentence).toMatch(/comments close Dec 28, 2026\.$/);
  });

  it("is no moves before the rule watch has made its tables, and fails on anything else", async () => {
    rows.mockImplementation(async () => {
      throw new Error("libsql error: no such table: rule_pipeline_events");
    });
    expect(await readRuleMoves("2026-10-20", "2026-10-27")).toEqual([]);
    rows.mockImplementation(async () => {
      throw new Error("libsql HTTP 502 Bad Gateway");
    });
    await expect(readRuleMoves("2026-10-20", "2026-10-27")).rejects.toThrow("502");
  });
});
