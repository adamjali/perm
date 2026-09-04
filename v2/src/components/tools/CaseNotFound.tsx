import Link from "next/link";
import { Fragment } from "react";

import { FigurePlate } from "@/components/tools/FigurePlate";
import { InsightLede } from "@/components/tools/Insight";
import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { CaseNumberPlate } from "@/components/tools/CaseNumberPlate";
import { CaseWall, CohortNeighbours } from "@/components/tools/CaseWall";
import { WontSay } from "@/components/tools/CaseStatusResult";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import type { CohortMonth } from "@/lib/liveQueue";
import type { Wall } from "@/lib/casePosition";
import type { ParsedCaseNumber } from "@/lib/permCaseNumber";
import { CASE_NUMBER_ACCURACY } from "@/lib/permCaseNumber";
import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";

/**
 * A case number we hold no record for. A real state, not an error.
 *
 * THE WHOLE DESIGN PROBLEM IS ONE OF ATTRIBUTION. The filing month decodes
 * from the number itself, so the cohort around it can be shown even when the
 * case cannot be found, and a cohort figure sitting under somebody's own
 * case number reads as a figure about their case unless every single line
 * says otherwise. So nothing here is phrased as "your case", the heading
 * says what the numbers are about, and the first thing on the page is the
 * plain statement that the case was not found.
 *
 * WHY IT HAPPENS, and the page says so rather than implying a problem: the
 * per-case data starts at filings from mid-2023, DOL's decided files cover
 * FY2024 onward, and a case filed in the last few days may simply not have
 * been picked up yet. None of those are anything wrong with the case.
 */

const int = (n: number) => n.toLocaleString("en-US");

export interface CaseNotFoundProps {
  caseNumber: string;
  /** Decoded from the number, when it decodes at all. */
  parsed: ParsedCaseNumber | null;
  /**
   * The legacy three-segment form, which carries no readable filing date.
   *
   * The two formats diverge here and the page has to as well. A current-format
   * number we cannot find still yields a filing month, so the cohort around it
   * is real context. A legacy one yields nothing, and showing a month anyway
   * would mean guessing: reading its middle block as a date is right 13.4% of
   * the time against 90.5% for the current format.
   */
  isLegacy?: boolean;
  cohort: CohortMonth | null;
  wall: Wall | null;
  neighbours: readonly CohortMonth[];
  publishedFront: string | null;
  publishedAsOf: string | null;
  mirrorSize: number | null;
}

export function CaseNotFound({
  caseNumber,
  parsed,
  isLegacy = false,
  cohort,
  wall,
  neighbours,
  publishedFront,
  publishedAsOf,
  mirrorSize,
}: CaseNotFoundProps) {
  return (
    <div>
      <InsightLede
        verdict="Not in our records"
        direction="flat"
        source={
          mirrorSize
            ? `Checked ${int(mirrorSize)} per-case statuses and DOL's FY2024 to FY2026 decided files, then asked DOL directly`
            : undefined
        }
      >
        We hold no record for{" "}
        <b className="font-mono text-primary-on-ink">{caseNumber}</b>. That is
        not a statement about the case. It means this project has not got it,
        and{" "}
        {/* THE CASE-STATUS SEARCH, NOT THE PROCESSING-TIMES PAGE. The link
            says "DOL's own system" is the authority on THIS NUMBER, and sent
            the reader to a page of queue averages that cannot look a case up
            at all. The wage-request and LCA equivalents already used the right
            one; the PERM pair did not. */}
        <a
          href={DOL_CASE_STATUS_URL}
          rel="noopener noreferrer"
          className="underline underline-offset-4 decoration-2"
        >
          DOL&apos;s own case-status search
        </a>{" "}
        is the authority either way.
      </InsightLede>

      <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black">
          Three reasons a real case is missing here
        </h2>{" "}
        <ul className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-foreground/80">
          <li>
            <b className="font-bold text-foreground">DOL doesn&apos;t return it.</b>{" "}
            A number we don&apos;t already hold is asked of DOL directly, at the
            moment you search, so a filing from this week resolves. If DOL&apos;s
            own system has no exact match, neither do we.
          </li>{" "}
          <li>
            <b className="font-bold text-foreground">It was filed before mid-2023.</b>{" "}
            The per-case status data does not reach further back than that, and
            DOL&apos;s published decision files start at fiscal year 2024.
          </li>{" "}
          <li>
            <b className="font-bold text-foreground">
              A digit is off.
            </b>{" "}
            The shape is right, so it got this far, and one wrong digit in the
            serial is still a well-formed case number that belongs to nobody.
            Worth checking against the receipt.
          </li>
        </ul>
      </section>

      {isLegacy ? (
        <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-xl font-black">
            This is the older case-number format
          </h2>{" "}
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
            Numbers like{" "}
            <b className="font-mono font-bold text-foreground">{caseNumber}</b>{" "}
            have three parts rather than four, and DOL used them mostly in 2022
            and 2023. The current format states its own filing date in the
            middle digits. This one does not: reading its middle block as a
            date matches DOL&apos;s recorded receipt date{" "}
            <b className="font-bold text-foreground">13% of the time</b>, against
            90% for the current format, so whatever those digits are they are
            not the filing date.
          </p>{" "}
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
            So there is no filing month to read off it and no cohort to show
            around it. Every case in this format has already been decided, and
            DOL publishes those in its quarterly files, so a number that is
            genuinely one of them will be found here. Worth checking the digits
            against the receipt.
          </p>
        </section>
      ) : null}{" "}
      {parsed ? (
        <section className="mt-8">
          <CaseNumberPlate parsed={parsed} />{" "}
          <p className="mt-3 text-sm text-muted-foreground">
            {CASE_NUMBER_ACCURACY}
          </p>
        </section>
      ) : null}

      {/* A number in the current format that we cannot find is usually a
          recent filing, which is exactly the case worth watching. Legacy
          numbers are all decided, so they get nothing. */}
      {!isLegacy ? (
        <CaseAlertForm caseNumber={caseNumber} className="mt-8" />
      ) : null}{" "}
      {parsed && cohort ? (
        <section className="mt-12">
          {/* The heading carries the attribution, not a footnote under the
              chart. Everything in this section is about a month, and a
              reader who only reads headings must still not come away
              thinking any of it was measured on their case. */}
          <h2 className="font-heading text-2xl font-black">
            Cases filed in {formatMonth(cohort.month)}
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
            The number decodes to a filing month, so here is what DOL is
            holding from that month.{" "}
            <b className="font-bold text-foreground">
              None of this was measured on {caseNumber}
            </b>
            , which we could not find. It describes the {int(cohort.total)}{" "}
            cases we do hold that were filed alongside it.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Cell
              label="Filed that month"
              value={int(cohort.total)}
              note="cases in the mirror"
            />
            <Cell
              label="Still undecided"
              value={int(cohort.pending)}
              note={
                cohort.decidedPct !== null
                  ? `${cohort.decidedPct.toFixed(1)}% of the month is decided`
                  : "of that month"
              }
            />
            {wall && !wall.isPastFront ? (
              <Cell
                label="Filed before that month"
                value={int(wall.ahead)}
                note="undecided, across every earlier month"
              />
            ) : null}
          </div>

          {wall && !wall.isPastFront ? (
            <FigurePlate
              n="01"
              title="The wall in front of that filing month"
              subject="Undecided cases by filing month"
              className="mt-6"
              caption={
                <>
                  Drawn for {formatMonth(cohort.month)}, the month this number
                  decodes to. It is the queue in front of that month rather
                  than in front of any one case.
                </>
              }
              source={
                publishedAsOf
                  ? `Per-case statuses via a third-party mirror of DOL's FLAG · DOL queue position as of ${formatAsOf(publishedAsOf)}`
                  : "Per-case statuses via a third-party mirror of DOL's FLAG"
              }
            >
              {/* Not "Yours": the case was not found, so this column is the
                  month the NUMBER decodes to and nothing more. */}
              <CaseWall
                wall={wall}
                publishedFront={publishedFront}
                attribution="month"
              />
            </FigurePlate>
          ) : null}

          {neighbours.length > 1 ? (
            <CohortNeighbours
              months={neighbours}
              subjectMonth={cohort.month}
              attribution="month"
              className="mt-6"
            />
          ) : null}

          <p className="mt-5 text-sm text-muted-foreground">
            <Link
              href={`/perm-queue/${cohort.month}`}
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              The full split for {formatMonth(cohort.month)}
            </Link>{" "}
            ·{" "}
            <Link
              href="/perm-processing-times"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              Get told when DOL reaches that month
            </Link>
          </p>
        </section>
      ) : null}

      {" "}
      <WontSay isFinal={false} />
    </div>
  );
}

function Cell({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-w-0 flex-1 basis-56 border-2 border-border bg-background p-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>{" "}
      <p className="mt-1 font-heading text-4xl font-black leading-none tabular-nums">
        {value}
      </p>{" "}
      <p className="mt-1.5 text-sm leading-snug text-foreground/70">{note}</p>
    </div>
  );
}

/**
 * The page with nothing typed in yet.
 *
 * An empty screen is an invitation to act, and it is also the version of this
 * page that search engines index, so it states what the tool does and what
 * the queue looks like today rather than rendering a bare input.
 */
export function CaseStatusEmpty({
  front,
  wallTotal,
  publishedFront,
  publishedAsOf,
  mirrorSize,
}: {
  front: string | null;
  wallTotal: number | null;
  publishedFront: string | null;
  publishedAsOf: string | null;
  mirrorSize: number | null;
}) {
  const facts: { label: string; value: string; note: string }[] = [];
  if (front) {
    facts.push({
      label: "DOL is working",
      value: formatMonth(front) ?? front,
      note: "the oldest filing month not substantially decided",
    });
  }
  if (wallTotal !== null) {
    facts.push({
      label: "Undecided cases",
      value: int(wallTotal),
      note: "across every filing month, the whole wall",
    });
  }
  if (publishedFront && publishedFront !== front) {
    facts.push({
      label: "DOL's published position",
      value: formatMonth(publishedFront) ?? publishedFront,
      note: publishedAsOf ? `as of ${formatAsOf(publishedAsOf)}` : "analyst review",
    });
  }

  return (
    <div>
      {facts.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {facts.map((f) => (
            <Fragment key={f.label}>{" "}
            <Cell label={f.label} value={f.value} note={f.note} />
            </Fragment>
          ))}
        </div>
      ) : null}{" "}
      <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black">
          What a case number gets you here
        </h2>{" "}
        <ul className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-foreground/80">
          <li>
            <b className="font-bold text-foreground">The status, decoded.</b>{" "}
            DOL shows one word and explains none of them. Some mean waiting and
            some mean a 30-day clock is running on the employer, and the
            difference is worth knowing.
          </li>{" "}
          <li>
            <b className="font-bold text-foreground">The position.</b> How many
            undecided cases were filed before it, how far its filing month sits
            behind the month DOL is working, and how the queue in between is
            stacked.
          </li>{" "}
          <li>
            <b className="font-bold text-foreground">The employer&apos;s record.</b>{" "}
            Every decided case DOL published for that sponsor, with the counts
            rather than a score.
          </li>{" "}
          <li>
            <b className="font-bold text-foreground">
              For a decided case, DOL&apos;s own file.
            </b>{" "}
            The outcome, the days it took, the offered wage against its
            occupation, and the worksite state.
          </li>
        </ul>
        {mirrorSize ? (
          <p className="mt-5 border-t-2 border-border pt-4 text-sm text-muted-foreground">
            Searched against {int(mirrorSize)} per-case statuses, read from DOL&apos;s own case-status search, plus DOL&apos;s published decisions for FY2024 to FY2026.
            Nothing is stored and nothing is sent anywhere else.
          </p>
        ) : null}
      </section>
    </div>
  );
}
