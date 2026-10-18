import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MIN_DECIDED_FOR_MEDIAN, MIN_DECIDED_FOR_RATE } from "../entityPayload";
import { DAYS_PER_MONTH } from "../time";
import { ANY, DEFAULT_FILTERS, PAGE_SIZE, SORTS, finderHref, finderSql, finderWhere, parseFinder } from "../sponsorFinder";
import { SPONSOR_SHARE_MIN } from "../sponsorProfile";

const STATES = new Set(["CA", "TX", "NY"]);
const SOC = "15-1252";

describe("sponsor finder filters", () => {
  it("reads only values it knows, and defaults the rest", () => {
    const f = parseFinder(
      { job: " software-developers ", state: "ca", sector: "54", recent: "25", rate: "0.95", wage: "100000", within: "14", sort: "wage", page: "3", transfers: "1", waiting: "1" },
      STATES,
    );
    expect(f).toMatchObject({
      job: "software-developers", state: "CA", sector: "54", minRecent: 25, minRate: 0.95, minWage: 100000,
      withinMonths: 14, sort: "wage", page: 3, transfers: true, waitingNow: true,
    });
    const junk = parseFinder({ state: "ZZ", sector: "32", recent: "7", rate: "0.5", wage: "1", within: "2", sort: "drop table", page: "-4" }, STATES);
    expect(junk).toMatchObject({
      state: null, sector: null, minRecent: 1, minRate: null, minWage: null, withinMonths: null, sort: "recent", page: 1,
    });
  });

  it("caps the page and the job box so a crawler can't walk forever", () => {
    expect(parseFinder({ page: "99999" }, STATES).page).toBe(200);
    expect(parseFinder({ job: "x".repeat(500) }, STATES).job.length).toBe(80);
  });

  it("writes a short canonical link, defaults left out", () => {
    expect(finderHref(DEFAULT_FILTERS)).toBe("/sponsor-finder");
    // A search lands on its answer, not on the form above it.
    expect(finderHref({ ...DEFAULT_FILTERS, job: "software-developers" })).toBe(
      "/sponsor-finder?job=software-developers#answer",
    );
    expect(finderHref(parseFinder({ job: "registered-nurses", state: "TX", cap: "1" }, STATES), 2)).toBe(
      "/sponsor-finder?job=registered-nurses&state=TX&cap=1&page=2#answer",
    );
  });

  it("reads one job and one state, the rollup rows for every job and every state", () => {
    expect(finderWhere(parseFinder({}, STATES), ANY).args.slice(0, 2)).toEqual([ANY, ANY]);
    expect(finderWhere(parseFinder({ state: "NY" }, STATES), SOC).args.slice(0, 2)).toEqual([SOC, "NY"]);
  });

  it("binds every value, and leaves debarred employers out unless asked", () => {
    const { where, args } = finderWhere(parseFinder({ state: "NY", rate: "0.99", within: "13" }, STATES), SOC);
    expect(args).toEqual([SOC, "NY", 1, 0.99, Math.round(13 * DAYS_PER_MONTH)]);
    expect(where).toContain("s.debarred = 0");
    expect(where).not.toContain("'");
    expect(finderWhere(parseFinder({ debarred: "1" }, STATES), ANY).where).not.toContain("debarred");
  });

  it("rates, medians and their sorts use the employer page's own floors, once each", () => {
    const rated = finderWhere(parseFinder({ rate: "0.9", sort: "rate" }, STATES), ANY).where;
    expect(rated).toContain(`>= ${MIN_DECIDED_FOR_RATE}`);
    expect(rated.split(`>= ${MIN_DECIDED_FOR_RATE}`).length - 1).toBe(1);
    const medians = finderWhere(parseFinder({ wage: "50000", within: "16", sort: "quickest" }, STATES), ANY).where;
    expect(medians).toContain(`>= ${MIN_DECIDED_FOR_MEDIAN}`);
  });

  it("orders by the sort's own column, then the slug so pages never overlap", () => {
    const q = finderSql(parseFinder({ page: "2", sort: "quickest" }, STATES), ANY);
    expect(q.pageArgs.slice(-2)).toEqual([PAGE_SIZE, PAGE_SIZE]);
    expect(q.page).toContain(`ORDER BY ${SORTS.quickest.order}, s.slug LIMIT ? OFFSET ?`);
  });
});

describe("the builder and the finder agree", () => {
  const py = readFileSync(join(__dirname, "..", "..", "..", "scripts", "build_sponsor_index.py"), "utf8");

  it("on the rollup key", () => {
    expect(py).toMatch(new RegExp(`^ANY = "${ANY}"$`, "m"));
  });

  it("on the rate floor", () => {
    expect(py).toMatch(new RegExp(`^RATE_MIN_DECIDED = ${MIN_DECIDED_FOR_RATE}$`, "m"));
  });

  it("on the H-1B shares' floor", () => {
    expect(py).toMatch(new RegExp(`^MIN_N = ${SPONSOR_SHARE_MIN}$`, "m"));
  });
});
