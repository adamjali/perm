import { describe, expect, it } from "vitest";

import {
  FILTER_KEYS,
  OUTCOMES,
  PUBLISHED_ONLY_FILTERS,
  availableOutcomes,
  chooseLead,
  filterAvailability,
  isOutcome,
  refusalText,
  type FilterKey,
  type Lead,
} from "../caseSearchPlan";

/**
 * The rules the route enforces and the form explains, checked once.
 *
 * These are the two things this module exists to stop: a control that looks
 * live and returns nothing (the reader learns to distrust the site), and a
 * combination that reads a whole slice on every request (measured at 67,742
 * rows and 44.72 seconds for California). Neither is visible in a result set,
 * so both are asserted here rather than through a search.
 */

const leads: Record<string, Lead> = {
  case: { kind: "case", value: "G-100-26125-868956" },
  employer: { kind: "employer", value: "amazon" },
  firm: { kind: "firm", value: "fragomen-del-rey-bernsen-loewy-llp" },
  state: { kind: "state", value: "CA" },
  occupation: { kind: "occupation", value: "15-1252.00" },
};

describe("chooseLead", () => {
  it("prefers a case number over everything, because it is a point read", () => {
    expect(
      chooseLead({
        caseNumber: "G-100-26125-868956",
        employer: "amazon",
        state: "CA",
      }),
    ).toEqual({ kind: "case", value: "G-100-26125-868956" });
  });

  it("prefers an employer next, because it is the only lead the live tables index", () => {
    expect(chooseLead({ employer: "amazon", firmSlug: "f", state: "CA", socCode: "s" })).toEqual({
      kind: "employer",
      value: "amazon",
    });
  });

  it("falls through firm, then state, then occupation", () => {
    expect(chooseLead({ firmSlug: "f", state: "CA", socCode: "s" })?.kind).toBe("firm");
    expect(chooseLead({ state: "CA", socCode: "s" })?.kind).toBe("state");
    expect(chooseLead({ socCode: "s" })?.kind).toBe("occupation");
  });

  it("refuses a one-character employer: a one-letter slug range is most of the table", () => {
    expect(chooseLead({ employer: "a" })).toBeNull();
    expect(chooseLead({ employer: "  " })).toBeNull();
  });

  it("returns null when nothing can lead, rather than picking something", () => {
    expect(chooseLead({})).toBeNull();
  });
});

describe("filterAvailability", () => {
  it("turns everything off with a reason when nothing leads", () => {
    const can = filterAvailability(null);
    for (const k of FILTER_KEYS) {
      expect(can[k]).toEqual({ on: false, why: "no-lead" });
    }
  });

  it("lets an employer lead carry every filter", () => {
    const can = filterAvailability(leads.employer!);
    for (const k of FILTER_KEYS) {
      expect(can[k].on).toBe(true);
    }
  });

  it("leaves a case lookup with nothing to narrow, and says which reason applies", () => {
    const can = filterAvailability(leads.case!);
    expect(can.programs).toEqual({ on: false, why: "number-names-program" });
    expect(can.wage).toEqual({ on: false, why: "one-case" });
  });

  it.each(["firm", "state", "occupation"] as const)(
    "gives a %s lead only the outcome, the decided range and its own field",
    (kind) => {
      const can = filterAvailability(leads[kind]!);
      expect(can.outcome.on).toBe(true);
      expect(can.decided.on).toBe(true);
      expect(can[kind as FilterKey].on).toBe(true);
      // The rest walk the slice.
      for (const k of ["title", "filed", "fiscalYear", "wage"] as const) {
        expect(can[k]).toEqual({ on: false, why: "walks-the-slice" });
      }
      expect(can.programs).toEqual({ on: false, why: "published-only" });
    },
  );

  it("does not let one equality lead double as another one's filter", () => {
    // Two equalities on `perm_cases` means the second is a walk of the first's
    // slice: state plus occupation is the exact 44.7-second combination.
    expect(filterAvailability(leads.state!).occupation.on).toBe(false);
    expect(filterAvailability(leads.occupation!).state.on).toBe(false);
    expect(filterAvailability(leads.firm!).state.on).toBe(false);
  });
});

describe("availableOutcomes", () => {
  it("offers all four under an employer or a case number", () => {
    expect(availableOutcomes(leads.employer!)).toEqual(OUTCOMES);
    expect(availableOutcomes(leads.case!)).toEqual(OUTCOMES);
  });

  it.each(["firm", "state", "occupation"] as const)(
    'drops "still open" under a %s lead, which reads decided files only',
    (kind) => {
      expect(availableOutcomes(leads[kind]!)).not.toContain("open");
      expect(availableOutcomes(leads[kind]!)).toHaveLength(3);
    },
  );
});

describe("refusalText", () => {
  it("names the alternative in every reason, never just the refusal", () => {
    for (const why of ["no-lead", "one-case", "number-names-program", "published-only", "walks-the-slice"] as const) {
      const text = refusalText(why, "wage");
      expect(text.length).toBeGreaterThan(20);
      // No em-dash: house style, and it is the loudest machine-written tell.
      expect(text).not.toContain("—");
    }
    expect(refusalText("walks-the-slice", "wage")).toContain("employer");
  });
});

describe("the shared vocabulary", () => {
  it("keeps every published-only filter inside the filter list", () => {
    for (const k of PUBLISHED_ONLY_FILTERS) {
      expect(FILTER_KEYS).toContain(k);
    }
  });

  it("recognises exactly the four outcomes", () => {
    for (const o of OUTCOMES) expect(isOutcome(o)).toBe(true);
    expect(isOutcome("pending")).toBe(false);
    expect(isOutcome("")).toBe(false);
  });
});
