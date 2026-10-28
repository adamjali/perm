import type { Metadata } from "next";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { RecordStrip } from "@/components/home/RecordStrip";
import { DocRow, typeLabel } from "@/components/policy/DocRow";
import { PolicySearch } from "@/components/policy/PolicySearch";
import { monthYear } from "@/components/policy/format";
import { OflcArchive } from "@/components/policy/OflcArchive";
import { PolicyStrip, StripLegend } from "@/components/policy/PolicyStrip";
import { RulePipeline } from "@/components/policy/RulePipeline";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { buildFeed, buildStrip, feedLedger } from "@/lib/policyFeed";
import { policyFacets, policySearchItems } from "@/lib/policySearch";
import type { RecordFigure } from "@/lib/recordCounts";
import { withSocialCard } from "@/lib/socialCard";
import { getCommentCounts } from "@/lib/db/policyComments";
import { listPolicyNotices } from "@/lib/db/policyNotices";
import { getRulePipeline } from "@/lib/db/rulePipeline";
import { easternDay } from "@/lib/time";

/**
 * Policy changes, from the record itself.
 *
 * The rules on their way come first: OIRA's review, public inspection and
 * publication, each step dated (`lib/db/rulePipeline`, drawn by RulePipeline).
 * Then what's coming next: documents filed for public inspection (published
 * the next business day, sometimes later) and presidential actions the White
 * House has posted and the Register hasn't published yet.
 *
 * Then the Federal Register's documents (rules, proposed rules, notices and
 * presidential documents) from USCIS, DHS, State, DOL and the President,
 * with the Register's own dates: when a rule takes effect, when comments
 * close and where to file one, the citation, the DATES paragraph verbatim,
 * and the first page as printed. And the agencies' own announcements (USCIS's
 * newsroom and Policy Manual, DOL's newsroom, OFLC), which is where a change
 * often appears before the Register. Every source is read every 30 minutes
 * or every weekday hour (`scripts/lib_policy_feed.py`).
 *
 * What a reader meets is a twelve-month strip and collapsed rows; what a
 * crawler reads is every title, abstract and date, because a <details> keeps
 * its body in the DOM. No summary, no take on what a document means: the
 * document is one click away and says it itself.
 */

const TITLE = "Immigration Policy Changes on the Record";
const DESCRIPTION =
  "Rules, notices, presidential actions and agency announcements on PERM, H-1B, H-2A, H-2B and green cards, read every 30 minutes from the source.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/policy-changes" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/policy-changes" },
}, "policy-changes");

// Every source asks for a rebuild the moment it writes something
// (/api/revalidate-policy); six hours keeps a "days left" figure honest on a
// day nothing moved.
export const revalidate = 21600;

const LINK =
  "font-semibold link";

export default async function PolicyChangesPage() {
  const today = easternDay();
  const [rows, pipeline, comments] = await Promise.all([
    listPolicyNotices(),
    getRulePipeline(today),
    getCommentCounts(),
  ]);
  const feed = buildFeed(rows, today);
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
  push(ledger.presidential, "presidential documents", "#register", newestOf("Presidential Document"));
  push(ledger.coming, "filed or signed, not yet published", "#coming",
    [...feed.filed.map((d) => d.piFiled ?? d.publicationDate), ...feed.signed.map((d) => d.publicationDate)].sort().pop() ?? null);
  push(ledger.announcements, "agency announcements", "#agencies", feed.announcements[0]?.publicationDate ?? null);
  push(ledger.decisions, "court and BALCA decisions", "#decisions", feed.decisions[0]?.publicationDate ?? null);
  push(ledger.bills, "bills in Congress", "#congress", feed.bills[0] ? (feed.bills[0].dates ?? feed.bills[0].publicationDate) : null);
  const earlier = strip.earlierRegister + strip.earlierAnnouncements;
  const coming = [...feed.filed, ...feed.signed];
  const empty = feed.register.length === 0 && feed.announcements.length === 0 && coming.length === 0;
  // The search box's parts; its documents load when someone uses it (src/lib/policySearch.ts).
  const facets = policyFacets(policySearchItems(feed, today));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
        Policy changes, on the record
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-soft">
        Every rule, notice, presidential action, bill and court decision on
        PERM, prevailing wages, H-1B, H-2A, H-2B and green cards, from the
        White House, the Federal Register, Congress, the courts, USCIS, DOL,
        OFLC and the State Department, read from each source as often as it
        allows.
      </p>{" "}

      {empty ? (
        <p className="mt-10 bg-tint p-5 text-base border-2 border-border">
          No documents are held yet. The feed reads the Federal Register every
          morning; until it has run, the Register&apos;s own search is at{" "}
          <a href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22labor+certification%22" className={LINK} rel="noopener" target="_blank">federalregister.gov</a>.
        </p>
      ) : (
        <>
          <RecordStrip record={record} label="Policies recorded" />{" "}

          <RulePipeline rules={pipeline.rules} today={today} comments={comments} />{" "}

          <section className="mt-12" id="coming">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Coming next</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
              Filed for public inspection, which the Register does the business day
              before it publishes, and actions the White House has signed that the
              Register hasn&apos;t published yet.
            </p>{" "}
            {coming.length > 0 ? (
              <div className="mt-6 border-2 border-border bg-card shadow-hard-sm">
                {coming.map((d) => (
                  <DocRow key={d.documentNumber} doc={d} today={today} />
                ))}
              </div>
            ) : (
              <p className="mt-4 bg-tint p-4 text-base border-2 border-border">
                Nothing from these agencies is on public inspection or waiting to be
                published right now.
              </p>
            )}
          </section>{" "}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">The last twelve months</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
              One mark per document, on the day it was published. The bar under a
              proposed rule is its comment window, lime while it is open.
            </p>{" "}
            <PolicyStrip strip={strip} />{" "}
            <StripLegend />{" "}
            {earlier > 0 ? (
              <p className="mt-3 tabular-nums text-sm text-muted-foreground">
                {earlier} earlier {earlier === 1 ? "document is" : "documents are"} in the lists below.
              </p>
            ) : null}
          </section>{" "}

          <PolicySearch facets={facets}>
          <section className="mt-12" id="register">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">In the Federal Register</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
              {feed.register.length} {feed.register.length === 1 ? "document" : "documents"}
              {ledger.earliest ? ` since ${monthYear(ledger.earliest)}` : ""}, presidential ones included. Open one to
              see the abstract, the effective date and a link to the published document.
            </p>{" "}
            <div className="mt-6 border-2 border-border bg-card shadow-hard-sm">
              {feed.register.map((d) => (
                <DocRow key={d.documentNumber} doc={d} today={today} comments={comments.get(d.documentNumber)} />
              ))}
            </div>
          </section>{" "}

          <section className="mt-12" id="agencies">
            <span id="oflc" aria-hidden="true" />
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">From the agencies</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
              {feed.announcements.length} announcements from USCIS&apos;s newsroom and
              Policy Manual, DOL&apos;s newsroom, OFLC, the State Department&apos;s visa news,
              and White House actions the Federal Register hasn&apos;t printed
              {ledger.announcementsSince ? `, back to ${ledger.announcementsSince.slice(0, 4)}` : ""}. A change
              often appears here before it reaches the Federal Register.
            </p>{" "}
            <OflcArchive items={feed.announcements} today={today} />
          </section>{" "}

          {feed.decisions.length > 0 ? (
            <section className="mt-12" id="decisions">
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">From the courts and BALCA</h2>{" "}
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
                {feed.decisions.length} federal court opinions and decisions of DOL&apos;s Board of Alien Labor
                Certification Appeals on these programs, newest first. A person named in a case is shown by initials.
              </p>{" "}
              <OflcArchive items={feed.decisions} today={today} lead={6} />
            </section>
          ) : null}{" "}

          {feed.bills.length > 0 ? (
            <section className="mt-12" id="congress">
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">In Congress</h2>{" "}
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
                {feed.bills.length} {feed.bills.length === 1 ? "bill" : "bills"} whose titles name a work visa
                or an employment-based green card, newest action first. Each one&apos;s latest action
                says where it stands.
              </p>{" "}
              <div className="mt-6 border-2 border-border bg-card shadow-hard-sm">
                {feed.bills.map((d) => (
                  <DocRow key={d.documentNumber} doc={d} today={today} />
                ))}
              </div>
            </section>
          ) : null}
          </PolicySearch>{" "}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">How documents are selected</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
              By rule, not by judgement. A document that is missing was not
              matched, which is different from not mattering.
            </p>{" "}
            <FinePrint summary="The selection rules in full" className="mt-3 max-w-3xl">
              <p>
                Federal Register documents from USCIS, DHS, the State Department,
                DOL or the President that match one of eleven terms: labor
                certification, prevailing wage, H-1B, H-2A, H-2B, CW-1, I-140,
                adjustment of status, visa bulletin, EB-5, premium processing.
                Documents from DOL outside its Employment and Training
                Administration, and the President&apos;s, must also name an
                immigration subject. Dropped by rule: the Unified Agenda omnibus
                notices, paperwork notices that name no form this site is about,
                and agency housekeeping such as board appointments and meeting
                notices. A correction is folded into the document it corrects.
              </p>{" "}
              <p className="mt-3">
                Public inspection filings are kept by the same rules, judged on the
                title, and followed until the Register publishes them. White House
                actions are kept when the title names an immigration subject or the
                text names a work visa at least three times, and are replaced by the
                Register&apos;s document once it&apos;s published. USCIS and DOL
                announcements are kept when they touch work-based immigration; every
                OFLC announcement is listed. Bills and joint resolutions in the
                current Congress are kept when the title names a work visa or an
                employment-based green card. Federal court opinions come from
                CourtListener when the passage that matched names labor
                certification, H-1B, H-2A, H-2B, I-140, ETA 9089, an
                employment-based category or the visa bulletin, from federal courts
                only; criminal cases and petitions for review of removal orders are
                left out. BALCA&apos;s decisions are OALJ&apos;s own lists: every en
                banc PERM decision, and prevailing wage, H-2A and H-2B appeals
                decided since October 2024. A person named in a case is shown by
                initials. The comment count beside an open
                proposed rule is regulations.gov&apos;s count of comments posted,
                which trails what people have sent while the agency screens them.
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

      <DataProvenance
        datasets={[
          "rule-pipeline",
          "rule-pipeline-agenda",
          "policy-notices",
          "policy-notices-pi",
          "policy-notices-wh",
          "policy-notices-uscis",
          "policy-notices-uscis-pm",
          "policy-notices-state",
          "policy-notices-dol",
          "policy-notices-oflc",
          "policy-notices-congress",
          "policy-comments",
          "policy-notices-courts",
          "policy-notices-balca",
        ]}
      />

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
