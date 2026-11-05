import { shiftMonth } from "@convex/lib/months";

/**
 * Reading State's monthly nonimmigrant visa issuances by post (scripts/ingest_niv_issuances.py).
 * A plain module: the consulate pages, the index's ranking and the tests share it.
 *
 * The names are the symbols' meanings in State's own list, 22 CFR 41.12 as 9 FAM 402.1 prints it
 * (read Nov 5 2026), in plain words. Two symbols State's statistics print aren't in that list,
 * BBBCC and BBBCV, the border crossing card; they're named as State prints them.
 */

export interface NivClass {
  /** The class as people write it: "H-1B", "K-1". */
  name: string;
  /** What it is, in a few words. */
  what: string;
}

const C = (name: string, what: string): NivClass => ({ name, what });

export const NIV_CLASSES: Readonly<Record<string, NivClass>> = {
  A1: C("A-1", "diplomat or consular officer, or family"),
  A2: C("A-2", "other foreign government official or employee, or family"),
  A3: C("A-3", "staff of an A-1 or A-2"),
  B1: C("B-1", "visitor for business"),
  B2: C("B-2", "visitor for pleasure"),
  "B1/B2": C("B-1/B-2", "visitor for business and pleasure"),
  BBBCC: C("BBBCC", "border crossing card, as State's statistics list it"),
  BBBCV: C("BBBCV", "border crossing card, as State's statistics list it"),
  C1: C("C-1", "in transit"),
  "C1/D": C("C-1/D", "transit and crewmember"),
  C2: C("C-2", "in transit to the United Nations"),
  C3: C("C-3", "foreign government official in transit"),
  CW1: C("CW-1", "Northern Mariana Islands transitional worker"),
  CW2: C("CW-2", "spouse or child of a CW-1"),
  D: C("D", "crewmember, sea or air"),
  E1: C("E-1", "treaty trader, spouse or child"),
  E2: C("E-2", "treaty investor, spouse or child"),
  E2C: C("E-2C", "Northern Mariana Islands investor, spouse or child"),
  E3: C("E-3", "Australian in a specialty occupation"),
  E3D: C("E-3D", "spouse or child of an E-3"),
  E3R: C("E-3R", "returning E-3"),
  F1: C("F-1", "academic or language student"),
  F2: C("F-2", "spouse or child of an F-1"),
  F3: C("F-3", "Canadian or Mexican commuter student"),
  G1: C("G-1", "representative to an international organization"),
  G2: C("G-2", "other representative to an international organization"),
  G3: C("G-3", "representative of a nonmember government"),
  G4: C("G-4", "international organization officer or employee"),
  G5: C("G-5", "staff of a G-1 to G-4"),
  H1B: C("H-1B", "specialty occupation worker"),
  H1B1: C("H-1B1", "Chilean or Singaporean specialty occupation worker"),
  H1C: C("H-1C", "registered nurse in a shortage area"),
  H2A: C("H-2A", "temporary farm worker"),
  H2B: C("H-2B", "temporary non-farm worker"),
  H3: C("H-3", "trainee or special education exchange visitor"),
  H4: C("H-4", "spouse or child of an H worker"),
  I: C("I", "foreign media representative, spouse or child"),
  J1: C("J-1", "exchange visitor"),
  J2: C("J-2", "spouse or child of a J-1"),
  K1: C("K-1", "fiancé(e)"),
  K2: C("K-2", "child of a K-1 fiancé(e)"),
  K3: C("K-3", "spouse of a U.S. citizen awaiting an immigrant visa"),
  K4: C("K-4", "child of a K-3"),
  L1: C("L-1", "intracompany transferee"),
  L2: C("L-2", "spouse or child of an L-1"),
  M1: C("M-1", "vocational student"),
  M2: C("M-2", "spouse or child of an M-1"),
  M3: C("M-3", "Canadian or Mexican commuter vocational student"),
  N8: C("N-8", "parent of certain special immigrants"),
  N9: C("N-9", "child of an N-8 or of certain special immigrants"),
  NATO1: C("NATO-1", "principal representative to NATO"),
  NATO2: C("NATO-2", "other representative to NATO, or a NATO force's dependent"),
  NATO3: C("NATO-3", "clerical staff of a NATO representative"),
  NATO4: C("NATO-4", "NATO official"),
  NATO5: C("NATO-5", "expert on a NATO mission"),
  NATO6: C("NATO-6", "civilian with a NATO force"),
  NATO7: C("NATO-7", "staff of NATO-1 to NATO-6"),
  O1: C("O-1", "worker with extraordinary ability"),
  O2: C("O-2", "assistant to an O-1"),
  O3: C("O-3", "spouse or child of an O-1 or O-2"),
  P1: C("P-1", "internationally recognized athlete or entertainer"),
  P2: C("P-2", "artist or entertainer in a reciprocal exchange"),
  P3: C("P-3", "artist or entertainer in a culturally unique program"),
  P4: C("P-4", "spouse or child of a P-1, P-2 or P-3"),
  Q1: C("Q-1", "international cultural exchange"),
  R1: C("R-1", "religious worker"),
  R2: C("R-2", "spouse or child of an R-1"),
  S5: C("S-5", "witness on a criminal organization"),
  S6: C("S-6", "witness on terrorism"),
  S7: C("S-7", "family of an S-5 or S-6"),
  T1: C("T-1", "victim of trafficking"),
  T2: C("T-2", "spouse of a T-1"),
  T3: C("T-3", "child of a T-1"),
  T4: C("T-4", "parent of a T-1"),
  T5: C("T-5", "sibling of a T-1"),
  T6: C("T-6", "child of a T-1's family member"),
  TN: C("TN", "USMCA professional"),
  TD: C("TD", "spouse or child of a TN"),
  U1: C("U-1", "victim of crime"),
  U2: C("U-2", "spouse of a U-1"),
  U3: C("U-3", "child of a U-1"),
  U4: C("U-4", "parent of a U-1"),
  U5: C("U-5", "sibling of a U-1"),
  V1: C("V-1", "spouse of a permanent resident awaiting an immigrant visa"),
  V2: C("V-2", "child of a permanent resident awaiting an immigrant visa"),
  V3: C("V-3", "child of a V-1 or V-2"),
};

/** A class as people write it, with what it is: a symbol State's list doesn't name is shown as State prints it. */
export function nivClass(symbol: string): NivClass {
  return NIV_CLASSES[symbol] ?? { name: symbol, what: "as State's table prints it" };
}

/**
 * The work visas, and the visas of the families who come with them, in the order the consulate
 * pages list them: H-1B and L-1 first.
 */
export const WORK_CLASSES: readonly string[] = [
  "H1B", "H4", "L1", "L2", "H1B1", "H1C", "H2A", "H2B", "H3",
  "E1", "E2", "E2C", "E3", "E3D", "E3R", "O1", "O2", "O3",
  "P1", "P2", "P3", "P4", "Q1", "R1", "R2", "TN", "TD", "CW1", "CW2", "I",
];
const WORK = new Set(WORK_CLASSES);

/** The two the consulate pages chart month by month. */
export const CHARTED_CLASSES = ["H1B", "L1"] as const;

/** The classes the consulates index ranks, one tab each. */
export const RANKED_CLASSES = ["H1B", "L1", "K1"] as const;
export type RankedClass = (typeof RANKED_CLASSES)[number];

export const isWorkClass = (symbol: string): boolean => WORK.has(symbol);

/** One post's nonimmigrant visas, month by month: class symbol to count. */
export type PostMonths = ReadonlyMap<string, Readonly<Record<string, number>>>;

/** The months from `to` back over `count` months, oldest first (YYYY-MM). */
export function monthsTo(to: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(to, i - (count - 1)));
}

export interface ClassRow {
  symbol: string;
  name: string;
  what: string;
  work: boolean;
  /** Issued in the newest month. */
  newest: number;
  /** Issued in the months shown. */
  year: number;
}

/**
 * Every class a post issued in the months given, the work visas first in their own order, then
 * the rest by how many the post issued in the newest month. A class with nothing in the window
 * isn't a row.
 */
export function classRows(byMonth: PostMonths, months: readonly string[]): ClassRow[] {
  const newestMonth = months.at(-1);
  const year: Record<string, number> = {};
  for (const m of months) for (const [cls, n] of Object.entries(byMonth.get(m) ?? {})) year[cls] = (year[cls] ?? 0) + n;
  const newest = (newestMonth && byMonth.get(newestMonth)) || {};
  const rows = Object.keys(year)
    .filter((cls) => year[cls]! > 0)
    .map((cls): ClassRow => ({ symbol: cls, ...nivClass(cls), work: WORK.has(cls), newest: newest[cls] ?? 0, year: year[cls]! }));
  const order = (r: ClassRow) => (r.work ? WORK_CLASSES.indexOf(r.symbol) : Number.MAX_SAFE_INTEGER);
  return rows.sort((a, b) => order(a) - order(b) || b.newest - a.newest || b.year - a.year || a.symbol.localeCompare(b.symbol));
}

export interface ClassRank {
  postKey: string;
  /** State's spelling of the post. */
  post: string;
  n: number;
}

/** The posts that issued a class in a month, most first; posts that issued none aren't listed. */
export function rankPosts(rows: readonly { post_key: string; post: string; visa_class: string; n: number }[], symbol: string): ClassRank[] {
  return rows
    .filter((r) => r.visa_class === symbol && r.n > 0)
    .map((r) => ({ postKey: r.post_key, post: r.post, n: r.n }))
    .sort((a, b) => b.n - a.n || a.post.localeCompare(b.post));
}
