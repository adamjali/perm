import "server-only";

import { cache } from "react";

import { rows } from "@/lib/db/client";

/**
 * SBA's Paycheck Protection Program loans matched to a PERM sponsor's page (scripts/ingest_ppp.py writes
 * `ppp_loans`): every loan from 2020 and 2021, as SBA released them, with the jobs the borrower reported then.
 */

export interface PppLoan {
  loan: string;
  name: string;
  city: string | null;
  state: string | null;
  approved: string | null;
  amount: number | null;
  forgiven: number | null;
  jobs: number | null;
  /** SBA's processing method: "PPP" for a first draw, "PPS" for a second. */
  draw: string | null;
}

type Row = Record<string, string | number | null>;
const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** A sponsor page's loans, oldest first. [] for none or before the first load; any other failure throws. */
export const pppForSlug = cache(async (slug: string): Promise<PppLoan[]> => {
  try {
    const got = await rows<Row>(
      "SELECT loan, name, city, state, approved, amount, forgiven, jobs, draw FROM ppp_loans " +
        "WHERE employer_slug = ? ORDER BY approved, loan LIMIT 100",
      [slug],
    );
    return got.map((r) => ({
      loan: String(r.loan), name: String(r.name ?? ""), city: s(r.city), state: s(r.state), approved: s(r.approved),
      amount: n(r.amount), forgiven: n(r.forgiven), jobs: n(r.jobs), draw: s(r.draw),
    }));
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
});
