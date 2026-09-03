import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The change feed: the two filters that keep it honest, and the query shape
 * that keeps it affordable.
 *
 * THE FILTERS. Both exist because of one measured incident: on 2026-08-28 the
 * first full sweep wrote 92,113 `CERTIFIED -> CERTIFIED - EXPIRED` rows under
 * one timestamp, and 45,107 more the next day. None of those expiries happened
 * on the day they were written - they are 180-day I-140 windows that lapsed
 * across two years and were all noticed at once. Rendered unfiltered, that is a
 * fabricated surge on the busiest-looking day in the record.
 *
 * THE QUERY SHAPE. Turso bills rows READ. Every statement here used to match
 * the day with `DATE(changed_at / 1000, 'unixepoch') = ?`, an expression over
 * the indexed column, and carry an unbounded `NOT IN (SELECT ... GROUP BY ...)`
 * subquery. EXPLAIN QUERY PLAN reported `SCAN perm_case_events` for three of
 * the four statements a single request issued, over 147,328 rows. Reverting
 * either half of the fix would leave every number on the page correct and the
 * bill wrong, which is exactly the kind of regression a test has to catch.
 *
 * These tests read the SQL the module actually issues rather than mocking a
 * result set, because both defects live in the predicate: a feed that dropped
 * one of the filters, or one that went back to the unindexable date form, would
 * return perfectly well-formed rows. Asserting on shaped fixture output would
 * pass either way.
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn() }));
vi.mock("../publicData", () => ({ doc: vi.fn() }));

const { getChangeCalendar, getChangeDay, getChangeActivity, DAY_ROW_CAP } =
  await import("../changes");

/** Every SQL string the module issued, whitespace collapsed for matching. */
function issued(): string[] {
  return rows.mock.calls.map((c) => String(c[0]).replace(/\s+/g, " "));
}

function argsFor(match: string): unknown[] {
  const call = rows.mock.calls.find((c) =>
    String(c[0]).replace(/\s+/g, " ").includes(match),
  );
  return (call?.[1] ?? []) as unknown[];
}

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * The real per-timestamp roll-up of `perm_case_events`, read from production
 * on 2026-09-03 with
 *
 *   SELECT changed_at AS ts, COUNT(*) AS n,
 *          SUM(CASE WHEN from_status = 'CERTIFIED'
 *                    AND to_status = 'CERTIFIED - EXPIRED' THEN 1 ELSE 0 END)
 *     FROM perm_case_events GROUP BY changed_at
 *
 * Fifteen timestamps over 147,328 rows: the sweep writes one per run. Kept
 * verbatim so the day totals below are checked against measured reality rather
 * than against numbers invented to make the fold pass.
 */
const REAL_PERM_ROLLUP = [
  { ts: 1787858206944, n: 48, expiries: 0 },
  { ts: 1787880828754, n: 58, expiries: 0 },
  { ts: 1787947868892, n: 94523, expiries: 92113 },
  { ts: 1787970309306, n: 336, expiries: 0 },
  { ts: 1788011326075, n: 46076, expiries: 45107 },
  { ts: 1788040522512, n: 96, expiries: 0 },
  { ts: 1788097636876, n: 912, expiries: 725 },
  { ts: 1788127287746, n: 91, expiries: 0 },
  { ts: 1788192560064, n: 1090, expiries: 608 },
  { ts: 1788218367601, n: 410, expiries: 0 },
  { ts: 1788269350172, n: 938, expiries: 564 },
  { ts: 1788299865593, n: 665, expiries: 0 },
  { ts: 1788353098798, n: 773, expiries: 429 },
  { ts: 1788386222123, n: 746, expiries: 0 },
  { ts: 1788439693479, n: 566, expiries: 287 },
];

/**
 * Route a mocked read by what it asks for, and by which table it names.
 * `perm` gets the real roll-up; the other two programs are empty unless a test
 * says otherwise.
 */
function mockDb(opts: {
  perm?: typeof REAL_PERM_ROLLUP;
  pwd?: typeof REAL_PERM_ROLLUP;
  lca?: typeof REAL_PERM_ROLLUP;
  rows?: Record<string, unknown>[];
  transitions?: Record<string, unknown>[];
} = {}) {
  const rollups: Record<string, typeof REAL_PERM_ROLLUP> = {
    perm: opts.perm ?? REAL_PERM_ROLLUP,
    pwd: opts.pwd ?? [],
    lca: opts.lca ?? [],
  };
  rows.mockImplementation(async (sql, args) => {
    const program = sql.includes("pwd_") ? "pwd" : sql.includes("lca_") ? "lca" : "perm";
    if (sql.includes("MIN(changed_at)")) {
      const first = rollups[program]![0];
      return first ? [{ lo: first.ts }] : [{ lo: null }];
    }
    if (sql.includes("SUM(CASE WHEN from_status")) {
      const bound = (args ?? []) as unknown[];
      const lo = Number(bound[2]);
      const hi = bound.length > 3 ? Number(bound[3]) : Number.POSITIVE_INFINITY;
      return rollups[program]!.filter((s) => s.ts >= lo && s.ts < hi);
    }
    if (sql.includes("LEFT JOIN")) return opts.rows ?? [];
    if (sql.includes("GROUP BY from_status, to_status")) return opts.transitions ?? [];
    return [];
  });
}

beforeEach(() => {
  rows.mockReset();
});

describe("the change feed's two filters", () => {
  it("excludes mechanical expiry by the status PAIR, not by the destination", async () => {
    // 20 rows in the corpus reach CERTIFIED - EXPIRED from DENIED. Excluding on
    // the destination alone would drop those too and overstate the exclusion.
    mockDb();
    await getChangeDay("2026-09-02");

    const sql = issued().find((s) => s.includes("LEFT JOIN"))!;
    expect(sql).toContain("NOT (e.from_status = ? AND e.to_status = ?)");
    const bound = argsFor("LEFT JOIN");
    expect(bound[2]).toBe("CERTIFIED");
    expect(bound[3]).toBe("CERTIFIED - EXPIRED");
  });

  it("tests a timestamp for bulk on its RAW size, not on what survives the expiry filter", async () => {
    // The 2026-08-28 backfill holds 94,523 rows of which 92,113 are expiries.
    // Testing the 2,410 remainder would put that stamp UNDER the 5,000
    // threshold and quietly restore rows the page correctly excludes.
    mockDb();
    const day = await getChangeDay("2026-08-28");

    expect(day?.total).toBe(58);
    expect(day?.bulkExcluded).toBe(2410);
    // The backfill stamp is named as a value to exclude, so the row query
    // cannot return it either.
    const bound = argsFor("LEFT JOIN");
    expect(bound).toContain(1787947868892);
  });

  it("counts every expiry that day, backfill timestamps included", async () => {
    // Silently dropping rows is indistinguishable from having no data. The
    // 92,113 the page discloses all sit under a bulk stamp, so counting them
    // only on surviving stamps would report zero and lose the disclosure.
    mockDb();
    const day = await getChangeDay("2026-08-28");
    expect(day?.expiriesExcluded).toBe(92_113);
  });

  it("reproduces every measured day total from the real roll-up", async () => {
    // Measured against production on 2026-09-03 with the pre-rewrite query.
    // The fold in TypeScript must agree with the SQL predicate it replaced.
    mockDb();
    const calendar = await getChangeCalendar();
    const totals = Object.fromEntries(calendar.days.map((d) => [d.date, d.total]));
    expect(totals).toEqual({
      "2026-09-03": 279,
      "2026-09-02": 1090,
      "2026-09-01": 1039,
      "2026-08-31": 892,
      "2026-08-30": 278,
      "2026-08-29": 432,
      "2026-08-28": 58,
      "2026-08-27": 48,
    });
  });

  it("applies the identical rule to the calendar and to the day it lists", async () => {
    // A calendar and a day computed under different rules disagree about which
    // days hold data, so a reader picks a day and is told it is empty.
    mockDb();
    const calendar = await getChangeCalendar();
    for (const d of calendar.days) {
      rows.mockClear();
      const day = await getChangeDay(d.date);
      expect([d.date, day?.total]).toEqual([d.date, d.total]);
    }
  });
});

describe("the query shape that keeps the feed affordable", () => {
  it("matches the day with a RANGE on changed_at, never with DATE()", async () => {
    // `DATE(changed_at / 1000, 'unixepoch') = ?` is an expression over the
    // indexed column, so SQLite cannot use `case_events_recent` and the plan
    // was `SCAN perm_case_events` over 147,328 rows. Measured before and after:
    //   before  SCAN e
    //   after   SEARCH e USING INDEX case_events_recent (changed_at>? AND changed_at<?)
    mockDb();
    await getChangeDay("2026-09-02");

    for (const sql of issued()) {
      expect(sql).not.toContain("DATE(");
      expect(sql).not.toContain("unixepoch");
    }
    const bound = argsFor("LEFT JOIN");
    expect(bound[0]).toBe(ms("2026-09-02"));
    expect(bound[1]).toBe(ms("2026-09-03"));
  });

  it("issues no correlated subquery over the whole table", async () => {
    // The bulk timestamps come from the roll-up and are bound as values. The
    // old `changed_at NOT IN (SELECT ... GROUP BY changed_at HAVING COUNT(*) >
    // ?)` was a second unbounded pass on every statement that carried it.
    mockDb();
    await getChangeDay("2026-09-02");
    for (const sql of issued()) {
      expect(sql).not.toContain("HAVING COUNT(*)");
      expect(sql).not.toMatch(/NOT IN \(\s*SELECT/);
    }
  });

  it("never re-computes the picker's day list on a single-day read", async () => {
    // The client already holds it from the prerendered HTML. Building it cost
    // two unbounded passes per request.
    mockDb();
    await getChangeDay("2026-09-02");
    for (const sql of issued()) {
      // A day list groups by the derived date; a day read groups by timestamp.
      expect(sql).not.toContain("GROUP BY d");
    }
  });

  it("bounds the single-day roll-up at both ends", async () => {
    // Without a ceiling, asking about an old day reads every timestamp from
    // that day to the present - the unbounded read this rewrite removes.
    mockDb();
    await getChangeDay("2026-08-27");
    const roll = issued().find((s) => s.includes("SUM(CASE WHEN from_status"))!;
    expect(roll).toContain("WHERE changed_at >= ? AND changed_at < ?");
    const bound = argsFor("SUM(CASE WHEN from_status");
    expect(bound[2]).toBe(ms("2026-08-27"));
    expect(bound[3]).toBe(ms("2026-08-28"));
  });

  it("costs no query at all for a program with nothing that day", async () => {
    // Two of the three programs are usually empty. Their roll-up says so, and
    // the row and transition reads are skipped rather than issued and thrown
    // away.
    mockDb();
    await getChangeDay("2026-09-02");
    const sql = issued();
    expect(sql.some((s) => s.includes("pwd_case_events") && s.includes("LEFT JOIN"))).toBe(false);
    expect(sql.some((s) => s.includes("lca_case_events") && s.includes("LEFT JOIN"))).toBe(false);
    // The PERM half still runs.
    expect(sql.some((s) => s.includes("perm_case_events") && s.includes("LEFT JOIN"))).toBe(true);
  });
});

describe("the three programs", () => {
  it("reads all three, and splits the day's total between them", async () => {
    mockDb({
      perm: [{ ts: ms("2026-09-03") + 3_600_000, n: 10, expiries: 0 }],
      pwd: [{ ts: ms("2026-09-03") + 3_600_000, n: 4, expiries: 0 }],
      lca: [{ ts: ms("2026-09-03") + 3_600_000, n: 3, expiries: 0 }],
    });
    const day = await getChangeDay("2026-09-03");
    expect(day?.byProgram).toEqual({ perm: 10, pwd: 4, lca: 3 });
    expect(day?.total).toBe(17);
  });

  it("reports when each program's observations began, so an empty day is not read as an idle one", async () => {
    mockDb({
      perm: REAL_PERM_ROLLUP,
      pwd: [{ ts: 1788439693479, n: 200, expiries: 0 }],
    });
    const calendar = await getChangeCalendar();
    expect(calendar.programSince.perm).toBe("2026-08-27");
    expect(calendar.programSince.pwd).toBe("2026-09-03");
    expect(calendar.programSince.lca).toBeNull();
  });

  it("tags every row with the program it came from", async () => {
    mockDb({
      perm: [{ ts: ms("2026-09-03") + 60_000, n: 1, expiries: 0 }],
      rows: [
        {
          case_number: "G-100-25308-370619",
          from_status: "ANALYST REVIEW",
          to_status: "CERTIFIED",
          to_final: 1,
          employer_name: " Flextronics International USA, Inc.",
          job_title: "Automation Engineer",
          filing_date: "2025-11-04",
        },
      ],
    });
    const day = await getChangeDay("2026-09-03");
    expect(day?.changes[0]?.program).toBe("perm");
    // DOL returns some employer names with a leading space. Untrimmed, that
    // name sorts before every other employer and a search for "Flextronics"
    // still matches, but an exact one does not.
    expect(day?.changes[0]?.employerName).toBe("Flextronics International USA, Inc.");
  });
});

describe("what the feed refuses to do", () => {
  it("returns null rather than an empty shell when no day has events", async () => {
    mockDb({ perm: [] });
    expect(await getChangeActivity(null, 10)).toBeNull();
  });

  it("falls back to the newest day when asked for one that holds nothing", async () => {
    // An empty answer to "what happened on the 4th" reads as "DOL did nothing",
    // which is not what it means.
    mockDb();
    const activity = await getChangeActivity("1999-01-01", 10);
    expect(activity?.day.date).toBe("2026-09-03");
    expect(activity?.calendar.observedSince).toBe("2026-08-27");
  });

  it("clamps the caller's row limit to the cap", async () => {
    mockDb();
    await getChangeDay("2026-09-02", 999_999);
    const bound = argsFor("LEFT JOIN");
    expect(bound[bound.length - 1]).toBe(DAY_ROW_CAP);
  });

  it("refuses a date that is not a date", async () => {
    mockDb();
    expect(await getChangeDay("not-a-day")).toBeNull();
    expect(rows).not.toHaveBeenCalled();
  });
});
