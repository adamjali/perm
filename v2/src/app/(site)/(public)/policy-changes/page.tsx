import type { Metadata } from "next";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { RecordStrip } from "@/components/home/RecordStrip";
import { DocRow } from "@/components/policy/DocRow";
import { monthYear } from "@/components/policy/format";
import { OflcArchive } from "@/components/policy/OflcArchive";
import { PolicyStrip, StripLegend } from "@/components/policy/PolicyStrip";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { buildFeed, buildStrip, feedLedger } from "@/lib/policyFeed";
import type { RecordFigure } from "@/lib/recordCounts";
import { withSocialCard } from "@/lib/socialCard";
import { listPolicyNotices } from "@/lib/turso/policyNotices";

/**
 * Policy changes, from the record itself.
 *
 * Two feeds under one page. Federal Register documents (rules, proposed
 * rules, notices) from USCIS, DHS, State and DOL that matched one of seven
 * terms, with the Register's own dates: when a rule takes effect, when
 * comments close and where to file one, the citation, the DATES paragraph
 * verbatim, and the first page as printed. And OFLC's own announcements on
 * these programs, which is where a DOL change appears before the Register.
 *
 * What a reader meets is a twelve-month strip and collapsed rows; what a
 * crawler reads is every title, abstract and date, because a <details> keeps
 * its body in the DOM. No summary, no take on what a document means: the
 * document is one click away and says it itself.
 */

const TITLE = "Immigration Policy Changes on the Record";
const DESCRIPTION =
  "Every Federal Register rule, proposed rule and notice on PERM, wages, H-1B, the I-140 and the I-485, with the dates that matter, linked.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/policy-changes" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/policy-changes" },
}, "policy-changes");

// The feeds refresh daily with the processing-times job; six hours keeps a
// "days left" figure honest without regenerating a page nothing moved on.
export const revalidate = 21600;

/** Today in Washington, not UTC: after 8 PM Eastern a UTC date is tomorrow, and "days left" would be one short. */
function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const LINK =
  "font-semibold underline decoration-primary decoration-2 underline-offset-[3px] transition-colors hover:text-primary";

export default async function PolicyChangesPage() {
  const today = todayEastern();
  const rows = await listPolicyNotices();
  const feed = buildFeed(rows);
  const ledger = feedLedger(feed, today);
  const strip = buildStrip(feed, today);
  const newestOf = (type: string) => feed.register.find((d) => d.type === type)?.publicationDate ?? null;
  const record: RecordFigure[] = [];
  const push = (value: number, label: string, href: string, asOf: string | null) => {
    if (value > 0 && asOf) record.push({ value, label, href, asOf, asOfKind: "newest" });
  };
  push(ledger.rules, "final rules in the Federal Register", "#register", newestOf("Rule"));
  push(
    ledger.proposed,
    ledger.proposedOpen > 0
      ? `proposed rules, ${ledger.proposedOpen} open for comment`
      : "proposed rules, none open for comment",
    "#register",
    newestOf("Proposed Rule"),
  );
  push(ledger.notices, "notices", "#register", newestOf("Notice"));
  push(ledger.oflc, "OFLC announcements on these programs", "#oflc", feed.oflc[0]?.publicationDate ?? null);
  const earlier = strip.earlierRegister + strip.earlierOflc;
  const empty = feed.register.length === 0 && feed.oflc.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Reference
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Policy changes, on the record
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        Every rule, proposed rule and notice on PERM, prevailing wages, H-1B and
        green cards, as the Federal Register and OFLC published them.
      </p>{" "}

      {empty ? (
        <p className="mt-10 border-2 border-border bg-card p-5 text-base">
          No documents are held yet. The feed reads the Federal Register every
          morning; until it has run, the Register&apos;s own search is at{" "}
          <a href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22labor+certification%22" className={LINK} rel="noopener" target="_blank">federalregister.gov</a>.
        </p>
      ) : (
        <>
          <RecordStrip record={record} />{" "}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">The last twelve months</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              One mark per document, on the day it was published. The bar under a
              proposed rule is its comment window, lime while it is open.
            </p>{" "}
            <PolicyStrip strip={strip} />{" "}
            <StripLegend />{" "}
            {earlier > 0 ? (
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                {earlier} earlier {earlier === 1 ? "document is" : "documents are"} in the lists below.
              </p>
            ) : null}
          </section>{" "}

          <section className="mt-12" id="register">
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">In the Federal Register</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              {feed.register.length} {feed.register.length === 1 ? "document" : "documents"}
              {ledger.earliest ? ` since ${monthYear(ledger.earliest)}` : ""}, newest first. Open one
              for the abstract, the dates as published, and the first page as printed.
            </p>{" "}
            <div className="mt-6 border-2 border-border bg-card shadow-hard">
              {feed.register.map((d) => (
                <DocRow key={d.documentNumber} doc={d} today={today} />
              ))}
            </div>
          </section>{" "}

          <section className="mt-12" id="oflc">
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">From OFLC</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              {feed.oflc.length} announcements on PERM, prevailing wages, H-1B and the
              disclosure files{ledger.oflcSince ? `, back to ${ledger.oflcSince.slice(0, 4)}` : ""}.
              {feed.oflcOther > 0 ? (
                <>
                  {" "}
                  {feed.oflcOther} more on H-2A, H-2B and CW-1 are held and not listed; they are on{" "}
                  <a href="https://www.dol.gov/agencies/eta/foreign-labor/news" className={LINK} rel="noopener" target="_blank">
                    DOL&apos;s page
                  </a>
                  .
                </>
              ) : null}
            </p>{" "}
            <OflcArchive items={feed.oflc} today={today} />
          </section>{" "}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">How documents are selected</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              By rule, not by judgement. A document that is missing was not
              matched, which is different from not mattering.
            </p>{" "}
            <FinePrint summary="The selection rules in full" className="mt-3 max-w-3xl">
              <p>
                An immigration agency (USCIS, DHS, the State Department, or DOL&apos;s
                Employment and Training Administration) and one of seven terms:
                labor certification, prevailing wage, H-1B, I-140, adjustment of
                status, visa bulletin, EB-5. Dropped by rule: the Unified Agenda
                omnibus notices, paperwork notices that name no form this site is
                about, and agency housekeeping such as board appointments and
                meeting notices. A correction is folded into the document it
                corrects and linked from it.
              </p>{" "}
              <p className="mt-3">
                OFLC&apos;s announcements are tagged by program as they are read
                from DOL&apos;s page; the ones on PERM, prevailing wages, H-1B and
                the disclosure files are listed here and the rest are counted.
                The wording everywhere is the agency&apos;s own.{" "}
                <Link href="/changelog" className={LINK}>
                  What changed on this site
                </Link>{" "}
                is a separate page.
              </p>
            </FinePrint>
          </section>
        </>
      )}{" "}

      <DataProvenance datasets={["policy-notices", "policy-notices-oflc"]} />

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
