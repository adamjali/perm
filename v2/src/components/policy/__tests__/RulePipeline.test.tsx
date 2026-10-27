import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RuleRecord } from "@convex/lib/ruleSteps";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("@/lib/db/client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));

const { getRulePipeline } = await import("@/lib/db/rulePipeline");
const { RulePipeline, orderAgendaOnly } = await import("../RulePipeline");

const EMPTY: RuleRecord = {
  rin: "", agency: null, title: null,
  pStage: null, pReceived: null, pCompleted: null, pDecision: null,
  fStage: null, fReceived: null, fCompleted: null, fDecision: null,
  major: null, piDocument: null, piType: null, piFiled: null, piScheduled: null, piUrl: null,
  proposedDocument: null, proposedPublished: null, proposedUrl: null, proposedCitation: null, commentsClose: null,
  finalDocument: null, finalPublished: null, finalUrl: null, finalCitation: null, effectiveOn: null,
};

/** As the 2026 Unified Agenda (run Jul 3 2026) lists a rule. */
const LISTED: Partial<RuleRecord> = {
  aPubId: "202510", aEdition: "2026", aPublished: "2026-07-03", aStage: "Proposed Rule Stage",
  aNextAction: "NPRM", aListed: "2026-07-03", aOnCurrent: true,
};

const AC29: RuleRecord = {
  ...EMPTY, ...LISTED, rin: "1205-AC29", agency: "DOL's Employment and Training Administration",
  title: "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program (NPRM)",
  pStage: "Proposed Rule", pReceived: "2026-09-14", pCompleted: "2026-10-23", pDecision: "Consistent with Change", major: "Yes",
  aAgency: "DOL/ETA", aNextDate: "07/00/2026",
  aUrl: "https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202510&RIN=1205-AC29",
};
const only = (rin: string, title: string, aNextDate: string, more: Partial<RuleRecord> = {}): RuleRecord => ({
  ...EMPTY, ...LISTED, rin, agency: "USCIS", title, aNextDate,
  aUrl: `https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202510&RIN=${rin}`, ...more,
});
const AD00 = only("1615-AD00", "Reforming the H-1B Nonimmigrant Visa Classification Program", "08/00/2026", {
  aAbstract: "The Department of Homeland Security proposes to amend its H-1B regulations.",
  aPriority: "Economically Significant",
});
const AD14 = only("1615-AD14", "Removing H-4 Dependent Spouses From the Classes of Noncitizens Eligible for Employment Authorization",
  "To Be Determined", { aStage: "Long-Term Actions" });
const AC94 = only("1615-AC94", "EB-5 Reform and Integrity Act of 2022", "07/00/2026");

const html = (rules: RuleRecord[]) => renderToStaticMarkup(<RulePipeline rules={rules} today="2026-10-27" />);

describe("the agenda on the policy page", () => {
  it("puts the listing first on a rule's track, by edition, in the agency's own words", () => {
    const out = html([AC29]);
    expect(out).toContain("Listed in the Unified Agenda");
    // The step's date line names the edition, never a day the agency acted on.
    expect(out).toMatch(/<span class="block font-mono text-sm text-soft">2026 agenda<\/span>/);
    expect(out).toContain("DOL&#x27;s 2026 agenda lists the proposal for July 2026");
    expect(out).toContain(">The 2026 agenda entry<");
    expect(out.indexOf("Listed in the Unified Agenda")).toBeLessThan(out.indexOf("In review at OIRA"));
  });

  it("lists rules only the agenda names after the cards, soonest listed date first", () => {
    const out = html([AC29, AD14, AD00, AC94]);
    expect(out).toMatch(/<h3[^>]*>Listed in the agenda, not yet at OIRA<\/h3>/);
    expect(out).toContain("3 rules the agencies list in their 2026 Unified Agenda");
    // The cards first; then July, August, and a date to be determined last.
    const at = (s: string) => out.indexOf(s);
    expect(at("RIN 1205-AC29")).toBeLessThan(at("RIN 1615-AC94"));
    expect(at("RIN 1615-AC94")).toBeLessThan(at("RIN 1615-AD00"));
    expect(at("RIN 1615-AD00")).toBeLessThan(at("RIN 1615-AD14"));
    expect(out).toContain("USCIS&#x27;s 2026 agenda lists the proposal for August 2026.");
    expect(out).toContain("USCIS&#x27;s 2026 agenda lists the proposal, with the date to be determined.");
    // The agency's own description, in the page for search and folded for a reader.
    expect(out).toMatch(/<details[^>]*><summary[^>]*>The agency&#x27;s description<\/summary>/);
    expect(out).toContain("Economically significant");
    // An agenda-only rule never gets a card of its own.
    expect(out.match(/In review at OIRA/g)).toHaveLength(1);
  });

  it("says no rule is at OIRA and still lists what the agenda names", () => {
    const out = html([AD00]);
    expect(out).toContain("is at OIRA or on public inspection today");
    expect(out).toContain("1 rule the agencies list in their 2026 Unified Agenda");
  });

  it("orders agenda-only rules by the date the agency lists", () => {
    expect(orderAgendaOnly([AD14, AD00, AC94]).map((r) => r.rin)).toEqual(["1615-AC94", "1615-AD00", "1615-AD14"]);
  });

  it("gives full cards to rules under way and folds the quiet ones, every row still in the page", () => {
    // Proposed in 2024, comments long closed, no final rule: nothing under way.
    const AC15: RuleRecord = { ...EMPTY, ...LISTED, rin: "1205-AC15", agency: "DOL", title: "Employer-Provided Survey Wage Methodology",
      proposedPublished: "2024-11-18", commentsClose: "2025-01-17", proposedUrl: "https://www.federalregister.gov/d/2024-26700" };
    const out = html([AC29, AC15, AD00]);
    expect(out.match(/In review at OIRA/g)).toHaveLength(1); // AC29's card only
    expect(out).toMatch(/<details id="quiet"[^>]*><summary[^>]*>.*No step in the last 90 days/);
    expect(out).toContain("1 rule whose newest recorded step is older than that");
    expect(out).toContain("RIN 1205-AC15");
    expect(out).toContain(">The proposed rule<");
    expect(out).toMatch(/<details id="agenda"[^>]*>/);
    // Neither fold is open: a reader meets the counts, a crawler reads every row.
    expect(out).not.toMatch(/<details id="(quiet|agenda)"[^>]*\bopen\b/);
    const at = (s: string) => out.indexOf(s);
    expect(at("RIN 1205-AC29")).toBeLessThan(at("RIN 1205-AC15"));
    expect(at("RIN 1205-AC15")).toBeLessThan(at("RIN 1615-AD00"));
  });

  it("shows regulations.gov's count on a rule still open for comment, and nowhere else", () => {
    const open: RuleRecord = { ...EMPTY, rin: "1615-AC99", agency: "USCIS", title: "Grace periods",
      proposedDocument: "2026-18631", proposedPublished: "2026-09-11", commentsClose: "2026-11-10" };
    const count = { documentNumber: "2026-18631", comments: 26697, countedBy: "regulations.gov" as const, changedAt: 1,
      docketUrl: "https://www.regulations.gov/docket/USCIS-2026-0364/comments", commentUrl: null, commentEnd: "2026-11-10" };
    const at = (today: string) =>
      renderToStaticMarkup(<RulePipeline rules={[open]} today={today} comments={new Map([["2026-18631", count]])} />);
    expect(at("2026-10-27")).toContain("26,697 comments posted so far");
    expect(at("2026-10-27")).toContain(">The posted comments<");
    expect(at("2026-11-11")).not.toContain("comments posted so far");
  });

  it("leaves no word glued to the next across an element boundary", () => {
    const out = html([AC29, AD14, AD00, AC94]);
    // Any run of closing and opening tags between two words, the way an extractor reads it.
    const glued = out.match(/[A-Za-z0-9.](?:<\/[a-z0-9]+>)+(?:<[a-z][^>]*>)+[A-Za-z0-9]/g) ?? [];
    expect(glued, glued.slice(0, 5).join(" | ")).toEqual([]);
  });
});

describe("the read layer", () => {
  const row = (over: Record<string, unknown>) => ({ rin: "x", title: "t", agency: "USCIS", ...over });
  beforeEach(() => {
    rows.mockReset();
  });

  it("marks the newest edition, keeps an interim final rule the agenda still lists, and drops what's finished", async () => {
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_pipeline_events")) return [];
      return [
        row({ rin: "1205-AC29", p_received: "2026-09-14", a_pub_id: "202510", a_edition: "2026", a_published: "2026-07-03",
              a_stage: "Proposed Rule Stage", a_next_action: "NPRM", a_next_date: "07/00/2026" }),
        // Only an older edition lists it, and nothing else is on record: off the page.
        row({ rin: "1615-AA01", a_pub_id: "202504", a_edition: "Spring 2025", a_published: "2025-09-04",
              a_stage: "Proposed Rule Stage", a_next_action: "NPRM" }),
        // An interim final rule from 2022 the 2026 agenda still lists: on the page.
        row({ rin: "1615-AC67", final_published: "2022-03-29", a_pub_id: "202510", a_edition: "2026",
              a_published: "2026-07-03", a_stage: "Final Rule Stage", a_next_action: "Interim Final Rule" }),
        // A final rule after the agenda that listed it: finished.
        row({ rin: "1615-AD06", final_published: "2026-07-20", a_pub_id: "202510", a_edition: "2026",
              a_published: "2026-07-03", a_stage: "Final Rule Stage", a_next_action: "Final Rule" }),
      ];
    });
    const { rules } = await getRulePipeline("2026-10-27");
    expect(rules.map((r) => r.rin)).toEqual(["1205-AC29", "1615-AC67"]);
    expect(rules[0]?.aOnCurrent).toBe(true);
    expect(rules[0]?.aNextDate).toBe("07/00/2026");
    expect(rows.mock.calls[0]?.[0]).toContain("a_published > final_published");
  });

  it("reads a table from before the agenda as it did", async () => {
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_pipeline_events")) return [];
      if (sql.includes("a_published")) throw new Error("SQLITE_ERROR: no such column: a_published");
      return [row({ rin: "1615-AD25", p_received: "2026-10-13" })];
    });
    const { rules } = await getRulePipeline("2026-10-27");
    expect(rules.map((r) => r.rin)).toEqual(["1615-AD25"]);
    expect(rules[0]?.aEdition).toBeNull();
    expect(rules[0]?.aOnCurrent).toBeUndefined();
  });

  it("still fails on any other error, so the last good page stays up", async () => {
    rows.mockImplementation(async () => {
      throw new Error("database unreachable");
    });
    await expect(getRulePipeline("2026-10-27")).rejects.toThrow("database unreachable");
  });
});
