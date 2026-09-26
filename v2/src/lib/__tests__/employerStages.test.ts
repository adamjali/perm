import { describe, expect, it } from "vitest";

import {
  decisionSentence,
  employerMoves,
  holdSentence,
  holdSincePhrase,
  moveSentence,
  nationalShare,
  parseEmployerStagesDoc,
  rankByReview,
  rankByShare,
  type EmployerStageRow,
} from "../employerStages";

const row = (name: string, pending: number, byStatus: Record<string, number>, slug: string | null = null): EmployerStageRow => {
  const review = Object.entries(byStatus).filter(([s]) => s !== "ANALYST REVIEW").reduce((a, [, n]) => a + n, 0);
  return { name, slug, pending, review, share: pending ? review / pending : 0, byStatus };
};

const big = row("Cognizant", 1832, { "APPLICATION ON HOLD": 1831, "ANALYST REVIEW": 1 }, "cognizant");
const mid = row("Acme", 400, { "ANALYST REVIEW": 380, "RFI ISSUED": 20 }, "acme");
const tiny = row("Two Cases LLC", 2, { "APPLICATION ON HOLD": 2 });
const clean = row("Clean Co", 900, { "ANALYST REVIEW": 900 }, "clean-co");

const doc = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    asOf: "2026-09-08",
    pendingTotal: 3134,
    nationwide: { "ANALYST REVIEW": 1281, "APPLICATION ON HOLD": 1833, "RFI ISSUED": 20 },
    minPending: 5,
    employers: [big, mid, tiny, clean],
    ...over,
  });

describe("parseEmployerStagesDoc", () => {
  it("accepts a fresh, self-consistent document", () => {
    const d = parseEmployerStagesDoc(doc(), 1_000, 1_000 + 86_400_000);
    expect(d?.employers).toHaveLength(4);
    expect(d?.nationwide["APPLICATION ON HOLD"]).toBe(1833);
  });

  it("rejects a document older than eight days, one whose statuses do not sum to its total, and malformed rows", () => {
    expect(parseEmployerStagesDoc(doc(), 0, 9 * 86_400_000)).toBeNull();
    expect(parseEmployerStagesDoc(doc({ pendingTotal: 3000 }), 0, 1)).toBeNull();
    expect(parseEmployerStagesDoc(doc({ employers: [{ name: "x" }] }), 0, 1)).toBeNull();
    expect(parseEmployerStagesDoc("{not json", 0, 1)).toBeNull();
  });
});

describe("the two rankings", () => {
  it("ranks by cases outside the normal queue, dropping employers with none", () => {
    expect(rankByReview([mid, big, clean, tiny]).map((r) => r.name)).toEqual(["Cognizant", "Acme", "Two Cases LLC"]);
  });

  it("ranks by share only above the floor, so two of two is not a signal", () => {
    expect(rankByShare([mid, big, clean, tiny]).map((r) => r.name)).toEqual(["Cognizant", "Acme"]);
    expect(rankByShare([mid, big, clean, tiny], 50, 2).map((r) => r.name)).toEqual(["Two Cases LLC", "Cognizant", "Acme"]);
  });

  it("gives an employer's share of the nationwide count at a status, and zero for an empty status", () => {
    expect(nationalShare(big, "APPLICATION ON HOLD", { "APPLICATION ON HOLD": 1833 })).toBeCloseTo(0.99891, 4);
    expect(nationalShare(big, "NORD ISSUED", { "APPLICATION ON HOLD": 1833 })).toBe(0);
  });
});

describe("the dated hold (docs written since Sep 25 2026)", () => {
  const adobe: EmployerStageRow = {
    ...row("Adobe Inc.", 218, { "APPLICATION ON HOLD": 216, "ANALYST REVIEW": 2 }, "adobe-inc"),
    holdSince: "2026-09-24",
    holdSinceCases: 215,
    holdUndated: 1,
    holdBeforeLog: 0,
  };
  const cognizant: EmployerStageRow = { ...big, holdSince: null, holdSinceCases: 0, holdUndated: 1831, holdBeforeLog: 1831 };

  it("parses the dates and the moves, and still reads a doc from before they existed", () => {
    const moves = [{ date: "2026-09-24", name: "Adobe Inc.", slug: "adobe-inc", dir: "on", to: "APPLICATION ON HOLD", n: 215 }];
    const d = parseEmployerStagesDoc(doc({ employers: [cognizant, adobe], logFrom: "2026-08-27", holdMoves: moves, pendingTotal: 2050, nationwide: { "APPLICATION ON HOLD": 2047, "ANALYST REVIEW": 3 } }), 0, 1);
    expect(d?.logFrom).toBe("2026-08-27");
    expect(d?.holdMoves).toHaveLength(1);
    const old = parseEmployerStagesDoc(doc(), 0, 1);
    expect(old?.logFrom).toBeNull();
    expect(old?.holdMoves).toEqual([]);
  });

  it("drops malformed moves without dropping the counts, and rejects a malformed date on a row", () => {
    const d = parseEmployerStagesDoc(doc({ holdMoves: [{ date: "Sep 24", name: "x", slug: null, dir: "on", to: "", n: 1 }] }), 0, 1);
    expect(d?.employers).toHaveLength(4);
    expect(d?.holdMoves).toEqual([]);
    expect(parseEmployerStagesDoc(doc({ employers: [{ ...big, holdSince: "yesterday" }], pendingTotal: 1832, nationwide: { "APPLICATION ON HOLD": 1831, "ANALYST REVIEW": 1 } }), 0, 1)).toBeNull();
  });

  it("dates a hold only with what the record supports", () => {
    expect(holdSincePhrase(adobe, "2026-08-27")).toBe("215 on hold since September 24, 2026; 1 already on hold when first recorded");
    expect(holdSincePhrase(cognizant, "2026-08-27")).toBe("on hold since before August 27, 2026, when this site's record begins");
    // never "since before" the record when the doc does not know when it began
    expect(holdSincePhrase(cognizant, null)).toBe("1,831 already on hold when first recorded");
    expect(holdSincePhrase(mid, "2026-08-27")).toBeNull();
    expect(holdSincePhrase(big, "2026-08-27")).toBeNull();
  });

  it("names where released cases went", () => {
    expect(moveSentence({ date: "2026-09-11", name: "Adobe Inc.", slug: "adobe-inc", dir: "off", to: "ANALYST REVIEW", n: 201 })).toBe("201 cases taken off hold, back to analyst review");
    expect(moveSentence({ date: "2026-09-24", name: "Adobe Inc.", slug: "adobe-inc", dir: "on", to: "APPLICATION ON HOLD", n: 215 })).toBe("215 cases put on hold");
  });
});

describe("decision batches and the keyed move list", () => {
  const hold = { date: "2026-09-24", name: "Adobe Inc.", slug: "adobe-inc", dir: "on" as const, to: "APPLICATION ON HOLD", n: 215 };
  const release = { date: "2026-09-11", name: "Adobe Inc.", slug: "adobe-inc", dir: "off" as const, to: "ANALYST REVIEW", n: 201 };
  const certified = { date: "2026-09-25", name: "Adobe Inc.", slug: "adobe-inc", to: "CERTIFIED" as const, n: 44 };
  const withdrawn = { date: "2026-09-25", name: "Small Co", slug: "small-co", to: "WITHDRAWN" as const, n: 12 };

  it("parses decisionMoves, and drops the list rather than the doc when one is malformed", () => {
    const ok = parseEmployerStagesDoc(doc({ decisionMoves: [certified] }), 1_000, 2_000);
    expect(ok?.decisionMoves).toEqual([certified]);
    const bad = parseEmployerStagesDoc(doc({ decisionMoves: [{ ...certified, to: "CERTIFIED - EXPIRED" }] }), 1_000, 2_000);
    expect(bad?.decisionMoves).toEqual([]);
    expect(bad?.employers).toHaveLength(4);
    expect(parseEmployerStagesDoc(doc(), 1_000, 2_000)?.decisionMoves).toEqual([]);
  });

  it("names who acted: DOL decides and holds, the employer withdraws", () => {
    expect(decisionSentence(certified)).toBe("DOL certified 44 of its cases");
    expect(decisionSentence({ ...certified, to: "DENIED", n: 1 })).toBe("DOL denied 1 of its cases");
    expect(decisionSentence(withdrawn)).toBe("12 of its cases were withdrawn by the employer");
    expect(decisionSentence(withdrawn)).not.toMatch(/^DOL/);
    expect(holdSentence(hold)).toBe("DOL put 215 of its cases on hold");
    expect(holdSentence(release)).toBe("DOL took 201 of its cases off hold, back to analyst review");
    expect(holdSentence({ ...release, to: "CERTIFIED", n: 6 })).toBe("DOL took 6 of its cases off hold and certified them");
    expect(holdSentence({ ...release, to: "WITHDRAWN", n: 5 })).not.toMatch(/^DOL/);
  });

  it("keys each group once and lists newest first", () => {
    const moves = employerMoves({ holdMoves: [release, hold], decisionMoves: [certified] });
    expect(moves.map((m) => m.key)).toEqual([
      "2026-09-25|decided|CERTIFIED",
      "2026-09-24|hold-on|APPLICATION ON HOLD",
      "2026-09-11|hold-off|ANALYST REVIEW",
    ]);
    expect(moves.map((m) => m.tone)).toEqual(["good", "bad", "neutral"]);
    expect(new Set(moves.map((m) => m.key)).size).toBe(moves.length);
  });
});
