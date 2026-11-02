import { Fragment } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import { FinePrint } from "@/components/data/FinePrint";
import type { PppLoan } from "@/lib/db/pppLoans";
import { formatInt } from "@/lib/format";
import { shortDate } from "@convex/lib/months";

/**
 * A sponsor's Paycheck Protection Program loans from 2020 and 2021, SBA's records as released: the amount, what was
 * forgiven, and the jobs the borrower reported at the time, which is the one public headcount many small sponsors
 * have.
 */

const DATASET_URL = "https://data.sba.gov/dataset/ppp-foia";
const money = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function drawWords(draw: string | null): string {
  if (draw === "PPP") return "first-draw loan";
  if (draw === "PPS") return "second-draw loan";
  return "loan";
}

export function PaycheckProtection({ rows, pageName }: { rows: PppLoan[]; pageName: string }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const forgiven = rows.reduce((sum, r) => sum + (r.forgiven ?? 0), 0);
  const jobs = Math.max(0, ...rows.map((r) => r.jobs ?? 0));
  return (
    <section id="ppp-loans" className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6" aria-labelledby="ppp-heading">
      <h3 id="ppp-heading" className="font-heading text-xl font-bold">
        Paycheck Protection Program loans
      </h3>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        SBA approved {formatInt(rows.length)} {rows.length === 1 ? "loan" : "loans"} to {pageName} in 2020 and 2021,{" "}
        {money(total)} in all{forgiven > 0 ? `, ${money(forgiven)} of it forgiven` : ""}.
        {jobs > 0 ? ` The borrower reported ${formatInt(jobs)} jobs at the time${rows.length > 1 ? ", at most" : ""}.` : ""}
      </p>{" "}
      <details className="group mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          {rows.length === 1 ? "The loan" : `Each of the ${formatInt(rows.length)} loans`}{" "}
        </summary>{" "}
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {rows.map((r) => (
            <Fragment key={r.loan}>
              {" "}
              <li className="py-3 text-sm leading-relaxed">
                <span className="font-bold">{r.amount !== null ? money(r.amount) : "Amount not given"}</span>
                {r.approved ? `, ${drawWords(r.draw)} approved ${shortDate(r.approved) ?? r.approved}` : `, ${drawWords(r.draw)}`}
                {r.jobs !== null ? `, ${formatInt(r.jobs)} jobs reported` : ""}
                {r.forgiven ? `, ${money(r.forgiven)} forgiven` : ""}. {r.name}
                {r.city || r.state ? `, ${[r.city, r.state].filter(Boolean).join(", ")}` : ""}.{" "}
              </li>
            </Fragment>
          ))}
        </ul>
      </details>{" "}
      <FinePrint className="mt-1" summary="About these loans">
        The jobs are what the borrower reported when it applied, not a count SBA checked. A forgiven amount was paid by
        SBA, not by the borrower. Matched to this employer by name and city; different companies can share a
        name. From{" "}
        <a href={DATASET_URL} rel="noopener noreferrer" target="_blank" className="link -my-3 inline-flex min-h-11 items-center">
          SBA&apos;s PPP loan data
        </a>
        , its release of September 30 2024.
      </FinePrint>
    </section>
  );
}
