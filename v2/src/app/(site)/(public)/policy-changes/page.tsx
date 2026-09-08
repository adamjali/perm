import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { listPolicyNotices, type PolicyNotice } from "@/lib/turso/policyNotices";

/**
 * Policy changes, from the record itself.
 *
 * Every entry is a Federal Register document (a rule, a proposed rule or a
 * notice) from USCIS, DHS, the State Department or DOL's Employment and
 * Training Administration that matched one of seven terms this site is
 * about. The title, type and abstract are the Register's, verbatim and
 * linked; the topic tags are the terms matched. No summary, no take on what
 * it means: the document is one click away and says it itself.
 */

const TITLE = "Immigration Policy Changes on the Record";
const DESCRIPTION =
  "Every Federal Register rule, proposed rule and notice from USCIS, DHS, State and DOL that touches PERM, wages, H-1B, the I-140 or the I-485, linked.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/policy-changes" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/policy-changes" },
}, "policy-changes");

// The feed refreshes daily with the processing-times job.
export const revalidate = 21600;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function monthLabel(ym: string): string {
  const n = Number(ym.slice(5, 7));
  return `${MONTHS[n - 1] ?? ym} ${ym.slice(0, 4)}`;
}

function dayLabel(iso: string): string {
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${(MONTHS[m - 1] ?? iso.slice(5, 7)).slice(0, 3)} ${d}, ${y}`;
}

/** Cut at a word boundary, without a regex that can backtrack over a long abstract. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const cut = head.lastIndexOf(" ");
  return `${cut > max / 2 ? head.slice(0, cut) : head}…`;
}

function typeClass(type: string): string {
  if (type === "Rule") return "bg-primary text-black";
  if (type === "Proposed Rule") return "bg-foreground text-background";
  return "bg-muted text-foreground";
}

function groupByMonth(notices: PolicyNotice[]): [string, PolicyNotice[]][] {
  const out = new Map<string, PolicyNotice[]>();
  for (const n of notices) {
    const key = n.publicationDate.slice(0, 7);
    const list = out.get(key);
    if (list) list.push(n);
    else out.set(key, [n]);
  }
  return [...out.entries()];
}

export default async function PolicyChangesPage() {
  const notices = await listPolicyNotices(200);
  const groups = groupByMonth(notices);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        Reference
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Policy changes, on the record
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        Every rule, proposed rule and notice in the Federal Register from
        USCIS, DHS, the State Department or DOL&apos;s Employment and Training
        Administration that touches PERM, prevailing wages, H-1B, the I-140,
        adjustment of status, the visa bulletin or EB-5. The wording is the
        Register&apos;s own; the tags are the terms each document matched. What a
        document means for your case is in the document, one click away.
      </p>{" "}

      {groups.length === 0 ? (
        <p className="mt-10 border-2 border-border bg-card p-5 text-base">
          No notices are held yet. The feed reads the Federal Register every
          morning; until it has run, the Register&apos;s own search is at{" "}
          <a href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22labor+certification%22" className="font-semibold text-primary underline" rel="noopener" target="_blank">federalregister.gov</a>.
        </p>
      ) : null}{" "}

      {groups.map(([ym, items]) => (
        <Fragment key={ym}>{" "}
          <section className="mt-10">
            <h2 className="font-heading text-xl font-black tracking-tight sm:text-2xl">{monthLabel(ym)}</h2>{" "}
            <ol className="mt-4 space-y-4">
              {items.map((n) => (
                <Fragment key={n.documentNumber}>{" "}
                  <li className="border-2 border-border bg-card p-4 shadow-hard-sm sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
                      <span className={`px-2 py-0.5 ${typeClass(n.type)}`}>{n.type} </span>{" "}
                      <span className="text-muted-foreground">{dayLabel(n.publicationDate)} </span>{" "}
                      <span className="text-muted-foreground">{n.agencies.join(", ")} </span>
                    </div>{" "}
                    <h3 className="mt-2 font-heading text-lg font-bold leading-snug">
                      <a href={n.url} rel="noopener" target="_blank" className="underline decoration-primary/40 decoration-2 underline-offset-2 hover:decoration-primary">
                        {n.title}
                      </a>
                    </h3>{" "}
                    {n.abstract ? (
                      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                        {clip(n.abstract, 420)}
                      </p>
                    ) : null}{" "}
                    <p className="mt-3 flex flex-wrap gap-2">
                      {n.topics.map((t) => (
                        <Fragment key={t}>{" "}
                          <span className="border-2 border-border bg-background px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">{t}</span>
                        </Fragment>
                      ))}{" "}
                      <span className="font-mono text-[11px] text-muted-foreground">Federal Register {n.documentNumber}</span>
                    </p>
                  </li>
                </Fragment>
              ))}
            </ol>
          </section>
        </Fragment>
      ))}{" "}

      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-foreground/70">
        Selection is by rule, not by judgement: an immigration agency, one of
        the seven terms, and not an omnibus regulatory agenda or a paperwork
        notice that names no form this site is about. A document that is
        missing was not matched, which is different from not mattering.{" "}
        <Link href="/changelog" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
          What changed on this site
        </Link>{" "}
        is a separate page.
      </p>{" "}

      <DataProvenance datasets={["policy-notices"]} />

      <ToolPageFooter
        currentHref="/policy-changes"
        reading={[
          { href: "/perm-processing-times", label: "PERM processing times", note: "DOL's own queue figures, updated daily" },
          { href: "/visa-bulletin", label: "The next visa bulletin", note: "what every earlier same-month bulletin did" },
          { href: "/guides/three-180-day-clocks", label: "The three 180-day clocks", note: "the rules a rule change usually touches" },
        ]}
      />
    </div>
  );
}
