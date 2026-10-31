import { Fragment } from "react";

import { FinePrint } from "@/components/data/FinePrint";
import type { SamExclusion } from "@/lib/db/samExclusions";
import { shortDate } from "@convex/lib/months";

/**
 * A sponsor page's SAM.gov exclusions: firms the federal government has excluded from contracts, certain
 * subcontracts and certain kinds of federal assistance. SAM's record as published, row by row; the match is by name
 * and city (`scripts/ingest_sam_exclusions.py`), and the reader can see SAM's name beside the page's.
 */

// The excluding agencies SAM names by code, in full where the code is certain (SAM's agency names); any other code
// prints as SAM gives it.
const AGENCY: Record<string, string> = {
  EPA: "the Environmental Protection Agency",
  DLA: "the Defense Logistics Agency",
  SBA: "the Small Business Administration",
  HUD: "the Department of Housing and Urban Development",
  OPM: "the Office of Personnel Management",
  FTA: "the Federal Transit Administration",
  USCIS: "U.S. Citizenship and Immigration Services",
  HHS: "the Department of Health and Human Services",
  DOL: "the Department of Labor",
};

const SAM_SEARCH = "https://sam.gov/search/?index=ex";
const day = (iso: string | null) => (iso ? (shortDate(iso) ?? iso) : null);

export function agencyName(code: string | null): string {
  if (!code) return "an agency SAM doesn't name";
  return AGENCY[code] ?? code;
}

export function periodLine(x: Pick<SamExclusion, "active" | "ends" | "indefinite">): string {
  const from = day(x.active);
  const to = day(x.ends);
  if (from && to) return `from ${from} to ${to}`;
  if (from) return x.indefinite ? `from ${from}, with no end date` : `from ${from}`;
  return x.indefinite ? "with no end date" : "dates not given";
}

export function FederalExclusions({ rows, pageName }: { rows: SamExclusion[]; pageName: string }) {
  if (rows.length === 0) return null;
  return (
    <aside id="federal-exclusions" className="mt-8 border-2 border-foreground bg-card p-5 shadow-hard sm:p-6" aria-labelledby="sam-heading">
      <h2 id="sam-heading" className="font-heading text-xl font-bold">
        Excluded from federal contracts
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        SAM.gov lists {rows.length === 1 ? "a firm" : `${rows.length} records`} matching {pageName} as excluded today,
        by name and city. SAM&apos;s record, as published:
      </p>{" "}
      <ul className="mt-3 divide-y divide-border border-y-2 border-border">
        {rows.map((x) => (
          <Fragment key={`${x.name}|${x.agency}|${x.active}`}>
            {" "}
            <li className="py-3 text-base leading-relaxed">
              <span className="font-bold">{x.name}</span>
              {x.city || x.state ? `, ${[x.city, x.state].filter(Boolean).join(", ")}` : ""}: excluded by {agencyName(x.agency)}
              {x.kind ? ` (${x.kind})` : ""}, {periodLine(x)}.
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <FinePrint className="mt-1" summary="What an exclusion means">
        An excluded firm can&apos;t receive federal contracts, certain subcontracts or certain kinds of federal assistance
        while the exclusion lasts. It isn&apos;t a finding about the firm&apos;s immigration filings. Different companies
        can share a name, so check the record itself in{" "}
        <a href={SAM_SEARCH} rel="noopener noreferrer" target="_blank" className="link">
          SAM.gov&apos;s exclusions search
        </a>
        . From SAM.gov&apos;s daily public file of active exclusions.
      </FinePrint>
    </aside>
  );
}
