import { describe, expect, it } from "vitest";

import { ORDINARY_QUEUE, type StatusCount } from "@/lib/liveQueue";
import {
  STAGE_META,
  STAGE_ORDER,
  groupByStage,
  prettyStatus,
  stageOf,
} from "../stages";

/**
 * The three-queue taxonomy, against DOL's real status list.
 *
 * The list below is every `current_status` present in the live mirror on
 * 2026-08-27, with DOL's own `is_final` flag beside it. Pinning it in a test
 * is the point: a status arriving or changing sides is a real event that
 * should break a test rather than quietly reshape a published census.
 */

const LIVE_STATUSES: ReadonlyArray<readonly [string, 0 | 1]> = [
  ["CERTIFIED", 1],
  ["ANALYST REVIEW", 0],
  ["CERTIFIED - EXPIRED", 1],
  ["WITHDRAWN", 1],
  ["DENIED", 1],
  ["APPLICATION ON HOLD", 0],
  ["RFI ISSUED", 0],
  ["RECONSIDERATION APPEALS", 0],
  ["BALCA APPEALS", 0],
  ["NORD ISSUED", 0],
  ["IN PROCESS", 0],
  ["DETERMINATION ISSUED", 0],
  ["REQUEST FOR REVIEW", 0],
  ["SUPERVISED RECRUITMENT", 0],
  ["PENDING AUDIT RESPONSE", 0],
  ["DENIED - BALCA DISMISSED", 0],
];

const counts = (
  entries: ReadonlyArray<readonly [string, 0 | 1, number]>,
): StatusCount[] =>
  entries.map(([status, isFinal, count]) => ({
    status,
    count,
    isFinal: isFinal === 1,
  }));

describe("stageOf", () => {
  it("puts the ordinary queue in analyst review and nothing else", () => {
    expect(stageOf(ORDINARY_QUEUE, ORDINARY_QUEUE)).toBe("analyst");
    for (const [status] of LIVE_STATUSES) {
      if (status === ORDINARY_QUEUE) continue;
      expect(stageOf(status, ORDINARY_QUEUE)).not.toBe("analyst");
    }
  });

  it("puts every post-determination status under appeal", () => {
    for (const status of [
      "BALCA APPEALS",
      "RECONSIDERATION APPEALS",
      "REQUEST FOR REVIEW",
      "DENIED - BALCA DISMISSED",
    ]) {
      expect(stageOf(status, ORDINARY_QUEUE)).toBe("appeal");
    }
  });

  it("puts everything DOL pulls off the ordinary queue in the held group", () => {
    for (const status of [
      "RFI ISSUED",
      "APPLICATION ON HOLD",
      "NORD ISSUED",
      "IN PROCESS",
      "DETERMINATION ISSUED",
      "SUPERVISED RECRUITMENT",
      "PENDING AUDIT RESPONSE",
    ]) {
      expect(stageOf(status, ORDINARY_QUEUE)).toBe("held");
    }
  });

  it("sends an unrecognised status to held, not to appeals and not nowhere", () => {
    // DOL's status list went from 15 to 16 during this surface's own build.
    // The neutral middle group is the only safe landing place for a new one:
    // calling it an appeal would be a claim, and dropping it would understate
    // the backlog.
    expect(stageOf("SOMETHING DOL ADDS IN 2027", ORDINARY_QUEUE)).toBe("held");
    expect(stageOf("", ORDINARY_QUEUE)).toBe("held");
  });

  it("normalises case and surrounding space before deciding", () => {
    expect(stageOf("  analyst review  ", ORDINARY_QUEUE)).toBe("analyst");
    expect(stageOf("balca appeals", ORDINARY_QUEUE)).toBe("appeal");
  });
});

describe("groupByStage", () => {
  const cohort = counts([
    ["ANALYST REVIEW", 0, 1765],
    ["RFI ISSUED", 0, 324],
    ["BALCA APPEALS", 0, 3],
    ["RECONSIDERATION APPEALS", 0, 1],
    ["CERTIFIED", 1, 10655],
    ["WITHDRAWN", 1, 513],
    ["DENIED", 1, 103],
  ]);

  it("accounts for every case exactly once", () => {
    const split = groupByStage(cohort);
    const staged = split.stages.reduce((n, s) => n + s.count, 0);
    const decided = split.decided.reduce((n, s) => n + s.count, 0);
    expect(staged).toBe(split.pending);
    expect(staged + decided).toBe(split.total);
    expect(split.total).toBe(cohort.reduce((n, c) => n + c.count, 0));
  });

  it("splits the pending side across the three queues as measured", () => {
    const split = groupByStage(cohort);
    const by = Object.fromEntries(split.stages.map((s) => [s.stage, s.count]));
    expect(by).toEqual({ analyst: 1765, held: 324, appeal: 4 });
  });

  it("keeps all three stages even when one is empty", () => {
    // A legend whose length changes month to month has to be re-read every
    // time, and "0 under appeal" is a real and reassuring answer.
    const split = groupByStage(counts([["ANALYST REVIEW", 0, 5]]));
    expect(split.stages.map((s) => s.stage)).toEqual([...STAGE_ORDER]);
    expect(split.stages.map((s) => s.count)).toEqual([5, 0, 0]);
  });

  it("orders the statuses inside a stage largest first", () => {
    const split = groupByStage(
      counts([
        ["RFI ISSUED", 0, 4],
        ["APPLICATION ON HOLD", 0, 90],
        ["NORD ISSUED", 0, 17],
      ]),
    );
    const held = split.stages.find((s) => s.stage === "held");
    expect(held?.statuses.map((s) => s.status)).toEqual([
      "APPLICATION ON HOLD",
      "NORD ISSUED",
      "RFI ISSUED",
    ]);
  });

  it("never files a decided case into a queue", () => {
    const split = groupByStage(
      counts([
        ["CERTIFIED", 1, 100],
        ["CERTIFIED - EXPIRED", 1, 20],
      ]),
    );
    expect(split.pending).toBe(0);
    expect(split.stages.every((s) => s.count === 0)).toBe(true);
    expect(split.decided.reduce((n, s) => n + s.count, 0)).toBe(120);
  });

  it("returns an empty but well-formed split for an empty cohort", () => {
    const split = groupByStage([]);
    expect(split.total).toBe(0);
    expect(split.pending).toBe(0);
    expect(split.stages).toHaveLength(3);
  });
});

describe("STAGE_META", () => {
  it("gives each stage its own fill, so no two are one hue at two opacities", () => {
    const fills = STAGE_ORDER.map((s) => STAGE_META[s].fill);
    expect(new Set(fills).size).toBe(fills.length);
    expect(fills.some((f) => f.includes("/"))).toBe(false);
  });

  it("gives each stage its own words, so two shapes cannot share one caption", () => {
    const labels = STAGE_ORDER.map((s) => STAGE_META[s].label);
    const glosses = STAGE_ORDER.map((s) => STAGE_META[s].gloss);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(glosses).size).toBe(glosses.length);
  });

  it("writes its labels and glosses in house voice", () => {
    for (const stage of STAGE_ORDER) {
      const { label, gloss } = STAGE_META[stage];
      expect(label).not.toMatch(/[—–]/);
      expect(gloss).not.toMatch(/[—–]/);
      expect(label[0]).toBe(label[0]?.toUpperCase());
    }
  });
});

describe("prettyStatus", () => {
  it("title-cases without turning an acronym into a typo", () => {
    expect(prettyStatus("RFI ISSUED")).toBe("RFI Issued");
    expect(prettyStatus("NORD ISSUED")).toBe("NORD Issued");
    expect(prettyStatus("BALCA APPEALS")).toBe("BALCA Appeals");
    expect(prettyStatus("DENIED - BALCA DISMISSED")).toBe("Denied - BALCA Dismissed");
  });

  it("leaves an ordinary status readable", () => {
    expect(prettyStatus("ANALYST REVIEW")).toBe("Analyst Review");
    expect(prettyStatus("CERTIFIED - EXPIRED")).toBe("Certified - Expired");
  });

  it("handles every status the mirror actually holds without throwing", () => {
    for (const [status] of LIVE_STATUSES) {
      expect(prettyStatus(status).length).toBeGreaterThan(0);
    }
  });
});
