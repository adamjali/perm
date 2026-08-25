import { describe, expect, it } from "vitest";

import {
  approvalRate,
  isEntityKind,
  packRow,
  unpackRow,
  type EntityRow,
} from "../entityPayload";
import { socGroup } from "../socGroups";
import { stateName } from "../usStateNames";

const FULL: EntityRow = {
  slug: "microsoft-corporation",
  name: "Microsoft Corporation",
  rank: 1,
  total: 4840,
  certified: 4341,
  denied: 52,
  medianDays: 412,
  medianAnnualWage: 150139,
  state: "WA",
  code: "15-1252.00",
};

const SPARSE: EntityRow = {
  slug: "tiny-llc",
  name: "Tiny LLC",
  rank: 12240,
  total: 3,
  certified: 0,
  denied: 0,
  medianDays: null,
  medianAnnualWage: null,
  state: null,
  code: null,
};

describe("entityPayload", () => {
  it("round-trips a full row through the positional format", () => {
    expect(unpackRow(packRow(FULL))).toEqual(FULL);
  });

  it("round-trips nulls without turning them into anything else", () => {
    // The wire format is positional, so a field that packs as `undefined`
    // would shift every field after it AND JSON.stringify would drop it,
    // silently renaming the columns of every row in the payload.
    const packed = packRow(SPARSE);
    expect(packed).toHaveLength(10);
    expect(JSON.parse(JSON.stringify(packed))).toHaveLength(10);
    expect(unpackRow(JSON.parse(JSON.stringify(packed)))).toEqual(SPARSE);
  });

  it("keeps field ORDER stable, because order is the whole contract", () => {
    // Encode and decode index through the same constants, so a reordering
    // would be invisible in a round-trip test alone. Pin the positions.
    const p = packRow(FULL);
    expect(p[0]).toBe("microsoft-corporation");
    expect(p[1]).toBe("Microsoft Corporation");
    expect(p[2]).toBe(1);
    expect(p[3]).toBe(4840);
    expect(p[8]).toBe("WA");
    expect(p[9]).toBe("15-1252.00");
  });

  it("returns NULL, not zero, when nothing was decided", () => {
    // Zero would rank an employer with one pending case below a genuine 50%
    // on a descending sort and ABOVE nothing on an ascending one. Null lets
    // the table sort it last in both directions.
    expect(approvalRate({ certified: 0, denied: 0 })).toBeNull();
    expect(approvalRate({ certified: 9, denied: 1 })).toBeCloseTo(0.9);
    expect(approvalRate({ certified: 0, denied: 4 })).toBe(0);
  });

  it("measures approval over DECIDED cases, so withdrawals sit on neither side", () => {
    // 100 filed, 80 certified, 4 denied, 16 withdrawn. Counting withdrawals as
    // denials gives 80%; as approvals, 96%. Both misstate it. The answer is
    // 80/84.
    expect(approvalRate({ certified: 80, denied: 4 })).toBeCloseTo(80 / 84);
  });

  it("guards the kind on the way in", () => {
    expect(isEntityKind("employer")).toBe(true);
    expect(isEntityKind("employers")).toBe(false);
    expect(isEntityKind("../../etc/passwd")).toBe(false);
  });
});

describe("socGroup", () => {
  it("reads the major group out of the code", () => {
    expect(socGroup("15-1252.00")).toBe("Computer and mathematical");
    expect(socGroup("29-1141.00")).toBe("Healthcare practitioners");
    expect(socGroup("51-3022.00")).toBe("Production");
  });

  it("returns null rather than a wrong bucket for what it cannot read", () => {
    expect(socGroup(null)).toBeNull();
    expect(socGroup("")).toBeNull();
    expect(socGroup("99-9999.00")).toBeNull();
  });
});

describe("stateName", () => {
  it("spells out states and the territories DOL files actually use", () => {
    expect(stateName("WA")).toBe("Washington");
    expect(stateName("PR")).toBe("Puerto Rico");
    expect(stateName("MP")).toBe("Northern Mariana Islands");
  });

  it("does NOT truncate a name into a different state's code", () => {
    // The ingest once derived codes with `name[:2]`, which turns ALASKA into
    // "AL" and files every Alaskan case under Alabama.
    expect(stateName("AK")).toBe("Alaska");
    expect(stateName("AL")).toBe("Alabama");
  });

  it("hands back an unknown code rather than an empty cell", () => {
    expect(stateName("ZZ")).toBe("ZZ");
  });
});
