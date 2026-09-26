import type { LineSnapshot } from "@/lib/greenCardLine";
import type { Cutoff } from "@/lib/perm";

/**
 * A made-up EB-3 Other Workers line for the rest of the world, small enough to
 * work out by hand: 1,200 approvals a receipt year, 5,000 principals waiting
 * behind a 1 April 2022 cutoff, 2,000 visas a year.
 */
export function lineSnapshot(over: Partial<LineSnapshot> = {}): LineSnapshot {
  const zero = { china: {}, india: {}, philippines: {}, rowmex: {} };
  return {
    awaiting: {
      asOf: "2026-06",
      counts: { EB2: {}, EB3: {}, EW3: { worldwide: 5000 } },
      cutoffIso: { EB2: {}, EB3: {}, EW3: { worldwide: "2022-04-01" } },
    },
    i140: {
      asOf: "2026-Q3",
      currentFy: 2026,
      throughQuarter: 3,
      approved: {
        E21: zero, NIW: zero, E31: zero, E32: zero,
        EW3: { ...zero, rowmex: { 2021: 1200, 2022: 1200, 2023: 1200, 2024: 1200, 2025: 1200, 2026: 900 } },
      },
      pending: { EB2: zero, EB3: { ...zero, rowmex: { 2025: 120, 2026: 300 } } },
      denied: { EB2: zero, EB3: { ...zero, rowmex: { 2021: 400, 2022: 400, 2023: 400 } } },
    },
    i485Available: {
      asOf: "2026-08-05",
      counts: { EB2: {}, EB3: {}, EW3: { worldwide: { counted: 100, suppressed: 2 } } },
    },
    supply: { fy: 2024, perYear: { EB2: {}, EB3: {}, EW3: { worldwide: 2000 } } },
    latest: {
      bulletinMonth: "2026-09",
      finalAction: { EB2: { worldwide: { kind: "current" } }, EB3: {}, EW3: { worldwide: { kind: "date", iso: "2022-04-01" } } },
      datesForFiling: { EB2: {}, EB3: {}, EW3: {} },
      lastDated: { EB2: {}, EB3: {}, EW3: { worldwide: { iso: "2022-04-01", month: "2026-09" } } },
    },
    ...over,
  };
}

/**
 * EB-2 and EB-3 for India, built from the shared fixture's approval profile
 * (1,200 a receipt year) so the two lines differ only in what each test sets:
 * how many USCIS counted waiting, and what the chart prints.
 */
export function twoLines(
  eb2Waiting: number,
  eb3Waiting: number,
  charts: { eb2?: Cutoff | null; eb3?: Cutoff | null } = {},
): LineSnapshot {
  const base = lineSnapshot();
  const profile = base.i140!.approved.EW3.rowmex;
  const zero = { china: {}, india: {}, philippines: {}, rowmex: {} };
  const dated: Cutoff = { kind: "date", iso: "2013-01-01" };
  const eb2 = charts.eb2 === undefined ? dated : charts.eb2;
  const eb3 = charts.eb3 === undefined ? dated : charts.eb3;
  const last = { iso: "2013-01-01", month: "2026-09" };
  return {
    awaiting: {
      asOf: "2026-06",
      counts: { EB2: { india: eb2Waiting }, EB3: { india: eb3Waiting }, EW3: {} },
      cutoffIso: { EB2: { india: "2013-01-01" }, EB3: { india: "2013-01-01" }, EW3: {} },
    },
    i140: {
      ...base.i140!,
      approved: { E21: { ...zero, india: profile }, NIW: zero, E31: { ...zero, india: profile }, E32: zero, EW3: zero },
      pending: { EB2: zero, EB3: zero },
      denied: { EB2: zero, EB3: zero },
    },
    i485Available: null,
    supply: null,
    latest: {
      bulletinMonth: "2026-09",
      finalAction: { EB2: { india: eb2 }, EB3: { india: eb3 }, EW3: {} },
      datesForFiling: { EB2: {}, EB3: {}, EW3: {} },
      lastDated: { EB2: { india: last }, EB3: { india: last }, EW3: {} },
    },
  };
}
