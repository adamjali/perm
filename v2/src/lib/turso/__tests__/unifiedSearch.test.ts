import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lead } from "@/lib/caseSearchPlan";

const readPermPublished = vi.fn();
const readPermLive = vi.fn();
const readFlagLive = vi.fn();
const readFlagPublished = vi.fn();
const lookupUnifiedCase = vi.fn();

vi.mock("../caseSearchReads", () => ({
  readPermPublished,
  readPermLive,
  readFlagLive,
  readFlagPublished,
  lookupUnifiedCase,
}));

const { dedupeToOnePerCase, skippedSources, unifiedSearch } = await import("../unifiedSearch");
type UnifiedCase = Parameters<typeof dedupeToOnePerCase>[0][number];

const employerLead: Lead = { kind: "employer", value: "acme" };
const stateLead: Lead = { kind: "state", value: "WA" };
const occupationLead: Lead = { kind: "occupation", value: "15-1252.00" };
const firmLead: Lead = { kind: "firm", value: "firm-llp" };

/** A published PERM row, as `readPermPublished` returns it. */
const permPub = (caseNumber: string, over: Record<string, unknown> = {}) => ({
  caseNumber,
  status: "certified",
  receivedDate: "2025-01-10",
  decisionDate: "2025-11-02",
  days: 296,
  employerName: "ACME CORP",
  employerSlug: "acme-corp",
  state: "WA",
  jobTitle: "Engineer",
  socCode: "15-1252.00",
  socTitle: "Software Developers",
  attorneyName: "Firm LLP",
  attorneySlug: "firm-llp",
  wage: 180000,
  ...over,
});

/** A live PERM row. A DIFFERENT SHAPE, which is why there are two adapters. */
const permLive = (caseNumber: string, over: Record<string, unknown> = {}) => ({
  caseNumber,
  filingDate: "2026-08-01",
  status: "ANALYST REVIEW",
  isFinal: false,
  employerName: "ACME CORP",
  jobTitle: "Engineer",
  ...over,
});

const flagLive = (caseNumber: string, over: Record<string, unknown> = {}) => ({
  caseNumber,
  status: "IN PROCESS",
  isFinal: false,
  filingDate: "2026-08-20",
  employerName: "ACME CORP",
  employerSlug: "acme-corp",
  jobTitle: "Analyst",
  lastCheckedAt: "2026-09-01T04:10:00Z",
  ...over,
});

const flagFile = (caseNumber: string, over: Record<string, unknown> = {}) => ({
  caseNumber,
  status: "DETERMINATION ISSUED",
  receivedDate: "2025-02-01",
  decisionDate: "2025-06-01",
  employerName: "ACME CORP",
  employerSlug: "acme-corp",
  jobTitle: "Analyst",
  socCode: "13-1111.00",
  socTitle: "Management Analysts",
  wage: 140000,
  wageUnit: "Year",
  worksiteState: "TX",
  ...over,
});

/**
 * Each read returns `{ rows, windowed }`, not a bare array. `windowed` says the
 * filters ran inside a window of this employer's newest filings rather than
 * over everything they have filed, which is the one thing about a narrowed
 * answer the reader cannot infer from the rows.
 */
const slice = (rows: unknown[], windowed = false) => ({ rows, windowed });

beforeEach(() => {
  vi.resetAllMocks();
  readPermPublished.mockResolvedValue(slice([]));
  readPermLive.mockResolvedValue(slice([]));
  readFlagLive.mockResolvedValue(slice([]));
  readFlagPublished.mockResolvedValue(slice([]));
  lookupUnifiedCase.mockResolvedValue({
    program: "perm",
    permPublished: null,
    permLive: null,
    flagPublished: null,
    flagLive: null,
  });
});

describe("dedupeToOnePerCase", () => {
  const cell = (half: "live" | "published", over: Partial<UnifiedCase> = {}): UnifiedCase => ({
    caseNumber: "P-100-26232-000009",
    program: "pwd",
    half,
    status: half === "live" ? "IN PROCESS" : "DETERMINATION ISSUED",
    isFinal: half === "published",
    filedOn: "2025-02-01",
    decidedOn: half === "published" ? "2025-06-01" : null,
    employerName: "ACME CORP",
    employerSlug: "acme-corp",
    jobTitle: "Analyst",
    wage: half === "published" ? 140000 : null,
    wageUnit: half === "published" ? "Year" : null,
    state: half === "published" ? "TX" : null,
    firmName: null,
    firmSlug: null,
    socCode: null,
    socTitle: null,
    days: null,
    ...over,
  });

  // BOTH ORDERS, because that is the whole rule. Driving `unifiedSearch`
  // instead cannot choose which half arrives first, so it passes on the array
  // order the spread happens to use: a version that simply keeps whichever it
  // saw first left that test green.
  it("keeps the published row when the live one came first", () => {
    const out = dedupeToOnePerCase([cell("live"), cell("published")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ half: "published", wage: 140000 });
  });

  it("keeps the published row when the published one came first", () => {
    const out = dedupeToOnePerCase([cell("published"), cell("live")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ half: "published", wage: 140000 });
  });

  it("leaves different case numbers alone, across programs", () => {
    const out = dedupeToOnePerCase([
      cell("live", { caseNumber: "P-100-26232-000001" }),
      cell("live", { caseNumber: "I-200-26232-000001", program: "lca" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("skippedSources", () => {
  // A source that silently contributes nothing is indistinguishable from a
  // source with nothing to contribute, so this is asserted directly rather
  // than inferred from a result set.
  it("drops the live half whenever a filter names a field only publication carries", () => {
    for (const narrow of [
      { firmSlug: "firm-llp" },
      { state: "WA" },
      { socCode: "15-1252.00" },
      { fiscalYear: "2025" },
      { wageMin: 100000 },
      { wageMax: 100000 },
    ]) {
      expect(skippedSources(narrow, employerLead).live).toBe(true);
    }
  });

  it("names the filters responsible so the page can print them", () => {
    const s = skippedSources({ state: "WA", wageMin: 100000 }, employerLead);
    expect(s.because).toEqual(["worksite state", "wage"]);
  });

  it("keeps both halves for a plain employer search", () => {
    expect(skippedSources({}, employerLead)).toEqual({
      live: false,
      published: false,
      because: [],
    });
  });

  it('drops the published half only for "still open"', () => {
    expect(skippedSources({ outcome: "open" }, employerLead).published).toBe(true);
    expect(skippedSources({ outcome: "granted" }, employerLead).published).toBe(false);
  });

  it("drops the live half for an equality lead, without blaming a filter", () => {
    const s = skippedSources({}, stateLead);
    expect(s.live).toBe(true);
    expect(s.because).toEqual([]);
  });
});

describe("unifiedSearch", () => {
  it("labels each row with the program and half it came from", async () => {
    readPermPublished.mockResolvedValue(slice([permPub("G-100-25010-000001")]));
    readFlagLive.mockImplementation(async (program: string) =>
      slice(program === "pwd" ? [flagLive("P-100-26232-000002")] : []),
    );
    readFlagPublished.mockImplementation(async (program: string) =>
      slice(program === "lca" ? [flagFile("I-200-25032-000003")] : []),
    );

    const { rows } = await unifiedSearch({ lead: employerLead });
    const byNumber = Object.fromEntries(rows.map((r) => [r.caseNumber, r]));

    expect(byNumber["G-100-25010-000001"]).toMatchObject({ program: "perm", half: "published" });
    expect(byNumber["P-100-26232-000002"]).toMatchObject({ program: "pwd", half: "live" });
    expect(byNumber["I-200-25032-000003"]).toMatchObject({ program: "lca", half: "published" });
  });

  it("carries the published-only fields through, and leaves them null on a live row", async () => {
    readPermPublished.mockResolvedValue(slice([permPub("G-100-25010-000001")]));
    readPermLive.mockResolvedValue(slice([permLive("G-100-26213-000002")]));

    const { rows } = await unifiedSearch({ lead: employerLead });
    const pub = rows.find((r) => r.caseNumber === "G-100-25010-000001");
    const live = rows.find((r) => r.caseNumber === "G-100-26213-000002");

    expect(pub).toMatchObject({
      filedOn: "2025-01-10",
      decidedOn: "2025-11-02",
      wage: 180000,
      state: "WA",
      firmName: "Firm LLP",
      firmSlug: "firm-llp",
      socTitle: "Software Developers",
      days: 296,
      isFinal: true,
    });
    // Not "unknown yet" as a blank string: null is what the column holds and
    // what the table renders as a dash.
    expect(live).toMatchObject({
      wage: null,
      state: null,
      firmName: null,
      socCode: null,
      days: null,
      isFinal: false,
    });
  });

  it("orders newest filing first, with the case number breaking ties", async () => {
    readPermPublished.mockResolvedValue(
      slice([
        permPub("G-100-25010-000001", { receivedDate: "2025-01-01" }),
        permPub("G-100-25010-000003", { receivedDate: "2025-03-01" }),
        permPub("G-100-25010-000002", { receivedDate: "2025-03-01" }),
      ]),
    );
    const { rows } = await unifiedSearch({ lead: employerLead });
    expect(rows.map((r) => r.caseNumber)).toEqual([
      "G-100-25010-000003",
      "G-100-25010-000002",
      "G-100-25010-000001",
    ]);
  });

  it("only reads the programs asked for", async () => {
    await unifiedSearch({ lead: employerLead, programs: ["pwd"] });
    expect(readPermPublished).not.toHaveBeenCalled();
    expect(readPermLive).not.toHaveBeenCalled();
    expect(readFlagLive).toHaveBeenCalledTimes(1);
    expect(readFlagLive.mock.calls[0]?.[0]).toBe("pwd");
  });

  it.each([
    ["state", stateLead],
    ["occupation", occupationLead],
  ] as const)("reaches all three published programs under a %s lead", async (_kind, lead) => {
    // THE DEFECT THIS PINS. `pwd_cases` and `lca_cases` have always held a
    // worksite state and a SOC code; what they lacked was an index, so these
    // two leads read the PERM file alone and the answer said nothing about it.
    // Somebody asking for every case in Texas got a third of the corpus and no
    // way to tell.
    await unifiedSearch({ lead });
    expect(readPermPublished).toHaveBeenCalledTimes(1);
    expect(readFlagPublished).toHaveBeenCalledTimes(2);
    expect(readFlagPublished.mock.calls.map((c) => c[0]).sort()).toEqual(["lca", "pwd"]);
    // The LEAD is handed down, not an employer string: the read layer picks
    // its own index from it.
    expect(readFlagPublished.mock.calls[0]?.[1]).toEqual(lead);
    // No live half either way - a live row has no worksite or occupation on it
    // at all, which is DOL's endpoint rather than a missing index.
    expect(readPermLive).not.toHaveBeenCalled();
    expect(readFlagLive).not.toHaveBeenCalled();
  });

  it("honours the program chips under a state lead, because the page leaves them on", async () => {
    // `filterAvailability` turns these chips ON for a state lead. A control the
    // page leaves enabled must be one the route serves, or the greying is a
    // lie in the other direction.
    await unifiedSearch({ lead: stateLead, programs: ["pwd"] });
    expect(readPermPublished).not.toHaveBeenCalled();
    expect(readFlagPublished).toHaveBeenCalledTimes(1);
    expect(readFlagPublished.mock.calls[0]?.[0]).toBe("pwd");
  });

  it("honours the program chips under a firm lead, now that the firm is ingested", async () => {
    // THIS ASSERTED THE OPPOSITE, and the reason was true when it was written:
    // DOL publishes the firm for all three programs and this site had ingested
    // it for one, so honouring ["pwd"] would have returned an empty answer that
    // reads as "this firm files no wage requests". The ingest reads the column
    // now and the backfill filled it - 91.5% of wage-request rows, 74.6% of LCA
    // rows - so the chips choose between three real sources.
    await unifiedSearch({ lead: firmLead, programs: ["pwd"] });
    expect(readPermPublished).not.toHaveBeenCalled();
    expect(readFlagPublished).toHaveBeenCalledTimes(1);
    expect(readFlagPublished.mock.calls[0]?.[0]).toBe("pwd");
  });

  it("asks all three programs for a firm when no chip narrows it", async () => {
    await unifiedSearch({ lead: firmLead });
    expect(readPermPublished).toHaveBeenCalledTimes(1);
    expect(readFlagPublished).toHaveBeenCalledTimes(2);
  });

  it("stops asking the live tables once a published-only filter is set", async () => {
    await unifiedSearch({ lead: employerLead, narrow: { wageMin: 120000 } });
    expect(readPermLive).not.toHaveBeenCalled();
    expect(readFlagLive).not.toHaveBeenCalled();
    expect(readPermPublished).toHaveBeenCalledTimes(1);
    expect(readFlagPublished).toHaveBeenCalledTimes(2);
  });

  it('stops asking the published tables for "still open"', async () => {
    await unifiedSearch({ lead: employerLead, narrow: { outcome: "open" } });
    expect(readPermPublished).not.toHaveBeenCalled();
    expect(readFlagPublished).not.toHaveBeenCalled();
    expect(readPermLive).toHaveBeenCalledTimes(1);
    expect(readFlagLive).toHaveBeenCalledTimes(2);
  });

  it("counts the RETURNED rows, not everything it collected", async () => {
    readPermPublished.mockResolvedValue(
      slice(
        Array.from({ length: 5 }, (_, i) =>
          permPub(`G-100-25010-00000${i}`, { receivedDate: `2025-01-0${i + 1}` }),
        ),
      ),
    );
    const { rows, counts, truncated } = await unifiedSearch({ lead: employerLead, limit: 2 });
    expect(rows).toHaveLength(2);
    expect(counts.perm).toBe(2);
    expect(truncated).toBe(true);
  });

  it("survives one program's table being unavailable, and still returns the others", async () => {
    readFlagLive.mockRejectedValue(new Error("turso query deadline"));
    readPermPublished.mockResolvedValue(slice([permPub("G-100-25010-000001")]));

    const { rows } = await unifiedSearch({ lead: employerLead });
    expect(rows.map((r) => r.caseNumber)).toEqual(["G-100-25010-000001"]);
  });

  it("reports `capped` when a source returned a full page", async () => {
    readFlagLive.mockResolvedValue(
      slice(
        Array.from({ length: 100 }, (_, i) => flagLive(`I-200-26232-${String(i).padStart(6, "0")}`)),
      ),
    );
    const { capped } = await unifiedSearch({ lead: employerLead });
    expect(capped).toBe(true);
  });

  it("reports `windowed` when any source filtered inside its slice window", async () => {
    // Different claim from `capped`, and a much more important one: `capped`
    // says there are more rows, `windowed` says the FILTER only looked at part
    // of the record. Rendered as one message they would be the same sentence.
    readFlagPublished.mockResolvedValue(slice([flagFile("I-200-25032-000003")], true));
    const out = await unifiedSearch({ lead: employerLead, narrow: { wageMin: 100000 } });
    expect(out.windowed).toBe(true);
    expect(out.capped).toBe(false);
  });

  it("does not report `windowed` when nothing was", async () => {
    readPermPublished.mockResolvedValue(slice([permPub("G-100-25010-000001")]));
    expect((await unifiedSearch({ lead: employerLead })).windowed).toBe(false);
  });

  it("does not report `capped` for a small answer", async () => {
    readFlagLive.mockResolvedValue(slice([flagLive("I-200-26232-000001")]));
    expect((await unifiedSearch({ lead: employerLead })).capped).toBe(false);
  });
});

describe("unifiedSearch with a case number", () => {
  it("returns the row we hold, from both halves, as one", async () => {
    lookupUnifiedCase.mockResolvedValue({
      program: "perm",
      permPublished: permPub("G-100-25010-000001"),
      permLive: permLive("G-100-25010-000001"),
      flagPublished: null,
      flagLive: null,
    });
    const { rows } = await unifiedSearch({
      lead: { kind: "case", value: "G-100-25010-000001" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ half: "published", wage: 180000 });
    // No employer search runs for a number: the lookup is a point read.
    expect(readPermPublished).not.toHaveBeenCalled();
  });

  it("labels a wage-request number as the wage-request program", async () => {
    lookupUnifiedCase.mockResolvedValue({
      program: "pwd",
      permPublished: null,
      permLive: null,
      flagPublished: null,
      flagLive: flagLive("P-100-26232-000009"),
    });
    const { rows, counts } = await unifiedSearch({
      lead: { kind: "case", value: "P-100-26232-000009" },
    });
    expect(rows[0]).toMatchObject({ program: "pwd", half: "live" });
    expect(counts).toEqual({ perm: 0, pwd: 1, lca: 0 });
  });

  it("returns nothing rather than erroring when we do not hold the case", async () => {
    const { rows, truncated } = await unifiedSearch({
      lead: { kind: "case", value: "G-100-99999-999999" },
    });
    expect(rows).toEqual([]);
    expect(truncated).toBe(false);
  });
});
