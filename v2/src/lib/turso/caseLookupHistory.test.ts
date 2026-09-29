import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A case decided in FY2020 to FY2023 lives in `perm_cases_history`, not in
 * `perm_cases`. The lookup must answer from it, and must not spend a live DOL
 * question on a number whose decision is already on record.
 */

const tables: Record<string, Record<string, Record<string, unknown>>> = {};
const asked: string[] = [];

vi.mock("./client", () => ({
  one: async (sql: string, args: unknown[] = []) => {
    const table = /FROM (\w+)/.exec(sql)?.[1] ?? "";
    asked.push(table);
    return tables[table]?.[String(args[0])] ?? null;
  },
}));

const discoverCase = vi.fn();
vi.mock("./caseDiscovery", () => ({
  discoverCase: (...a: unknown[]) => discoverCase(...a),
  discoverCaseOutcome: async (...a: unknown[]) => {
    const found = await discoverCase(...a);
    return { found, miss: found ? null : "none" };
  },
}));
vi.mock("./sweepCoverage", () => ({ getSweepCoverage: async () => null, laterDate: (a: string | null) => a }));
vi.mock("./liveCensus", () => ({
  getLiveCensus: async () => null,
  aheadPendingFrom: () => null,
  monthRowsFrom: () => [],
  statusTotalFrom: () => null,
}));

import { lookupCase } from "./caseLookup";

const OLD = "A-20001-11111";
const DECIDED = {
  status: "certified", received_date: "2020-01-02", decision_date: "2021-03-01", days: 424,
  employer_name: "ACME INC", job_title: "Engineer", soc_title: "Software Developers",
  state: "WA", wage: 104000,
};

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  asked.length = 0;
  discoverCase.mockReset().mockResolvedValue(null);
});

describe("lookupCase and the FY2020 to FY2023 history", () => {
  it("answers from perm_cases_history when perm_cases has no row", async () => {
    tables.perm_cases_history = { [OLD]: DECIDED };
    const r = await lookupCase(OLD);
    expect(r?.decided).not.toBeNull();
    expect(asked).toContain("perm_cases_history");
    expect(discoverCase).not.toHaveBeenCalled();
  });

  it("prefers perm_cases and never reads history when the current record has it", async () => {
    tables.perm_cases = { [OLD]: { ...DECIDED, status: "denied" } };
    tables.perm_cases_history = { [OLD]: DECIDED };
    await lookupCase(OLD);
    expect(asked).not.toContain("perm_cases_history");
  });

  it("still asks DOL live when neither table holds the case", async () => {
    await lookupCase(OLD);
    expect(discoverCase).toHaveBeenCalledOnce();
  });
});
