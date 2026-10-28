import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Fragment } from "react";

import { STEP_HREF } from "@/components/tools/planner/PlanTimeline";
import { aboutMonths } from "@/lib/board";
import { getPlanReading } from "@/lib/db/planFigures";
import { formatInt } from "@/lib/format";
import { journeySteps, type JourneyStep } from "@/lib/journey";
import { calculateGreenCardFees, FEE_SCHEDULE } from "@/lib/perm";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";
import { easternDay } from "@convex/lib/time";

/** The bulletin wait's share of the strip: it has no length to scale, so it takes a fixed share and says why. */
const VISA_SHARE = 16;
/** A step whose length couldn't be read today still shows, at this share, hatched. */
const UNREAD_SHARE = 4;

/** Steps still to come are the planner's yellow; the bulletin wait is its blue (the planner's own key). */
const fillOf = (s: JourneyStep) =>
  s.key === "visa" ? "bg-chart-blue" : s.days === null ? "bg-background bg-hatch" : "bg-chart-yellow";
const tileOf = (s: JourneyStep) =>
  s.key === "visa" ? "border-data-info-ink bg-chart-blue" : "border-data-warn bg-chart-yellow";

const money = (n: number) => `$${formatInt(n)}`;
const sentenceStart = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/**
 * The whole road to a green card, live, for the guide that walks it: one strip where each step is
 * as wide as it takes today, then each step's length, government fee and live page. The lengths
 * are the planner's own (`getPlanReading`); the fees are USCIS's fee schedule for one person filing
 * inside the US with a work permit and a travel document, the planner's default.
 */
export async function JourneyNow() {
  const reading = await getPlanReading().catch((err: unknown) => {
    // The guide still reads without the figures; each step then says it wasn't read.
    console.error("[journeyNow] plan figures unreadable", err);
    return null;
  });
  const spans = reading?.figures.spans;
  const fees = calculateGreenCardFees({ petitioner: "regular", adults: 1, workPermits: 1, travelDocuments: 1 });
  const steps = journeySteps(
    {
      pwd: spans?.pwd?.mid ?? null,
      recruitment: spans?.recruitment?.mid ?? null,
      perm: spans?.perm?.mid ?? null,
      i140: spans?.i140.EB2?.mid ?? null,
      i485: spans?.i485?.mid ?? null,
    },
    fees,
  );
  const measured = steps.reduce((sum, s) => sum + (s.days ?? 0), 0);
  const unread = steps.filter((s) => s.days === null && s.key !== "visa").length;
  const room = 100 - VISA_SHARE - unread * UNREAD_SHARE;
  const widthOf = (s: JourneyStep) =>
    s.key === "visa" ? VISA_SHARE : s.days === null || measured === 0 ? UNREAD_SHARE : (s.days / measured) * room;

  return (
    <figure className="not-prose my-8">
      <div aria-hidden="true" className="flex h-12 w-full border-2 border-foreground">
        {steps.map((s, i) => (
          <Fragment key={s.key}>
            <span
              className={cn("grid h-full place-items-center border-r-2 border-foreground font-heading text-sm font-bold text-black last:border-r-0", fillOf(s))}
              style={{ width: `${widthOf(s)}%` }}
            >
              {i + 1}
            </span>{" "}
          </Fragment>
        ))}
      </div>{" "}
      <div className="mt-3 text-base">
        {measured > 0 ? (
          <>
            <b className="font-heading text-lg font-bold">{sentenceStart(aboutMonths(measured))}</b> of steps at today&apos;s
            pace, plus your wait in the visa bulletin.
          </>
        ) : (
          <>The steps&apos; lengths couldn&apos;t be read today; each step&apos;s own page carries its figure.</>
        )}
      </div>{" "}
      {/* A list by role, not <ol>: an article's unlayered list padding reaches inside not-prose. */}
      <div role="list" className="mt-5 divide-y-2 divide-border border-y-2 border-border">
        {steps.map((s, i) => (
          <Fragment key={s.key}>
            {" "}
            <div role="listitem" className="grid grid-cols-1 gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,14rem)] sm:items-baseline [&>*]:min-w-0">
              <div className="flex items-baseline gap-3">
                <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center self-center border-2 font-heading text-sm font-bold text-black", tileOf(s))}>
                  {i + 1}
                </span>{" "}
                <span>
                  <Link href={STEP_HREF[s.key]} className="link inline-flex min-h-11 items-center gap-1 font-heading text-lg font-bold sm:min-h-0">
                    {s.name} <ArrowRightIcon aria-hidden="true" weight="bold" className="size-4" />
                  </Link>{" "}
                  <span className="block text-sm text-soft">{s.who}</span>
                </span>
              </div>{" "}
              {/* Length and fee side by side on a phone, their own columns from sm. Blocks, not paragraphs: an
                  article's unlayered paragraph margins reach inside not-prose. */}
              <div className="grid grid-cols-2 gap-4 pl-10 sm:contents [&>*]:min-w-0">
                <div className="font-heading text-lg font-bold">{s.length}</div>{" "}
                <div>
                  <span className={cn("font-bold", s.fee ? "font-mono text-base tabular-nums" : "text-base")}>{s.fee ? money(s.fee) : "No fee"}</span>{" "}
                  {s.feeNote ? <span className="block text-sm text-soft">{s.feeNote}</span> : null}
                </div>
              </div>
            </div>
          </Fragment>
        ))}
      </div>{" "}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="text-base font-semibold">Government fees for one person, the whole way</span>{" "}
        <span className="font-mono text-2xl font-bold tabular-nums">{money(fees.total)}</span>
      </div>{" "}
      <figcaption className="mt-3 text-sm leading-relaxed text-soft">
        {`Lengths from DOL's and USCIS's own records, read ${longDate(easternDay()) ?? "today"}; fees from USCIS's fee schedule, edition ${FEE_SCHEDULE.edition}, for one adult filing inside the US with a work permit and a travel document, sponsored by an employer of 26 or more. The PERM's own costs, its attorney and ads included, are the employer's by law (20 CFR 656.12(b)). `}
        <Link href="/tools/green-card-timeline" className="link">
          Date every step for your own case
        </Link>
        .
      </figcaption>
    </figure>
  );
}
