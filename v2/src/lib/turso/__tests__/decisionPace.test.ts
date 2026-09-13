import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rate the decision-pace estimate divides by.
 *
 * WHY THIS IS TESTED SEPARATELY FROM `measurePace`. The maths is already
 * probed in `convex/lib/perm/calculators/decisionPace.test.ts`. What lives
 * here are the three ways this layer can hand the model a number it should
 * not have: reading the wrong source, reading a series that has stopped, and
 * handing the days over in the wrong order.
 *
 * `daily_decisions` carries TWO sources and only one can answer "recently".
 * `dol-disclosure` is dated by DOL's own decision date and stops at the last
 * published quarter - currently 2026-06-30 - so a pace built from it would be
 * measuring a window that ended months ago while looking perfectly healthy.
 */
const rowsMock = vi.fn();
vi.mock("../client", () => ({
  rows: (...a: unknown[]) => rowsMock(...a),
  one: vi.fn(),
  turso: () => ({}),
  exec: vi.fn(),
}));

/** 28 days ending `through`, weekdays at `n`, weekends at a third. */
function series(through: string, n = 800, len = 28) {
  const end = Date.parse(`${through}T00:00:00Z`);
  const out: { date: string; total: number }[] = [];
  for (let i = 0; i < len; i++) {
    const d = new Date(end - i * 86_400_000);
    const dow = d.getUTCDay();
    out.push({
      date: d.toISOString().slice(0, 10),
      total: dow === 0 || dow === 6 ? Math.round(n * 0.33) : n,
    });
  }
  return out; // newest first, exactly as the SQL orders it
}

const today = () => new Date().toISOString().slice(0, 10);

// A GENEROUS TIMEOUT, AND THE REASON IS THE IMPORT, NOT THE CODE. Each test
// does `vi.resetModules()` then re-imports the module, because `cache()`
// memoises and a second call under a different mock would otherwise return
// the first result. That re-import pulls the whole `@/lib/perm` barrel each
// time - about 1-3 seconds. Alone the file runs in ~3s; inside the full
// parallel suite it blew the default 5s and failed as a flake rather than a
// defect. Raising the budget is the honest fix; mocking `measurePace` away
// would make the test stop exercising the thing it exists for.
describe("getDecisionPace", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.resetModules();
    rowsMock.mockReset();
  });

  const load = async () => (await import("../decisionPace")).getDecisionPace();

  it("reads the OBSERVED source, never the disclosure one", async () => {
    rowsMock.mockResolvedValue(series(today()));
    await load();
    const [sql, args] = rowsMock.mock.calls[0]!;
    expect(String(sql)).toContain("daily_decisions");
    // The bug this prevents: a pace measured over a window that ended when
    // the last quarterly file did, reported as "the last 28 days".
    expect((args as unknown[])[0]).toBe("sweep-observed");
  });

  it("measures a rate from a healthy series", async () => {
    rowsMock.mockResolvedValue(series(today()));
    const got = await load();
    expect(got).not.toBeNull();
    expect(got!.pace.pace).toBeGreaterThan(0);
    // The calendar rate must sit BELOW the weekday rate; a weekday-only
    // number projected across seven days is the 11%-high bug.
    expect(got!.pace.pace).toBeLessThan(got!.pace.weekdayMean);
  });

  it("returns null when the series has STOPPED, rather than a stale rate", async () => {
    const stale = new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10);
    rowsMock.mockResolvedValue(series(stale));
    expect(await load()).toBeNull();
  });

  it("returns null on an empty series", async () => {
    rowsMock.mockResolvedValue([]);
    expect(await load()).toBeNull();
  });

  it("returns null when the query throws, rather than taking the page down", async () => {
    rowsMock.mockRejectedValue(new Error("turso query deadline"));
    expect(await load()).toBeNull();
  });

  it("returns null when there are too few days to commit to a rate", async () => {
    rowsMock.mockResolvedValue(series(today(), 800, 4));
    expect(await load()).toBeNull();
  });

  it("reports the NEWEST day as `through`, whatever order the rows arrive in", async () => {
    // `through` is what the staleness guard above is measured against, so it
    // has to be the newest date rather than the first row. Asserted both ways
    // because the SQL orders DESC today and a future index change could flip
    // it without anyone noticing.
    const s = series(today());
    rowsMock.mockResolvedValue(s);
    expect((await load())!.through).toBe(s[0]!.date);

    vi.resetModules();
    rowsMock.mockResolvedValue([...s].reverse());
    const flipped = await load();
    expect(flipped!.through).toBe(s[0]!.date);
    expect(flipped!.daysObserved).toBe(s.length);
  });

  it("coerces counts that libSQL hands back as strings", async () => {
    // Integers arriving as strings has bitten three separate diffs in this
    // repo. A string here would make every arithmetic operation concatenate.
    const s = series(today()).map((r) => ({ ...r, total: String(r.total) }));
    rowsMock.mockResolvedValue(s as unknown as { date: string; total: number }[]);
    const got = await load();
    expect(got).not.toBeNull();
    expect(Number.isFinite(got!.pace.pace)).toBe(true);
    expect(got!.pace.pace).toBeGreaterThan(100);
  });
});
