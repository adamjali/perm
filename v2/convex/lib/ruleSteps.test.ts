import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildTrack, isFinalOnly, lastMoved, ruleTitle, standing, stepSentence, stepsBetween, type RuleRecord } from "./ruleSteps";

const EMPTY: RuleRecord = {
  rin: "",
  agency: null,
  title: null,
  pStage: null,
  pReceived: null,
  pCompleted: null,
  pDecision: null,
  fStage: null,
  fReceived: null,
  fCompleted: null,
  fDecision: null,
  major: null,
  piDocument: null,
  piType: null,
  piFiled: null,
  piScheduled: null,
  piUrl: null,
  proposedDocument: null,
  proposedPublished: null,
  proposedUrl: null,
  proposedCitation: null,
  commentsClose: null,
  finalDocument: null,
  finalPublished: null,
  finalUrl: null,
  finalCitation: null,
  effectiveOn: null,
};

/** RIN 1205-AC29 as OIRA's completed list printed it on Oct 27 2026. */
const AC29: RuleRecord = {
  ...EMPTY,
  rin: "1205-AC29",
  agency: "DOL's Employment and Training Administration",
  title: "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program (NPRM)",
  pStage: "Proposed Rule",
  pReceived: "2026-09-14",
  pCompleted: "2026-10-23",
  pDecision: "Consistent with Change",
  major: "Yes",
};

const states = (r: RuleRecord, today: string) => buildTrack(r, today).map((s) => `${s.key}:${s.state}`);

describe("the track", () => {
  it("1205-AC29 on Oct 27: two steps done, public inspection next", () => {
    const t = buildTrack(AC29, "2026-10-27");
    expect(t.map((s) => `${s.key}:${s.state}`)).toEqual([
      "review:done", "cleared:done", "inspection:next", "published:ahead", "comments:ahead", "final:ahead",
    ]);
    expect(t[0]?.date).toBe("2026-09-14");
    expect(t[1]?.date).toBe("2026-10-23");
    expect(t[1]?.note).toBe('OIRA\'s decision: "Consistent with Change"');
  });

  it("an open comment period is upcoming, with the days left", () => {
    const r = { ...AC29, piType: "Proposed Rule", piFiled: "2026-10-28", proposedPublished: "2026-10-29", commentsClose: "2026-12-28" };
    const t = buildTrack(r, "2026-11-01");
    expect(t.map((s) => s.state)).toEqual(["done", "done", "done", "done", "upcoming", "next"]);
    expect(t[4]?.note).toBe("57 days left");
  });

  it("a rule known only from the Register has its earlier steps unrecorded, never invented", () => {
    const r = { ...EMPTY, rin: "1205-AC30", proposedPublished: "2026-03-27", commentsClose: "2026-05-26" };
    expect(states(r, "2026-10-27")).toEqual([
      "review:unrecorded", "cleared:unrecorded", "inspection:unrecorded", "published:done", "comments:done", "final:next",
    ]);
  });

  it("the final rule's review shows on the last step, never on the proposal's", () => {
    const r = { ...AC29, proposedPublished: "2026-10-29", commentsClose: "2026-12-28", fStage: "Final Rule", fReceived: "2027-05-03" };
    const t = buildTrack(r, "2027-05-10");
    expect(t[0]?.date).toBe("2026-09-14");
    expect(t[5]?.state).toBe("next");
    expect(t[5]?.note).toBe("The final rule has been at OIRA since May 3, 2027");
  });

  it("a rule first met as a final rule reads as one", () => {
    const r = { ...EMPTY, rin: "1615-AD99", fStage: "Interim Final Rule", fReceived: "2026-10-01", fCompleted: "2026-10-20", fDecision: "Consistent without Change" };
    expect(isFinalOnly(r)).toBe(true);
    const t = buildTrack(r, "2026-10-27");
    expect(t.map((s) => s.label)).toEqual([
      "In review at OIRA", "Review done", "On public inspection", "Published as a final rule", "Comments close", "Takes effect",
    ]);
    expect(t.map((s) => s.state)).toEqual(["done", "done", "next", "ahead", "unrecorded", "ahead"]);
  });

  it("a withdrawn review stops the track", () => {
    const r = { ...AC29, pDecision: "Withdrawn" };
    expect(states(r, "2026-10-27")).toEqual([
      "review:done", "cleared:done", "inspection:ahead", "published:ahead", "comments:ahead", "final:ahead",
    ]);
    expect(buildTrack(r, "2026-10-27")[1]?.label).toBe("Withdrawn from review");
  });
});

describe("where a rule stands", () => {
  it("says what happened and what hasn't", () => {
    expect(standing(AC29, "2026-10-27")).toBe(
      'OIRA finished its review on Oct 23, 2026: "Consistent with Change". Not yet in the Federal Register.',
    );
    expect(standing({ ...EMPTY, rin: "1615-AD25", pReceived: "2026-10-13" }, "2026-10-27")).toBe(
      "At OIRA since Oct 13, 2026, 14 days so far.",
    );
    expect(standing({ ...AC29, proposedPublished: "2026-10-29", commentsClose: "2026-12-28" }, "2026-12-27")).toBe(
      "Proposed Oct 29, 2026. Comments close Dec 28, 2026, 1 day left.",
    );
    expect(standing({ ...AC29, finalPublished: "2027-08-02", effectiveOn: "2027-10-01" }, "2027-08-03")).toBe(
      "Final rule published Aug 2, 2027; it takes effect Oct 1, 2027.",
    );
  });

  it("orders rules by their newest step", () => {
    expect(lastMoved(AC29)).toBe("2026-10-23");
    expect(lastMoved({ ...AC29, piFiled: "2026-10-28" })).toBe("2026-10-28");
  });
});

describe("the step sentences", () => {
  it("names who acted, the title without OIRA's stage tag, and OIRA's decision verbatim", () => {
    expect(ruleTitle(AC29)).toBe("Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program");
    expect(stepSentence({ kind: "oira-completed", onDate: "2026-10-23", detail: "Consistent with Change" }, AC29)).toBe(
      'OIRA finished its review of "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program" on Oct 23, 2026. Its decision: "Consistent with Change".',
    );
    expect(stepSentence({ kind: "oira-received", onDate: "2026-10-13", detail: "Proposed Rule" }, { ...EMPTY, rin: "1615-AD25", agency: "USCIS", title: "Amending the Premium Processing Timeframe" })).toBe(
      'USCIS sent "Amending the Premium Processing Timeframe" to OIRA for review on Oct 13, 2026 (proposed rule).',
    );
    expect(stepSentence({ kind: "proposed-published", onDate: "2026-10-29", detail: null }, { ...AC29, commentsClose: "2026-12-28" })).toMatch(
      /was published as a proposed rule on Oct 29, 2026; comments close Dec 28, 2026\.$/,
    );
  });

  it("the week's moves are the steps dated inside it, newest first", () => {
    const ev = [
      { rin: "a", kind: "oira-received" as const, onDate: "2026-09-14", detail: null },
      { rin: "a", kind: "oira-completed" as const, onDate: "2026-10-23", detail: "Consistent with Change" },
      { rin: "b", kind: "oira-received" as const, onDate: "2026-10-27", detail: null },
    ];
    expect(stepsBetween(ev, "2026-10-20", "2026-10-27").map((e) => e.onDate)).toEqual(["2026-10-27", "2026-10-23"]);
  });
});

describe("the same words as the evening check", () => {
  // scripts/lib_newsworthy.py words a step for the owner's email; this file
  // and its Python test both read the cases, so the two can't drift apart.
  const fx = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/rule_step_sentences.json"), "utf8")) as {
    rule: Pick<RuleRecord, "rin" | "title" | "agency" | "commentsClose" | "effectiveOn">;
    cases: { rule?: Pick<RuleRecord, "rin" | "title" | "agency" | "commentsClose" | "effectiveOn">; event: { kind: never; onDate: string; detail: string | null }; sentence: string }[];
  };
  it.each(fx.cases.map((c) => [c.event.kind, c.event.detail, c] as const))("%s (%s)", (_k, _d, c) => {
    expect(stepSentence(c.event, c.rule ?? fx.rule)).toBe(c.sentence);
  });
  it("read the cases", () => {
    expect(fx.cases.length).toBeGreaterThan(5);
  });
});
