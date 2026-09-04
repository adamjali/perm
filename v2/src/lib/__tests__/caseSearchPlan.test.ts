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
    "lets a %s lead combine every filter, because the index now carries the pairs",
    (kind) => {
      // THIS USED TO ASSERT THE OPPOSITE, and it was pinning a restriction
      // rather than a fact. Picking a law firm greyed out worksite state, so
      // "every case this firm filed in Texas" was unaskable.
      //
      // The cost argument was real: the biggest firm plus `state='WY'` read
      // 48,166 rows in 17.11 s, walking the firm's whole slice to return four
      // cases. Three composite indexes now make that pair a seek - 5 rows in
      // 0.55 s - so the reason for the restriction is gone, not waived.
      const can = filterAvailability(leads[kind]!);
      for (const k of FILTER_KEYS) {
        if (k === "programs") continue; // its own rule, asserted below
        expect([kind, k, can[k].on]).toEqual([kind, k, true]);
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

  it("lets a firm lead reach all three programs, now that the column is ingested", () => {
    // The chips used to be off here with `perm-only`, and the reason was true:
    // DOL publishes the firm for all three programs but this site had only
    // ever ingested PERM's, so the chips would have offered one real source
    // and two empty ones. The backfill reads it now - DOL fills it on 91.0% of
    // the FY2026 wage-request rows - so the firm is no longer the odd lead out.
    expect(filterAvailability(leads.firm!).programs.on).toBe(true);
  });

  it("lets one equality lead take another as a filter, which is now a seek", () => {
    // THE INVERSE OF WHAT THIS ASSERTED. Two equalities on `perm_cases` used
    // to mean the second was a walk of the first's slice, so the combination
    // was refused. That is what `idx_pc_att_state_dec`, `idx_pc_att_soc_dec`
    // and `idx_pc_state_soc_dec` exist for: the pair is the leading two
    // columns of an index, with `decision_date` last so the ordering stays
    // free. Measured before and after on the same rows, fresh request each:
    //   firm + state='WY'   48,166 rows / 17.11 s  ->  5 rows / 0.55 s
    //   state='CA' + a SOC  67,743 rows /  8.82 s  ->  0 rows / 0.43 s
    expect(filterAvailability(leads.state!).occupation.on).toBe(true);
    expect(filterAvailability(leads.occupation!).state.on).toBe(true);
    expect(filterAvailability(leads.firm!).state.on).toBe(true);
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
    for (const why of ["no-lead", "one-case", "number-names-program"] as const) {
      const text = refusalText(why, "wage");
      expect(text.length).toBeGreaterThan(20);
      // No em-dash: house style, and it is the loudest machine-written tell.
      expect(text).not.toContain("—");
    }
    // Every reason names a way forward. `walks-the-slice` and `perm-only` are
    // gone: nothing sets them any more, and a refusal reason no code can
    // produce is documentation that lies.
    expect(refusalText("no-lead", "wage")).toContain("law firm");
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
