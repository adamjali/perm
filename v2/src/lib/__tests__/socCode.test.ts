import { describe, expect, it } from "vitest";

import { SOC_GROUP_SQL, isScheduleA, socGroup, socGroupClause } from "../socCode";

describe("socGroup", () => {
  // THE THREE PROGRAMS SPELL THE OCCUPATION DIFFERENTLY and an exact equality
  // across them matches nothing: `pwd_cases` holds ZERO dotted codes out of
  // 634,638, `lca_cases` holds 434,314 of them, and the leads resolved from
  // `perm_entities` arrive in both forms. None of that shows in a result set -
  // it shows as a program contributing no rows, which looks exactly like a
  // program with no rows to contribute.
  it.each([
    ["15-1252.00", "15-1252"],
    ["15-1299.09", "15-1299"],
    ["49-3051", "49-3051"],
    ["  15-1252.00  ", "15-1252"],
  ])("folds %s to its 6-digit group", (code, group) => {
    expect(socGroup(code)).toBe(group);
  });

  it("returns null for anything that is not a SOC code, rather than binding it", () => {
    for (const junk of ["", "N/A", "software", "15", "15-125", "'; DROP TABLE", null, undefined]) {
      expect(socGroup(junk)).toBeNull();
    }
  });
});

describe("socGroupClause", () => {
  it("binds the group, never the code as printed", () => {
    expect(socGroupClause("15-1252.00")).toEqual({ sql: `${SOC_GROUP_SQL} = ?`, args: ["15-1252"] });
  });

  it("matches nothing, never everything, for a code it can't read", () => {
    expect(socGroupClause("software")).toEqual({ sql: "0", args: [] });
  });
});

describe("isScheduleA", () => {
  it("knows nurses and physical therapists in either spelling, and nothing else", () => {
    expect(isScheduleA("29-1141.00")).toBe(true);
    expect(isScheduleA("29-1123")).toBe(true);
    expect(isScheduleA("15-1252.00")).toBe(false);
    expect(isScheduleA("software")).toBe(false);
    expect(isScheduleA(null)).toBe(false);
  });
});
