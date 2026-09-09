import type { Metadata } from "next";
import { Fragment } from "react";

import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  PROGRAM_LABEL,
  getDebarmentsSummary,
  isActive,
  listDebarments,
  type Debarment,
  type DebarmentProgram,
} from "@/lib/turso/debarments";

/**
 * DOL's debarment lists, as published.
 *
 * Four programs, two sources: OFLC's program-debarments PDF (PERM, H-2A,
 * H-2B) and the Wage and Hour Division's H-1B page. A debarment is the
 * formal, dated answer to "who may not file", and until Sep 2026 it was not
 * on this site; the week DOL's Inspector General announced one employer's
 * PERM suspension, it was the question everyone asked next. The rows are
 * DOL's words and dates; the page adds only whether the period contains
 * today. Expired rows stay, marked, because a list that forgets is not a
 * record.
 */

const TITLE = "Employers and Agents Debarred From PERM, H-1B, H-2A and H-2B";
const DESCRIPTION =
  "DOL's debarment lists in one place: every employer, attorney and agent barred from PERM, H-1B, H-2A or H-2B filings, with the period and the violation.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/debarments" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/debarments" },
};

// The lists move a few times a year; the ingest runs daily and this page
// follows it within a working day.
export const revalidate = 21600;

const ORDER: DebarmentProgram[] = ["perm", "h1b", "h2a", "h2b"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const day = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const int = (n: number) => n.toLocaleString("en-US");
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function Row({ d, today }: { d: Debarment; today: string }) {
  const active = isActive(d, today);
  return (
    <li className={`grid grid-cols-1 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_minmax(0,14rem)] sm:gap-x-4 ${active ? "" : "text-foreground/60"}`}>
      <div>
        <span className="font-bold">{d.entity}</span>{" "}
        {d.entityType ? <span className="text-sm text-foreground/70">{d.entityType}</span> : null}{" "}
        {d.location ? <span className="text-sm text-foreground/70">· {d.location}</span> : null}
      </div>{" "}
      <div className="font-mono text-xs tabular-nums">
        {day(d.startDate)} to {day(d.endDate)}
        {active ? "" : " (ended)"}
      </div>{" "}
      <div className="text-sm">
        {d.violation ?? ""}
        {d.citation ? <span className="text-foreground/60"> · {d.citation}</span> : null}
      </div>
    </li>
  );
}

export default async function DebarmentsPage() {
  const [all, summary] = await Promise.all([listDebarments(), getDebarmentsSummary()]);
  const today = new Date().toISOString().slice(0, 10);
  const byProgram = new Map<DebarmentProgram, Debarment[]>();
  for (const d of all) byProgram.set(d.program, [...(byProgram.get(d.program) ?? []), d]);
  const active = all.filter((d) => isActive(d, today)).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        Reference
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Who DOL will not accept a filing from
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        A debarment bars an employer, attorney or agent from a program for a
        stated period. DOL publishes the PERM, H-2A and H-2B lists in one
        document and the H-1B list on a Wage and Hour Division page. Both are
        here as published, with the violation in DOL&apos;s words and whether
        the period contains today.
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
            {int(active)} debarments in force today of {int(all.length)} on the lists.
            {summary?.pdfDate ? ` OFLC's document was last modified ${day(summary.pdfDate)}.` : ""}
            {summary?.h1bEffective ? ` The H-1B list is effective as of ${day(summary.h1bEffective)}.` : ""}
          </p>{" "}
          {ORDER.map((program) => {
            const list = byProgram.get(program) ?? [];
            return (
              <Fragment key={program}>{" "}
              <section className="mt-10">
                <h2 className="font-heading text-xl font-black sm:text-2xl">{PROGRAM_LABEL[program]}</h2>{" "}
                <p className="mt-1 text-sm text-foreground/70">
                  {list.length === 0
                    ? program === "h1b" && !summary?.h1bEffective
                      ? "Not read yet from the Wage and Hour page. "
                      : "No entries on DOL's list. "
                    : `${int(list.filter((d) => isActive(d, today)).length)} in force, ${int(list.length)} listed. `}
                  <a
                    href={list[0]?.sourceUrl ?? (program === "h1b" ? "https://www.dol.gov/agencies/whd/immigration/h1b/debarment" : "https://www.dol.gov/agencies/eta/foreign-labor/program-debarments")}
                    className={LINK}
                    rel="noopener"
                    target="_blank"
                  >
                    DOL&apos;s list
                  </a>
                </p>{" "}
                {list.length > 0 ? (
                  <ul className="mt-3 divide-y-2 divide-border border-y-2 border-border">
                    {list.map((d) => (
                      <Fragment key={`${d.program}-${d.entity}-${d.startDate}`}>{" "}
                      <Row d={d} today={today} />
                      </Fragment>
                    ))}
                  </ul>
                ) : null}
              </section>
              </Fragment>
            );
          })}
        </>
      )}{" "}

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-xl font-black sm:text-2xl">What a debarment is, and is not</h2>{" "}
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
      </section>{" "}

      <DataProvenance datasets={["debarments"]} />

      <ToolPageFooter
        currentHref="/debarments"
        reading={[
          { href: "/perm-employers/under-review", label: "Employers under review", note: "whose pending cases DOL has pulled aside" },
          { href: "/policy-changes", label: "Policy changes", note: "every Federal Register rule and notice on the record" },
          { href: "/perm-rfi-audit", label: "RFIs, audits and appeals", note: "the stages before a decision, measured" },
        ]}
      />
    </div>
  );
}
