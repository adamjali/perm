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
  it("leaves the three lead-capable fields open on an empty form", () => {
    // THE DEADLOCK THIS PINS. Every filter used to be off when nothing led,
    // including law firm, worksite state and occupation. But those three ARE
    // leads: filling one is how a lead comes into existence. Off, the employer
    // box was the only way into the search, so "find every case this firm
    // filed" was unreachable even though `chooseLead` has always accepted a
    // firm on its own. A reader hit it and reported it.
    const can = filterAvailability(null);
    for (const k of ["firm", "state", "occupation"] as const) {
      expect([k, can[k].on]).toEqual([k, true]);
    }
  });

  it("still turns the non-lead filters off, with a reason", () => {
    // The other half of the same rule: a filter that cannot start a search has
    // nothing to narrow yet, and must say so rather than look merely broken.
    const can = filterAvailability(null);
    const rest = FILTER_KEYS.filter(
      (k) => k !== "firm" && k !== "state" && k !== "occupation",
    );
    expect(rest.length).toBeGreaterThan(3);
    for (const k of rest) {
      expect([k, can[k]]).toEqual([k, { on: false, why: "no-lead" }]);
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
    },
  );

  // THE CHIPS ARE THE ONE PLACE THE THREE EQUALITY LEADS DIFFER, and the
  // difference is about which column DOL's files carry rather than about cost.
  // Asserted here because the UI reads `can.programs` and nothing else: a chip
  // row left disabled is a whole program the reader cannot see they could have
  // searched, and a chip row enabled over a source that cannot answer returns
  // an empty half that reads as "this firm files no wage requests".
  it.each(["state", "occupation"] as const)(
    "lets a %s lead choose between all three programs",
    (kind) => {
      expect(filterAvailability(leads[kind]!).programs).toEqual({ on: true });
    },
  );

  it("keeps the chips off under a firm lead, which is the only PERM-only one", () => {
    expect(filterAvailability(leads.firm!).programs).toEqual({ on: false, why: "perm-only" });
  });

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
    for (const why of ["no-lead", "one-case", "number-names-program", "perm-only", "walks-the-slice"] as const) {
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
