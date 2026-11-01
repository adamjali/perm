import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseIcon, CurrencyDollarIcon, ProhibitIcon, ScalesIcon } from "@phosphor-icons/react/ssr";

import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { ActionList } from "@/components/enforcement/ActionList";
import { CLOUDERA, ClouderaTrack } from "@/components/enforcement/ClouderaTrack";
import { EnforcementTimeline } from "@/components/enforcement/EnforcementTimeline";
import { getSponsorRecords } from "@/lib/db/sponsorRecords";
import {
  ENFORCEMENT_ACTIONS,
  ENFORCEMENT_CHECKED,
  SETTLEMENTS,
  enforcementTotals,
} from "@/lib/enforcement/actions";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { shortDate } from "@convex/lib/months";

/**
 * Settlements and suspensions: what the Justice and Labor Departments did to work-visa sponsors since
 * June 2025, each beside what DOL's own record shows for the company. The actions are a hand-kept list read
 * from each agreement and release (src/lib/enforcement/actions.ts); the record is read live.
 */

const TITLE = "Visa Sponsor Settlements and Suspensions";
const DESCRIPTION =
  "Every Justice Department settlement with an H-1B, H-2A or PERM sponsor since June 2025, DOL's suspension of Cloudera, and what DOL's record shows for each.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/debarments/settlements" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/debarments/settlements" },
}, "settlements");

// The actions change when one is added by hand; the record beside them moves with the daily sweep.
export const revalidate = 86400;

const money = (n: number) => `$${formatInt(n)}`;
/** Whole months from one day to another, "2025-01-15" to "2026-10-13" being 20. */
function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

export default async function SettlementsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const totals = enforcementTotals();
  const announcedOn = new Map<string, string>();
  for (const a of ENFORCEMENT_ACTIONS) {
    for (const slug of a.pages ?? []) {
      const day = a.announced ?? a.date;
      // The newest action's day for each company: what it has filed since it was last in the news.
      if (!announcedOn.has(slug) || day > announcedOn.get(slug)!) announcedOn.set(slug, day);
    }
  }
  const records = await getSponsorRecords([...announcedOn.keys()], (s) => announcedOn.get(s)!);
  const perm = SETTLEMENTS.filter((a) => a.program === "PERM");
  const barred = SETTLEMENTS.filter((a) => a.bar?.months);
  const clouderaLast = records.get("cloudera-inc")?.lastPerm ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">When the government acts against a sponsor</h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-soft">
        Settlements, a lawsuit and a suspension from the Justice and Labor Departments, each set beside what
        DOL&apos;s own case record shows for the company. DOL&apos;s{" "}
        <Link href="/debarments" className="link">
          debarment lists
        </Link>{" "}
        show none of them.
      </p>{" "}

      <FigureRow className="mt-8">
        <Figure
          icon={<ScalesIcon className="size-5" aria-hidden="true" />}
          label="Settlements"
          value={formatInt(totals.settlements)}
          note={`${shortDate(totals.first)} to ${shortDate(totals.newest)}`}
        />
        <Figure
          icon={<BriefcaseIcon className="size-5" aria-hidden="true" />}
          label="About PERM recruitment"
          value={formatInt(totals.perm)}
          note={`All since ${shortDate(perm[0]?.date ?? totals.newest)}`}
          tone="lime"
        />
        <Figure
          icon={<CurrencyDollarIcon className="size-5" aria-hidden="true" />}
          label="Civil penalties"
          value={money(totals.penalties)}
          note={`And ${money(totals.backPay)} for workers`}
        />
        <Figure
          icon={<ProhibitIcon className="size-5" aria-hidden="true" />}
          label="Barred from PERM"
          value={formatInt(barred.length)}
          note={barred.map((a) => `${a.company.replace(/,? Inc\.?$/, "")}, for ${a.bar?.months} months`).join("; ")}
          tone="ink"
        />
      </FigureRow>{" "}

      <section className="mt-12" aria-labelledby="when">
        <h2 id="when" className="font-heading text-2xl font-bold sm:text-3xl">
          Every settlement, by day
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-soft">
          The first twelve were about job ads and job orders that shut out U.S. workers. Since August 2026
          they&apos;re about PERM recruitment: openings left off the company&apos;s own site, and applications
          asked for by mail or sent to an address that couldn&apos;t receive them.
        </p>{" "}
        <EnforcementTimeline actions={ENFORCEMENT_ACTIONS} today={today} />
      </section>{" "}

      <section className="mt-14" aria-labelledby="cloudera">
        <h2 id="cloudera" className="font-heading text-2xl font-bold sm:text-3xl">
          Cloudera, the one barred from PERM
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-soft">
          It agreed to file no PERM application for 24 months.{" "}
          {clouderaLast
            ? `Its last one in DOL's record is ${shortDate(clouderaLast)}, ${formatInt(monthsBetween(clouderaLast, CLOUDERA.settled))} months before the settlement.`
            : null}
        </p>{" "}
        <div className="mt-6 border-2 border-border bg-card p-5 sm:p-6">
          <ClouderaTrack lastPerm={clouderaLast} today={today} />
        </div>
      </section>{" "}

      <section className="mt-14" aria-labelledby="all">
        <h2 id="all" className="font-heading text-2xl font-bold sm:text-3xl">
          Each action, and DOL&apos;s record beside it
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-soft">
          Newest first. The record is DOL&apos;s live case data for the company&apos;s page here; LCAs are
          counted from the day the action was announced. Nothing in these agreements stops a company filing
          LCAs: the one bar on filing, Cloudera&apos;s, covers PERM alone.
        </p>{" "}
        <ActionList actions={ENFORCEMENT_ACTIONS} records={records} />
      </section>{" "}

      <section className="mt-14 max-w-3xl" aria-labelledby="notes">
        <h2 id="notes" className="font-heading text-xl font-bold sm:text-2xl">
          How this list is kept
        </h2>{" "}
        <FinePrint summary="Sources, counting and what isn't here" className="mt-3">
          <p>
            Each settlement was read in its own agreement, linked from the Justice Department&apos;s list of
            its Immigrant and Employee Rights Section settlements, and in DOJ&apos;s release where there is
            one; DOL&apos;s Cloudera suspension in DOL&apos;s release of May 12, 2026. Checked against both
            lists on {shortDate(ENFORCEMENT_CHECKED)}.
          </p>{" "}
          <p>
            DOJ numbers nine of these in its releases as the 1st through the 15th of its settlements
            protecting U.S. workers. Six have no release; their places are worked out from the dates on
            DOJ&apos;s list and the counts its releases give.
          </p>{" "}
          <p>
            A company links to its page here only when the name on the agreement is the page&apos;s, and its
            state matches. Instacart (Maplebear) and OpenAI (with Statsig) each have two pages.
          </p>{" "}
          <p>
            DOL&apos;s debarment lists hold formal notices under 20 C.F.R. 656.31(f). Cloudera&apos;s 24
            months are a promise in its settlement, and it isn&apos;t on them. Settlements about document
            demands on non-citizens (Whirlpool, among others) are left out: they aren&apos;t about visa
            sponsorship.
          </p>
        </FinePrint>
      </section>
    </div>
  );
}
