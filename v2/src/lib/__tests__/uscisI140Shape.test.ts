import { describe, expect, it } from "vitest";

import { parseI140Snapshot } from "../uscisI140Shape";

/**
 * The I-140 tool pages read the database copy first and fall back to Convex
 * when this returns null, so null must mean "missing or broken", never "a
 * quarter with a hole in it".
 */

const sub = (code: string, pending: number) => ({
  code,
  label: `label ${code}`,
  received: 10,
  approved: 5,
  denied: 1,
  pending,
});

const good = {
  sourceFile: "i140_fy26q2.xlsx",
  asOfQuarter: "FY2026 Q2",
  subtypes: [sub("E21", 400), sub("NIW", 900)],
  contentHash: "abc",
  computedAt: 1_760_000_000_000,
};

describe("parseI140Snapshot", () => {
  it("returns the quarter in the shape the pages take, without the hash", () => {
    expect(parseI140Snapshot(good)).toEqual({
      sourceFile: "i140_fy26q2.xlsx",
      asOfQuarter: "FY2026 Q2",
      subtypes: [sub("E21", 400), sub("NIW", 900)],
      computedAt: 1_760_000_000_000,
    });
  });

  it.each([
    ["nothing stored", null],
    ["not an object", "FY2026 Q2"],
    ["no subtypes", { ...good, subtypes: [] }],
    ["subtypes not a list", { ...good, subtypes: {} }],
    ["no quarter", { ...good, asOfQuarter: undefined }],
    ["no source file", { ...good, sourceFile: 7 }],
    ["one subtype missing a count", { ...good, subtypes: [sub("E21", 400), { ...sub("NIW", 1), pending: undefined }] }],
    ["one count not a number", { ...good, subtypes: [sub("E21", 400), { ...sub("NIW", 1), denied: "3" }] }],
  ])("refuses %s, so the page falls back to Convex", (_name, raw) => {
    expect(parseI140Snapshot(raw)).toBeNull();
  });
});
