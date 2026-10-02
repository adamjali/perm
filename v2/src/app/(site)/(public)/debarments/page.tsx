import type { Metadata } from "next";
import { FinePrint } from "@/components/data/FinePrint";

import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { DebarmentBrowser } from "@/components/debarments/DebarmentBrowser";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  PROGRAM_LABEL,
  getDebarmentsSummary,
  isActive,
  phase,
  listDebarments,
  type Debarment,
  type DebarmentProgram,
} from "@/lib/turso/debarments";
import { withSocialCard } from "@/lib/socialCard";
import { formatInt } from "@/lib/format";

/**
 * DOL's debarment lists, as published.
 *
 * Four programs, two sources: OFLC's program-debarments PDF (PERM, H-2A,
 * H-2B) and the Wage and Hour Division's H-1B page. A debarment is the
 * formal, dated answer to "who may not file", the question readers ask
 * whenever an employer's filings are in the news. The rows are
 * DOL's words and dates; the page adds only whether the period contains
 * today. Expired rows stay, marked, because a list that forgets is not a
 * record.
 */

const TITLE = "Debarred PERM and H-1B Employers and Agents";
const DESCRIPTION =
  "DOL's debarment lists in one place: every employer, attorney and agent barred from PERM, H-1B, H-2A or H-2B filings, with the period and the violation.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/debarments" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/debarments" },
}, "debarments");

// The lists move a few times a year; the ingest runs daily and this page
// follows it within a working day.
export const revalidate = 21600;

const ORDER: DebarmentProgram[] = ["perm", "h1b", "h2a", "h2b"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const day = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export default async function DebarmentsPage() {
  const [all, summary] = await Promise.all([listDebarments(), getDebarmentsSummary()]);
  const today = new Date().toISOString().slice(0, 10);
  const byProgram = new Map<DebarmentProgram, Debarment[]>();
  for (const d of all) byProgram.set(d.program, [...(byProgram.get(d.program) ?? []), d]);
  const active = all.filter((d) => isActive(d, today)).length;
  // Counted, not assumed: a debarment whose start date has not arrived is
  // neither in force nor ended, and must never be described as ended.
  const upcoming = all.filter((d) => phase(d, today) === "upcoming").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Who DOL will not accept a filing from
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        Employers, attorneys and agents DOL has barred from a program for a set period, as DOL publishes
        them: the violation in DOL&apos;s words, and whether the bar is in force today.
      </p>{" "}

      {all.length === 0 ? (
        <p className="mt-10 border-2 border-border bg-card p-5 text-base">
          The lists have not been read yet. The daily ingest reads DOL&apos;s
          program-debarments document and the H-1B page; until it has run, the
          originals are at{" "}
          <a href="https://www.dol.gov/agencies/eta/foreign-labor/program-debarments" className={LINK} rel="noopener" target="_blank">
            dol.gov (OFLC)
          </a>{" "}
          and{" "}
          <a href="https://www.dol.gov/agencies/whd/immigration/h1b/debarment" className={LINK} rel="noopener" target="_blank">
            dol.gov (Wage and Hour)
          </a>
          .
        </p>
      ) : (
        <>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-foreground/80">
            {formatInt(active)} debarments in force today of {formatInt(all.length)} on the lists
            {upcoming > 0
              ? `, and ${formatInt(upcoming)} ${upcoming === 1 ? "that has" : "that have"} been ordered but ${upcoming === 1 ? "has" : "have"} not begun`
              : ""}
            .
            {summary?.pdfDate ? ` OFLC's document was last modified ${day(summary.pdfDate)}.` : ""}
            {summary?.h1bEffective ? ` The H-1B list is effective as of ${day(summary.h1bEffective)}.` : ""}
          </p>{" "}
          <DebarmentBrowser
            rows={all.map((d) => ({ ...d, phase: phase(d, today) }))}
            sections={ORDER.map((program) => ({
              program,
              label: PROGRAM_LABEL[program],
              sourceUrl:
                byProgram.get(program)?.[0]?.sourceUrl ??
                (program === "h1b"
                  ? "https://www.dol.gov/agencies/whd/immigration/h1b/debarment"
                  : "https://www.dol.gov/agencies/eta/foreign-labor/program-debarments"),
              emptyNote:
                program === "h1b" && !summary?.h1bEffective
                  ? "Not read yet from the Wage and Hour page."
                  : "No entries on DOL's list.",
            }))}
          />
        </>
      )}{" "}

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-xl font-black sm:text-2xl">What a debarment is, and is not</h2>{" "}
        {/* The regulation behind the list, on demand. The rows above are what
            a reader came for; this stays in the DOM for search either way. */}
        <FinePrint summary="The rule, and what this page does not count as one" className="mt-3">
        <p className="mt-3 text-base leading-relaxed text-foreground/85">
          Under 20 CFR 656.31(f), DOL may debar an employer, attorney or agent
          from PERM for one to three years for conduct the regulation lists,
          including failing to respond to an audit. During the period OFLC will
          not accept filings from that party under PERM or the H-1B, H-2A and
          H-2B programs. A debarment is a decision DOL has made and published;
          a case on hold or under audit is not one, and this site keeps the two
          apart. Employer and law-firm pages carry a notice when a name on these
          lists matches theirs.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/85">
          Wage and Hour Division debarments arise from its own H-1B, H-2A and
          H-2B investigations, and the H-2A list also carries plea and settlement
          agreements from criminal cases; the violation column says which. A
          Farm Labor Contractor listing is a separate register at the Wage and
          Hour Division and is not reproduced here.
        </p>
        </FinePrint>
      </section>{" "}

      <DataProvenance datasets={["debarments"]} />

      <ToolPageFooter
        currentHref="/debarments"
        reading={[
          { href: "/perm-employers/under-review", label: "Employers under review", note: "whose PERM cases are on hold, at RFI or under appeal" },
          { href: "/policy-changes", label: "Policy changes", note: "every Federal Register rule and notice on the record" },
          { href: "/perm-rfi-audit", label: "RFIs, audits and appeals", note: "the stages before a decision, measured" },
        ]}
      />
    </div>
  );
}
