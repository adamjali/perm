import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PAGE_SIZE, SECTORS, finderHref, finderSql, finderWhere, parseFinder } from "../sponsorFinder";

const STATES = new Set(["CA", "TX", "NY"]);

describe("sponsor finder filters", () => {
  it("reads only values it knows, and defaults the rest", () => {
    const f = parseFinder({ state: "ca", sector: "54", recent: "25", rate: "0.95", sort: "rate", page: "3", transfers: "1" }, STATES);
    expect(f).toMatchObject({ state: "CA", sector: "54", minRecent: 25, minRate: 0.95, sort: "rate", page: 3, transfers: true });
    const junk = parseFinder({ state: "ZZ", sector: "99", recent: "7", rate: "0.5", sort: "drop table", page: "-4" }, STATES);
    expect(junk).toMatchObject({ state: null, sector: null, minRecent: 1, minRate: null, sort: "recent", page: 1 });
  });

  it("caps the page so a crawler can't walk forever", () => {
    expect(parseFinder({ page: "99999" }, STATES).page).toBe(200);
  });

  it("writes a short canonical link, defaults left out", () => {
    expect(finderHref(parseFinder({}, STATES))).toBe("/sponsor-finder");
    expect(finderHref(parseFinder({ state: "TX", cap: "1" }, STATES), 2)).toBe("/sponsor-finder?state=TX&cap=1&page=2");
  });

  it("binds every value, and leaves debarred employers out unless asked", () => {
    const { where, args } = finderWhere(parseFinder({ state: "NY", rate: "0.99" }, STATES));
    expect(where).toBe("perm_recent >= ? AND state = ? AND perm_decided >= 20 AND perm_rate >= ? AND debarred = 0");
    expect(args).toEqual([1, "NY", 0.99]);
    expect(finderWhere(parseFinder({ debarred: "1" }, STATES)).where).not.toContain("debarred");
  });

  it("sorting by rate only counts rates over 20 decided cases", () => {
    expect(finderWhere(parseFinder({ sort: "rate" }, STATES)).where).toContain("perm_decided >= 20");
  });

  it("pages 50 at a time", () => {
    const q = finderSql(parseFinder({ page: "2" }, STATES));
    expect(q.pageArgs.slice(-2)).toEqual([PAGE_SIZE, PAGE_SIZE]);
    expect(q.page).toContain("ORDER BY perm_recent DESC, slug LIMIT ? OFFSET ?");
  });

  it("names the same sectors as the nightly builder", () => {
    const py = readFileSync(join(__dirname, "..", "..", "..", "scripts", "build_sponsor_index.py"), "utf8");
    const block = py.slice(py.indexOf("SECTORS = {"), py.indexOf("}", py.indexOf("SECTORS = {")));
    const pairs = [...block.matchAll(/"(\d{2})": "([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const);
    const merged = new Map([["32", "31"], ["33", "31"], ["45", "44"], ["49", "48"]]);
    for (const [code, label] of pairs) {
      const key = merged.get(code) ?? code;
      expect(SECTORS[key], code).toBe(label);
    }
    expect(Object.keys(SECTORS).length).toBe(new Set(pairs.map(([c]) => merged.get(c) ?? c)).size);
  });
});
