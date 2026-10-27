import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  agendaActive,
  agendaNote,
  buildTrack,
  isActiveRule,
  isAgendaOnly,
  isFinalOnly,
  lastMoved,
  parseAgendaDetail,
  RULE_STEP_KINDS,
  ruleTitle,
  shownInPipeline,
  standing,
  stepSentence,
  stepsBetween,
  type RuleRecord,
} from "./ruleSteps";

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
      "agenda:unrecorded", "review:done", "cleared:done", "inspection:next", "published:ahead", "comments:ahead", "final:ahead",
    ]);
    expect(t[1]?.date).toBe("2026-09-14");
    expect(t[2]?.date).toBe("2026-10-23");
    expect(t[2]?.note).toBe('OIRA\'s decision: "Consistent with Change"');
  });

  it("an open comment period is upcoming, with the days left", () => {
    const r = { ...AC29, piType: "Proposed Rule", piFiled: "2026-10-28", proposedPublished: "2026-10-29", commentsClose: "2026-12-28" };
    const t = buildTrack(r, "2026-11-01");
    expect(t.map((s) => s.state)).toEqual(["unrecorded", "done", "done", "done", "done", "upcoming", "next"]);
    expect(t[5]?.note).toBe("57 days left");
  });

  it("a rule known only from the Register has its earlier steps unrecorded, never invented", () => {
    const r = { ...EMPTY, rin: "1205-AC30", proposedPublished: "2026-03-27", commentsClose: "2026-05-26" };
    expect(states(r, "2026-10-27")).toEqual([
      "agenda:unrecorded", "review:unrecorded", "cleared:unrecorded", "inspection:unrecorded", "published:done", "comments:done", "final:next",
    ]);
  });

  it("the final rule's review shows on the last step, never on the proposal's", () => {
    const r = { ...AC29, proposedPublished: "2026-10-29", commentsClose: "2026-12-28", fStage: "Final Rule", fReceived: "2027-05-03" };
    const t = buildTrack(r, "2027-05-10");
    expect(t[1]?.date).toBe("2026-09-14");
    expect(t[6]?.state).toBe("next");
    expect(t[6]?.note).toBe("The final rule has been at OIRA since May 3, 2027");
  });

  it("a rule first met as a final rule reads as one", () => {
    const r = { ...EMPTY, rin: "1615-AD99", fStage: "Interim Final Rule", fReceived: "2026-10-01", fCompleted: "2026-10-20", fDecision: "Consistent without Change" };
    expect(isFinalOnly(r)).toBe(true);
    const t = buildTrack(r, "2026-10-27");
    expect(t.map((s) => s.label)).toEqual([
      "Listed in the Unified Agenda", "In review at OIRA", "Review done", "On public inspection", "Published as a final rule", "Comments close", "Takes effect",
    ]);
    expect(t.map((s) => s.state)).toEqual(["unrecorded", "done", "done", "next", "ahead", "unrecorded", "ahead"]);
  });

  it("a withdrawn review stops the track", () => {
    const r = { ...AC29, pDecision: "Withdrawn" };
    expect(states(r, "2026-10-27")).toEqual([
      "agenda:unrecorded", "review:done", "cleared:done", "inspection:ahead", "published:ahead", "comments:ahead", "final:ahead",
    ]);
    expect(buildTrack(r, "2026-10-27")[2]?.label).toBe("Withdrawn from review");
  });
});

/** 1205-AC29 as the 2026 Unified Agenda (run Jul 3 2026) lists it. */
const LISTED: Partial<RuleRecord> = {
  aPubId: "202510",
  aEdition: "2026",
  aPublished: "2026-07-03",
  aAgency: "DOL/ETA",
  aStage: "Proposed Rule Stage",
  aPriority: "Other Significant",
  aNextAction: "NPRM",
  aNextDate: "07/00/2026",
  aUrl: "https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202510&RIN=1205-AC29",
  aListed: "2026-07-03",
  aOnCurrent: true,
};

describe("the agenda step", () => {
  it("comes first, names the edition, and quotes the agency's own timetable", () => {
    const t = buildTrack({ ...AC29, ...LISTED }, "2026-10-27");
    expect(t[0]).toMatchObject({
      key: "agenda",
      label: "Listed in the Unified Agenda",
      date: "2026-07-03",
      shown: "2026 agenda",
      state: "done",
      note: "DOL's 2026 agenda lists the proposal for July 2026",
    });
    expect(t.map((s) => s.state)).toEqual(["done", "done", "done", "next", "ahead", "ahead", "ahead"]);
  });

  it("a rule only the agenda knows has review at OIRA next", () => {
    const r = { ...EMPTY, rin: "1615-AD00", title: "Reforming the H-1B Nonimmigrant Visa Classification Program", ...LISTED, aNextDate: "08/00/2026" };
    expect(isAgendaOnly(r)).toBe(true);
    expect(states(r, "2026-10-27")).toEqual([
      "agenda:done", "review:next", "cleared:ahead", "inspection:ahead", "published:ahead", "comments:ahead", "final:ahead",
    ]);
    expect(standing(r, "2026-10-27")).toBe("USCIS's 2026 agenda lists the proposal for August 2026. Not at OIRA on this record.");
    expect(isAgendaOnly({ ...r, pReceived: "2026-08-24" })).toBe(false);
  });

  it("words every kind of next step as the agency printed it", () => {
    const note = (p: Partial<RuleRecord>, rin = "1615-AC67") => agendaNote({ ...EMPTY, rin, ...LISTED, ...p });
    expect(note({ aNextAction: "Interim Final Rule", aNextDate: "09/00/2026" })).toBe("USCIS's 2026 agenda lists an interim final rule for September 2026");
    expect(note({ aNextAction: "Final Action", aNextDate: "09/15/2026" })).toBe("USCIS's 2026 agenda lists the final rule for Sep 15, 2026");
    expect(note({ aNextAction: "NPRM", aNextDate: "To Be Determined" })).toBe("USCIS's 2026 agenda lists the proposal, with the date to be determined");
    expect(note({ aNextAction: "Next Action Undetermined", aNextDate: "To Be Determined" }, "1651-AB37")).toBe("CBP's 2026 agenda lists its next action as undetermined");
    expect(note({ aNextAction: null, aNextDate: null, aStage: "Final Rule Stage" }, "1615-AD02")).toBe("USCIS's 2026 agenda lists it at the final rule stage, with no next action");
    expect(note({ aNextAction: "Notice", aNextDate: "10/00/2026" }, "1400-AF23")).toBe('The State Department\'s 2026 agenda lists its next action, "Notice", for October 2026');
    expect(note({ aOnCurrent: false })).toBe("USCIS's 2026 agenda listed the proposal for July 2026. The newest agenda doesn't list it");
    expect(agendaNote(AC29)).toBeNull();
  });

  it("is a step sentence the evening check and anyone reading the log can use", () => {
    const detail = JSON.stringify({ action: "NPRM", date: "07/00/2026", edition: "2026", stage: "Proposed Rule Stage" });
    expect(stepSentence({ kind: "agenda", onDate: "2026-07-03", detail }, AC29)).toBe(
      'DOL\'s 2026 Unified Agenda lists the proposal "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program" for July 2026.',
    );
    const none = JSON.stringify({ action: null, date: null, edition: "Spring 2027", stage: "Final Rule Stage" });
    expect(stepSentence({ kind: "agenda", onDate: "2027-04-01", detail: none }, { ...AC29, rin: "1615-AD02", title: "Improving Continuity" })).toBe(
      'USCIS\'s Spring 2027 Unified Agenda lists "Improving Continuity" at the final rule stage, with no next action.',
    );
    expect(parseAgendaDetail("not json")).toBeNull();
    expect(stepSentence({ kind: "agenda", onDate: "2026-07-03", detail: null }, AC29)).toBe(
      'DOL\'s Unified Agenda lists "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program".',
    );
  });

  it("stays out of the digest's step list, which a new edition would flood", () => {
    expect(RULE_STEP_KINDS).not.toContain("agenda");
  });

  it("moves a rule only when its listing changed", () => {
    expect(lastMoved({ ...EMPTY, rin: "x", ...LISTED })).toBe("2026-07-03");
    // Relisted unchanged in a later edition: the edition moved, the rule didn't.
    expect(lastMoved({ ...EMPTY, rin: "x", ...LISTED, aPublished: "2026-12-10", aEdition: "Spring 2027" })).toBe("2026-07-03");
  });

  it("is still on its way at an active stage, or long-term with a next action", () => {
    expect(agendaActive({ aStage: "Final Rule Stage", aNextAction: null })).toBe(true);
    expect(agendaActive({ aStage: "Long-Term Actions", aNextAction: "NPRM" })).toBe(true);
    expect(agendaActive({ aStage: "Long-Term Actions", aNextAction: "Next Action Undetermined" })).toBe(false);
    expect(agendaActive({ aStage: "Completed Actions", aNextAction: null })).toBe(false);
  });
});

describe("which rules the page shows", () => {
  const today = "2026-10-27";
  it("a rule not final, or final in the last 90 days", () => {
    expect(shownInPipeline(AC29, today, 90)).toBe(true);
    expect(shownInPipeline({ ...AC29, finalPublished: "2026-09-30" }, today, 90)).toBe(true);
    expect(shownInPipeline({ ...AC29, finalPublished: "2026-07-20" }, today, 90)).toBe(false);
  });
  it("an interim final rule from years ago while the newest agenda after it lists the final rule", () => {
    const ifr = { ...EMPTY, rin: "1615-AC67", finalPublished: "2022-03-29", ...LISTED, aStage: "Final Rule Stage", aNextAction: "Interim Final Rule", aNextDate: "09/00/2026" };
    expect(shownInPipeline(ifr, today, 90)).toBe(true);
    expect(standing(ifr, today)).toBe("Final rule published Mar 29, 2022. USCIS's 2026 agenda lists an interim final rule for September 2026.");
    // A final rule after the agenda that listed it: finished, whatever the agenda said.
    expect(shownInPipeline({ ...ifr, finalPublished: "2026-07-20" }, today, 90)).toBe(false);
    expect(shownInPipeline({ ...ifr, aOnCurrent: false }, today, 90)).toBe(false);
  });
  it("a rule only the agenda knows while the newest agenda lists it", () => {
    const only = { ...EMPTY, rin: "1615-AD13", ...LISTED };
    expect(shownInPipeline(only, today, 90)).toBe(true);
    expect(shownInPipeline({ ...only, aOnCurrent: false }, today, 90)).toBe(false);
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

describe("the agenda step's words, shared", () => {
  // The ingest writes the detail (agenda_detail) and test_rule_pipeline.py
  // holds it to this file's first case; a Python wording can read the cases too.
  const fx = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/rule_pipeline/agenda_sentences.json"), "utf8")) as {
    cases: { rule: { rin: string; title: string }; event: { kind: "agenda"; onDate: string; detail: string }; sentence: string }[];
  };
  it.each(fx.cases.map((c) => [c.rule.rin, c] as const))("%s", (_rin, c) => {
    expect(stepSentence(c.event, { ...c.rule, agency: null, commentsClose: null, effectiveOn: null })).toBe(c.sentence);
  });
  it("read the cases", () => {
    expect(fx.cases.length).toBeGreaterThan(5);
  });
});

describe("which rules get a full card", () => {
  const today = "2026-10-27";
  it("one at OIRA, on public inspection, open for comment, or taking effect", () => {
    expect(isActiveRule({ ...EMPTY, rin: "1615-AD25", pReceived: "2025-01-02" }, today)).toBe(true);
    expect(isActiveRule({ ...EMPTY, rin: "x", piType: "Proposed Rule", piFiled: "2025-01-02" }, today)).toBe(true);
    expect(isActiveRule({ ...EMPTY, rin: "x", proposedPublished: "2025-01-02", commentsClose: "2026-10-27" }, today)).toBe(true);
    expect(isActiveRule({ ...EMPTY, rin: "x", finalPublished: "2025-01-02", effectiveOn: "2026-10-28" }, today)).toBe(true);
  });
  it("one with a step in the last 90 days, and not one whose newest step is older", () => {
    expect(isActiveRule({ ...AC29 }, today)).toBe(true); // cleared OIRA Oct 23
    expect(isActiveRule({ ...EMPTY, rin: "x", proposedPublished: "2026-07-29" }, today)).toBe(true); // day 90
    expect(isActiveRule({ ...EMPTY, rin: "x", proposedPublished: "2026-07-28", commentsClose: "2026-08-27" }, today)).toBe(false);
    // A filing published since, a review finished, a final rule in effect: nothing under way.
    expect(isActiveRule({ ...EMPTY, rin: "x", piType: "Proposed Rule", piFiled: "2025-01-02", proposedPublished: "2025-01-03" }, today)).toBe(false);
    expect(isActiveRule({ ...EMPTY, rin: "x", pReceived: "2025-01-02", pCompleted: "2025-02-02" }, today)).toBe(false);
    expect(isActiveRule({ ...EMPTY, rin: "x", finalPublished: "2025-01-02", effectiveOn: "2025-03-01" }, today)).toBe(false);
  });
  it("never for the agenda alone: an edition relists rules that haven't moved", () => {
    expect(isActiveRule({ ...EMPTY, rin: "x", ...LISTED, aPublished: "2026-10-20", aListed: "2026-10-20" }, today)).toBe(false);
  });
});
