import { describe, expect, it } from "vitest";

import { ENFORCEMENT_ACTIONS, SETTLEMENTS, actionsFor, barEnds, enforcementTotals, shortName } from "../actions";

describe("the enforcement list", () => {
  it("holds the 15 settlements DOJ's releases count, oldest first, plus Cloudera's lawsuit and DOL's suspension", () => {
    expect(SETTLEMENTS).toHaveLength(15);
    expect(ENFORCEMENT_ACTIONS.filter((a) => a.kind === "lawsuit")).toHaveLength(1);
    expect(ENFORCEMENT_ACTIONS.filter((a) => a.kind === "suspension")).toHaveLength(1);
    const days = ENFORCEMENT_ACTIONS.map((a) => a.date);
    expect([...days].sort()).toEqual(days);
  });

  it("numbers only the settlements DOJ's own releases number, each once", () => {
    const placed = SETTLEMENTS.filter((a) => a.position).map((a) => a.position);
    expect(placed).toEqual([1, 2, 3, 4, 8, 9, 13, 14, 15]);
    // Every settlement DOJ doesn't number says how its place was worked out.
    for (const a of SETTLEMENTS.filter((s) => !s.position)) expect(a.positionNote, a.id).toBeTruthy();
  });

  it("every action carries a source, a plain sentence and an ISO day", () => {
    for (const a of ENFORCEMENT_ACTIONS) {
      expect(a.sources.length, a.id).toBeGreaterThan(0);
      for (const s of a.sources) expect(s.url, a.id).toMatch(/^https:\/\/www\.(justice|dol)\.gov\//);
      expect(a.conduct, a.id).toMatch(/\.$/);
      expect(a.date, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("adds the money as the agreements state it", () => {
    const t = enforcementTotals();
    expect(t.settlements).toBe(15);
    expect(t.perm).toBe(3);
    expect(t.penalties).toBe(3_627_936);
    expect(t.backPay).toBe(7_476_000);
  });

  it("finds a company's actions by its page, newest first", () => {
    expect(actionsFor("cloudera-inc").map((a) => a.kind)).toEqual(["settlement", "suspension", "lawsuit"]);
    expect(actionsFor("statsig-inc").map((a) => a.id)).toEqual(["2026-08-03-openai"]);
    expect(actionsFor("no-such-page")).toEqual([]);
  });

  it("dates the end of a bar counted in months", () => {
    expect(barEnds("2025-07-11", 24)).toBe("2027-07-11");
    expect(barEnds("2026-05-12", 6)).toBe("2026-11-12");
  });

  it("shortens a company to the name people know", () => {
    expect(shortName("Maplebear, Inc. d/b/a Instacart")).toBe("Instacart");
    expect(shortName("OpenAI OpCo, LLC and Statsig, Inc.")).toBe("OpenAI");
    expect(shortName("Cloudera, Inc.")).toBe("Cloudera");
    expect(shortName("Diamondpick, Inc., dba Galent")).toBe("Galent");
  });
});
