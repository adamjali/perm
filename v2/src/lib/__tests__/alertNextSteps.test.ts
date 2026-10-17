import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { decidedOnFromSeen, SEEN_NEXT_MORNING_BEFORE_HOUR as SCORE_HOUR } from "@/lib/scorecard/score";
import { programOf } from "@/lib/flagCaseNumber";
import {
  alsoLinksFor,
  bulletinAlertUrl,
  confirmOffers,
  dayDolActed,
  filingDayOnRecord,
  i140DueBy,
  NEXT_PATHS,
  nextStepsFor,
  nextStepsText,
  PWD_MATCH_SENTENCE,
  SEEN_NEXT_MORNING_BEFORE_HOUR,
  type NextStepInput,
} from "@convex/lib/alertNextSteps";
import { ETA9089_EXPIRATION_DAYS } from "@convex/lib/perm/constants";

/**
 * The "what comes next" block on final case alerts and the offers on the
 * confirmation pages (convex/lib/alertNextSteps.ts): every link goes to a page
 * that exists, no deadline is typed, and a wage request for an H-1B job is
 * never told about a PERM.
 */

const ROOT = process.cwd();

/** The file a public path is served from, route groups included. */
function pageFor(path: string): string | null {
  const parts = path.split(/[?#]/)[0]!.split("/").filter(Boolean);
  if (parts[0] === "guides" && parts.length === 2) {
    const mdx = join(ROOT, "content/guides", `${parts[1]}.mdx`);
    return existsSync(mdx) ? mdx : null;
  }
  const page = join(ROOT, "src/app/(site)/(public)", ...parts, "page.tsx");
  return existsSync(page) ? page : null;
}

const base: NextStepInput = {
  program: "perm",
  caseNumber: "G-100-26070-123456",
  status: "CERTIFIED",
  isFinal: true,
  approved: true,
  priorityDate: "2026-03-11",
  certifiedOn: "2026-10-15",
  employerName: "Example Systems, Inc.",
  jobTitle: "Software Engineer",
};

function words(n: ReturnType<typeof nextStepsFor>): string {
  return n ? nextStepsText(n).join("\n") : "";
}

describe("what comes next after a case alert", () => {
  it("links only to pages that exist, and to anchors those pages carry", () => {
    for (const path of Object.values(NEXT_PATHS)) {
      expect(pageFor(path), path).not.toBeNull();
    }
    const anchors: Array<[string, string]> = [
      [NEXT_PATHS.bulletinAlert, 'id="bulletin-alert"'],
      [NEXT_PATHS.queueAlert, 'id="queue-alert"'],
      [NEXT_PATHS.rfiSteps, 'id="step-by-step"'],
    ];
    for (const [path, id] of anchors) {
      expect(readFileSync(pageFor(path)!, "utf8"), `${path} carries ${id}`).toContain(id);
    }
  });

  it("dates the I-140 from the central calculator, never a typed number", () => {
    expect(ETA9089_EXPIRATION_DAYS).toBe(179);
    expect(i140DueBy("2026-10-15")).toBe("2027-04-12");
    expect(i140DueBy("not a date")).toBeNull();
    const text = words(nextStepsFor(base));
    expect(text).toContain("about April 12, 2027");
    expect(text).toContain("the expiration DOL printed on the certification");
  });

  it("names the priority date from DOL's record and offers the bulletin alert for it", () => {
    const next = nextStepsFor(base)!;
    expect(words(next)).toContain("March 11, 2026");
    expect(next.button?.href).toBe("https://permtracker.app/visa-bulletin?pd=2026-03-11#bulletin-alert");
    expect(bulletinAlertUrl("2026-3-1")).toBe("https://permtracker.app/visa-bulletin#bulletin-alert");
    const hrefs = next.links.map((l) => l.href);
    expect(hrefs[0]).toBe("https://permtracker.app/guides/perm-certified-what-next");
    expect(hrefs).toContain("https://permtracker.app/tools/green-card-line");
    expect(hrefs).toContain("https://permtracker.app/uscis-processing-times");
  });

  it("still says what's next without the certification day or the filing day", () => {
    const text = words(nextStepsFor({ ...base, certifiedOn: null, priorityDate: null }));
    expect(text).not.toContain("about");
    expect(text).toContain("It's this case's PERM filing date, and the I-140 carries it.");
  });

  it("gives a denial its two 30-day options and says we keep watching", () => {
    const text = words(nextStepsFor({ ...base, status: "DENIED", approved: false }));
    expect(text).toContain("30 days");
    expect(text).toContain("RECONSIDERATION APPEALS or BALCA APPEALS");
    expect(text).toContain("/guides/perm-denied-what-happens-next");
    const board = words(nextStepsFor({ ...base, status: "DENIED - BALCA AFFIRMED", approved: false }));
    expect(board).toContain("last step at DOL");
    expect(board).not.toContain("30 days");
  });

  it("tells a PERM job's wage request about recruitment, the PERM and the match", () => {
    const pwd = { ...base, program: "pwd" as const, caseNumber: "P-100-26118-846661", status: "DETERMINATION ISSUED" };
    const text = words(nextStepsFor(pwd));
    expect(text).toContain("start recruitment, or file the PERM application");
    expect(text).toContain("a PERM application from Example Systems, Inc. for Software Engineer");
    expect(text).toContain("may be yours");
    expect(text).toContain("/tools/perm-deadline-calculator");
    expect(text).toContain("/tools/perm-timeline-calculator#queue-alert");
  });

  it("never tells an H-1B or E-3 job's wage request about a PERM", () => {
    for (const caseNumber of ["P-200-26118-846661", "P-203-26118-846661"]) {
      const text = words(nextStepsFor({ ...base, program: "pwd", caseNumber, status: "DETERMINATION ISSUED" }));
      expect(text).toContain("the LCA");
      expect(text).not.toContain("PERM");
    }
  });

  it("points a certified LCA at the visa filing, and is honest about the USCIS page", () => {
    const h1b = words(nextStepsFor({ ...base, program: "lca", caseNumber: "I-200-26118-846661" }));
    expect(h1b).toContain("Form I-129");
    expect(h1b).toContain("can't show the status itself yet");
    expect(h1b).toContain("prevailing wage request");
    const e3 = words(nextStepsFor({ ...base, program: "lca", caseNumber: "I-203-26118-846661" }));
    expect(e3).toContain("The E-3 visa");
  });

  it("adds nothing it can't stand behind", () => {
    expect(nextStepsFor({ ...base, status: "WITHDRAWN", approved: false })).toBeNull();
    expect(nextStepsFor({ ...base, status: "RFI ISSUED", isFinal: false, approved: false })).toBeNull();
    expect(
      nextStepsFor({ ...base, program: "seasonal", caseNumber: "H-300-26118-846661", status: "FULL CERTIFICATION" }),
    ).toBeNull();
    expect(
      nextStepsFor({ ...base, program: "lca", caseNumber: "I-200-26118-846661", status: "WITHDRAWN", approved: false }),
    ).toBeNull();
  });

  it("names DOL's PERM queue only to someone still waiting in it", () => {
    const queue = "https://permtracker.app/perm-processing-times";
    const hrefs = (i: Parameters<typeof alsoLinksFor>[0]) => alsoLinksFor(i).map((l) => l.href);
    expect(hrefs({ program: "perm", status: "ANALYST REVIEW", isFinal: false })).toContain(queue);
    expect(hrefs({ program: "perm", status: "CERTIFIED", isFinal: true })).not.toContain(queue);
    expect(hrefs({ program: "pwd", status: "DETERMINATION ISSUED", isFinal: true })).not.toContain(queue);
    expect(hrefs({ program: "lca", status: "IN PROCESS", isFinal: false })).not.toContain(queue);
    expect(hrefs({ program: "pwd", status: "IN PROCESS", isFinal: false })).toContain(queue);
    expect(hrefs({ program: "lca", status: "CERTIFIED", isFinal: true })).toEqual(["https://permtracker.app/methodology"]);
    expect(hrefs({ program: "perm", status: "RFI ISSUED", isFinal: false })[0]).toBe(
      "https://permtracker.app/perm-rfi-audit#step-by-step",
    );
  });

  it("counts from the day DOL acted, by the scorecard's own rule", () => {
    expect(SEEN_NEXT_MORNING_BEFORE_HOUR).toBe(SCORE_HOUR);
    for (const at of ["2026-10-16T11:05:00Z", "2026-10-16T18:30:00Z", "2026-11-02T04:30:00Z", "2026-03-08T16:59:00Z"]) {
      expect(dayDolActed(Date.parse(at)), at).toBe(decidedOnFromSeen(Date.parse(at)));
    }
    // 7:05 AM EDT is read as the day before; it can only move a deadline earlier.
    expect(dayDolActed(Date.parse("2026-10-16T11:05:00Z"))).toBe("2026-10-15");
  });

  it("reads the filing day DOL recorded, as an Eastern date", () => {
    expect(filingDayOnRecord("2026-10-16T02:30:00.10Z", "2026-10-16")).toBe("2026-10-15");
    expect(filingDayOnRecord(null, "2026-10-16")).toBe("2026-10-16");
    expect(filingDayOnRecord("garbage", "nope")).toBeNull();
  });

  it("offers the next alert in the chain on each confirmation page", () => {
    const perm = confirmOffers("case", ["G-100-26070-123456"], programOf);
    expect(perm.map((o) => o.href)).toEqual(["https://permtracker.app/tools/perm-timeline-calculator#queue-alert"]);
    expect(confirmOffers("case", ["P-100-26118-846661"], programOf)[0]?.label).toContain("Once the PERM is filed");
    expect(confirmOffers("case", ["I-200-26118-846661"], programOf)).toEqual([]);
    expect(confirmOffers("case", ["P-200-26118-846661"], programOf)).toEqual([]);
    expect(confirmOffers("queue").map((o) => o.href)).toEqual([
      "https://permtracker.app/perm-case-status",
      "https://permtracker.app/visa-bulletin#bulletin-alert",
    ]);
    expect(confirmOffers("employer")).toHaveLength(1);
    expect(confirmOffers("bulletin")).toEqual([]);
    // Two programs asking for the same page get one link.
    expect(confirmOffers("case", ["G-100-26070-123456", "P-100-26118-846661"], programOf)).toHaveLength(1);
  });

  it("speaks in the house voice", () => {
    const all = [
      words(nextStepsFor(base)),
      words(nextStepsFor({ ...base, status: "DENIED", approved: false })),
      words(nextStepsFor({ ...base, program: "pwd", caseNumber: "P-100-26118-846661", status: "DETERMINATION ISSUED" })),
      words(nextStepsFor({ ...base, program: "lca", caseNumber: "I-200-26118-846661" })),
      ...confirmOffers("queue").flatMap((o) => [o.label, o.detail]),
      PWD_MATCH_SENTENCE,
    ].join("\n");
    expect(all).not.toMatch(/—|!/);
    expect(all).not.toMatch(/\bwill be approved\b|\bguarantee/i);
  });
});
