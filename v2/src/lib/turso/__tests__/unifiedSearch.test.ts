import { beforeEach, describe, expect, it, vi } from "vitest";

const searchCases = vi.fn();
const searchLiveCases = vi.fn();
const searchPwdCases = vi.fn();
const searchPwdDeterminations = vi.fn();
const searchLcaCases = vi.fn();
const searchLcaDisclosed = vi.fn();

vi.mock("../cases", () => ({ searchCases, searchLiveCases }));
vi.mock("../pwdCases", () => ({ searchPwdCases, searchPwdDeterminations }));
vi.mock("../lcaCases", () => ({ searchLcaCases, searchLcaDisclosed }));

const { dedupeToOnePerCase, unifiedSearch } = await import("../unifiedSearch");
type UnifiedCase = Parameters<typeof dedupeToOnePerCase>[0][number];

/** A published PERM row, as `searchCases` returns it. */
const permPub = (caseNumber: string, over: Record<string, unknown> = {}) => ({
  caseNumber,
  status: "CERTIFIED",
  receivedDate: "2025-01-10",
  decisionDate: "2025-11-02",
  days: 296,
  employerName: "ACME CORP",
  employerSlug: "acme-corp",
  state: "WA",
  jobTitle: "Engineer",
  socCode: "15-1252",
  socTitle: "Software Developers",
  attorneyName: "Firm LLP",
  attorneySlug: "firm-llp",
  wage: 180000,
  ...over,
});

/** A live PERM row, as `searchLiveCases` returns it. A DIFFERENT SHAPE. */
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
  wage: 140000,
  wageUnit: "Year",
  worksiteState: "TX",
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  searchCases.mockResolvedValue([]);
  searchLiveCases.mockResolvedValue([]);
  searchPwdCases.mockResolvedValue([]);
  searchPwdDeterminations.mockResolvedValue([]);
  searchLcaCases.mockResolvedValue([]);
  searchLcaDisclosed.mockResolvedValue([]);
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

describe("unifiedSearch", () => {
  it("labels each row with the program and half it came from", async () => {
    searchCases.mockResolvedValue([permPub("G-100-25010-000001")]);
    searchPwdCases.mockResolvedValue([flagLive("P-100-26232-000002")]);
    searchLcaDisclosed.mockResolvedValue([flagFile("I-200-25032-000003")]);

    const { rows } = await unifiedSearch({ text: "acme" });
    const byNumber = Object.fromEntries(rows.map((r) => [r.caseNumber, r]));

    expect(byNumber["G-100-25010-000001"]).toMatchObject({ program: "perm", half: "published" });
    expect(byNumber["P-100-26232-000002"]).toMatchObject({ program: "pwd", half: "live" });
    expect(byNumber["I-200-25032-000003"]).toMatchObject({ program: "lca", half: "published" });
  });

  it("shows a case in BOTH halves once, keeping the published record", async () => {
    // The live table holds it because the daily check saw it; the quarterly
    // file holds it because DOL has since decided it. Two rows for one case is
    // the obvious bug, and the published one is the richer record.
    const n = "P-100-26232-000009";
    searchPwdCases.mockResolvedValue([flagLive(n)]);
    searchPwdDeterminations.mockResolvedValue([flagFile(n)]);

    const { rows } = await unifiedSearch({ text: "acme" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ half: "published", wage: 140000, decidedOn: "2025-06-01" });
  });

  it("reads the two PERM halves through their own shapes", async () => {
    // They are genuinely different row types. A single adapter with optional
    // fields would silently produce undefined here.
    searchCases.mockResolvedValue([permPub("G-100-25010-000001")]);
    searchLiveCases.mockResolvedValue([permLive("G-100-26213-000002")]);

    const { rows } = await unifiedSearch({ text: "acme" });
    const pub = rows.find((r) => r.caseNumber === "G-100-25010-000001");
    const live = rows.find((r) => r.caseNumber === "G-100-26213-000002");

    expect(pub).toMatchObject({ filedOn: "2025-01-10", decidedOn: "2025-11-02", wage: 180000, isFinal: true, state: "WA" });
    expect(live).toMatchObject({ filedOn: "2026-08-01", decidedOn: null, wage: null, isFinal: false });
  });

  it("orders newest filing first, with the case number breaking ties", async () => {
    searchCases.mockResolvedValue([
      permPub("G-100-25010-000001", { receivedDate: "2025-01-01" }),
      permPub("G-100-25010-000003", { receivedDate: "2025-03-01" }),
      permPub("G-100-25010-000002", { receivedDate: "2025-03-01" }),
    ]);
    const { rows } = await unifiedSearch({ text: "acme" });
    expect(rows.map((r) => r.caseNumber)).toEqual([
      "G-100-25010-000003",
      "G-100-25010-000002",
      "G-100-25010-000001",
    ]);
  });

  it("only reads the programs asked for", async () => {
    await unifiedSearch({ text: "acme", programs: ["pwd"] });
    expect(searchPwdCases).toHaveBeenCalledTimes(1);
    expect(searchCases).not.toHaveBeenCalled();
    expect(searchLcaCases).not.toHaveBeenCalled();
  });

  it("counts the RETURNED rows, not everything it collected", async () => {
    // The chips above the table have to describe the table. Counting the
    // collected set prints a number the reader cannot find on screen.
    searchCases.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => permPub(`G-100-25010-00000${i}`, { receivedDate: `2025-01-0${i + 1}` })),
    );
    const { rows, counts, truncated } = await unifiedSearch({ text: "acme", limit: 2 });
    expect(rows).toHaveLength(2);
    expect(counts.perm).toBe(2);
    expect(truncated).toBe(true);
  });

  it("survives one program's table being unavailable, and still returns the others", async () => {
    searchLcaCases.mockRejectedValue(new Error("turso query deadline"));
    searchCases.mockResolvedValue([permPub("G-100-25010-000001")]);

    const { rows } = await unifiedSearch({ text: "acme" });
    expect(rows.map((r) => r.caseNumber)).toEqual(["G-100-25010-000001"]);
  });

  it("passes the narrowing filters through, and omits the ones not given", async () => {
    await unifiedSearch({ text: "acme", title: "engineer", from: "2025-01" });
    expect(searchCases).toHaveBeenCalledWith(
      expect.objectContaining({ field: "employer", text: "acme", title: "engineer", from: "2025-01" }),
    );
    expect(searchCases.mock.calls[0]?.[0]).not.toHaveProperty("to");
  });

  it("reports `capped` when a source returned a full page", async () => {
    searchLcaCases.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => flagLive(`I-200-26232-${String(i).padStart(6, "0")}`)),
    );
    const { capped } = await unifiedSearch({ text: "acme" });
    expect(capped).toBe(true);
  });

  it("does not report `capped` for a small answer", async () => {
    searchLcaCases.mockResolvedValue([flagLive("I-200-26232-000001")]);
    const { capped } = await unifiedSearch({ text: "acme" });
    expect(capped).toBe(false);
  });
});
