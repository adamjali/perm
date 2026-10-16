import { describe, expect, it } from "vitest";

import { moveLabel, movesFrom, parseRfiPath, reconsiderationOutcome, type Move } from "../stageMoves";

// Counts shaped like the Oct 15 2026 doc.
const EXITS: Move[] = [
  { from: "RFI ISSUED", to: "ANALYST REVIEW", n: 1353 },
  { from: "RFI ISSUED", to: "WITHDRAWN", n: 47 },
  { from: "RFI ISSUED", to: "CERTIFIED", n: 30 },
  { from: "RFI ISSUED", to: "DENIED", n: 4 },
  { from: "RECONSIDERATION APPEALS", to: "CERTIFIED", n: 205 },
  { from: "RECONSIDERATION APPEALS", to: "NORD ISSUED", n: 171 },
  { from: "RECONSIDERATION APPEALS", to: "APPLICATION ON HOLD", n: 11 },
  { from: "RECONSIDERATION APPEALS", to: "ANALYST REVIEW", n: 10 },
  { from: "RECONSIDERATION APPEALS", to: "DENIED", n: 10 },
  { from: "RECONSIDERATION APPEALS", to: "BALCA APPEALS", n: 3 },
  { from: "NORD ISSUED", to: "DENIED", n: 162 },
  { from: "NORD ISSUED", to: "REQUEST FOR REVIEW", n: 51 },
  { from: "BALCA APPEALS", to: "DENIED - BALCA DISMISSED", n: 10 },
];

describe("where a stage leads", () => {
  it("lists destinations largest first, with shares that add up to one", () => {
    const m = movesFrom(EXITS, "rfi issued");
    expect(m?.total).toBe(1434);
    expect(m?.rows[0]).toMatchObject({ to: "ANALYST REVIEW", label: "Back to analyst review", tone: "line" });
    expect(m!.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
  });

  it("folds destinations under 2% into one row instead of dropping them", () => {
    const m = movesFrom(EXITS, "RFI ISSUED")!;
    expect(m.rows.map((r) => r.to)).toEqual(["ANALYST REVIEW", "WITHDRAWN", "CERTIFIED", "OTHER"]);
    expect(m.rows.reduce((s, r) => s + r.n, 0)).toBe(1434);
  });

  it("says nothing about a stage with too few moves to be a share", () => {
    expect(movesFrom(EXITS, "BALCA APPEALS")).toBeNull();
    expect(movesFrom(EXITS, "SUPERVISED RECRUITMENT")).toBeNull();
  });

  it("names a status it has no label for in readable words", () => {
    expect(moveLabel("SUPERVISED RECRUITMENT")).toBe("Supervised Recruitment");
  });
});

describe("motions to reconsider", () => {
  it("counts certified or sent back as granted, a NORD or denial as refused, and BALCA as neither", () => {
    expect(reconsiderationOutcome(EXITS)).toEqual({ decided: 407, granted: 226, refused: 181, grantedShare: 226 / 407 });
  });

  it("claims no rate from a handful", () => {
    expect(reconsiderationOutcome(EXITS.filter((m) => m.from !== "RECONSIDERATION APPEALS").concat({ from: "RECONSIDERATION APPEALS", to: "CERTIFIED", n: 5 }))).toBeNull();
  });
});

describe("the RFI path", () => {
  const good = {
    since: "2026-08-28",
    entered: 1109,
    inRfi: 667,
    repliedWaiting: 105,
    decided: { certified: 303, denied: 8, withdrawn: 26, other: 0 },
    afterReply: { certified: 296, denied: 8, withdrawn: 4, other: 0 },
  };

  it("reads a doc that adds up", () => {
    expect(parseRfiPath(good)).toEqual(good);
  });

  it("refuses one that doesn't: every RFI must sit in exactly one place", () => {
    expect(parseRfiPath({ ...good, inRfi: 666 })).toBeNull();
    expect(parseRfiPath({ ...good, afterReply: { certified: 400, denied: 8, withdrawn: 4, other: 0 } })).toBeNull();
    expect(parseRfiPath({ ...good, entered: "1109" })).toBeNull();
    expect(parseRfiPath(null)).toBeNull();
  });
});
