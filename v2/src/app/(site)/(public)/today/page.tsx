import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import {
  Balance,
  BulletinGrid,
  DecidedBar,
  Station,
  StatusTiles,
  Track,
  WaitBar,
} from "@/components/board/BoardParts";
import { BulletinStation, type BulletinLine } from "@/components/board/BulletinStation";
import { StagePicker, type StageCard } from "@/components/board/StagePicker";
import { DecisionsOverTime } from "@/components/pulse/DecisionsOverTime";
import { buttonVariants } from "@/components/ui/button";
import {
  aboutMonths,
  backlogStatus,
  bulletinMoves,
  bulletinShift,
  bulletinStatus,
  lineFlow,
  medianShift,
  paceStatus,
  positionShift,
  rulerOf,
  waitScaleDays,
  type StatusMove,
} from "@/lib/board";
import { cutoffLabel } from "@/lib/bulletinNext";
import { DECISION_SPANS } from "@/lib/pulseStats";
import { getPermBoard, getPwdBoard } from "@/lib/db/board";
import { getLiveCensus } from "@/lib/db/liveCensus";
import { getVisaBulletins } from "@/lib/db/publicData";
import { getObservedDays } from "@/lib/db/pulse";
import { getSweepCoverage } from "@/lib/db/sweepCoverage";
import { getUscisFormHistory, getUscisFormMedian } from "@/lib/db/uscisQuarterly";
import { parseCutoff, type BulletinMonth, type CountryKey } from "@/lib/perm";
import { GROUPS, SECTIONS } from "@/lib/siteMap";
import { withSocialCard } from "@/lib/socialCard";
import { cn } from "@/lib/utils";
import { checkedLabel } from "@/lib/time";
import { monthDay, monthYear, shiftMonth, shortDate } from "@convex/lib/months";

/**
 * Where every step stands today: one page that gathers the answer each data
 * page gives, step by step, with a link to each (owner, Oct 27 2026: keep
 * every page, and add one place with everything). Every answer is a picture
 * first (owner, Oct 27: "visual heavy, not text blobs").
 *
 * Expired by the sweep (/api/revalidate-sweep), DOL's readings
 * (/api/revalidate-dol) and the bulletin (/api/revalidate-bulletin).
 */
export const revalidate = 21600;

export const metadata: Metadata = withSocialCard(
  {
    title: { absolute: "Where Every Green Card Step Stands Today | PERM Tracker" },
    description:
      "The wage request, PERM, I-140 and visa bulletin on one page: where DOL and the State Department are, whether each line is growing, and what moved today.",
    alternates: { canonical: "/today" },
  },
  "today",
);

const WAITING = [
  "ANALYST REVIEW",
  "APPLICATION ON HOLD",
  "RFI ISSUED",
  "RECONSIDERATION APPEALS",
  "BALCA APPEALS",
  "NORD ISSUED",
  "PENDING AUDIT RESPONSE",
];
const DECIDED = ["CERTIFIED", "DENIED", "WITHDRAWN"];
/** Days of decisions read for the 30, 90 and 180-day views, with a week's margin for the first whole week. */
const DECISION_DAYS = Math.max(...DECISION_SPANS) + 7;
// The archive keys categories as the bulletin codes them (EB2, EW3), not "EB-2".
const BULLETIN_CATEGORIES = ["EB1", "EB2", "EB3", "EW3"];
const BULLETIN_COUNTRIES: CountryKey[] = ["worldwide", "china", "india", "mexico", "philippines"];

export default async function TodayPage() {
  const [perm, pwd, census, observed, coverage, i140, bulletins, i485, i485History] = await Promise.all([
    getPermBoard().catch(() => null),
    getPwdBoard().catch(() => null),
    getLiveCensus().catch(() => null),
    getObservedDays(DECISION_DAYS).catch(() => []),
    getSweepCoverage().catch(() => null),
    getUscisFormHistory("I-140"),
    getVisaBulletins().catch(() => []),
    getUscisFormMedian("I-485", "Employment"),
    getUscisFormHistory("I-485"),
  ]);

  // How many PERM cases sit in each status now, from the census.
  const nowByStatus = new Map<string, number>();
  for (const r of census?.matrix ?? []) {
    const k = r.status.trim().toUpperCase();
    nowByStatus.set(k, (nowByStatus.get(k) ?? 0) + r.n);
  }
  const moveOf = (list: StatusMove[] | undefined, s: string) => list?.find((m) => m.status === s) ?? null;
  const waitingRows = WAITING.map((s) => ({
    status: s,
    now: census ? nowByStatus.get(s) ?? 0 : null,
    day: moveOf(perm?.movesDay, s),
    week: moveOf(perm?.movesWeek, s),
  })).filter((r) => (r.now ?? 0) > 0 || r.day || r.week);
  // A decided status counts what came into it: a certification lapsing isn't a decision undone.
  const decidedParts = DECIDED.map((s) => ({ status: s, n: moveOf(perm?.movesDay, s)?.in ?? 0 }));
  const decidedRows = DECIDED.map((s) => ({
    status: s,
    now: census ? nowByStatus.get(s) ?? 0 : null,
    day: moveOf(perm?.movesDay, s),
    week: moveOf(perm?.movesWeek, s),
  }));

  // The I-140's quarterly medians, newest last.
  const i140Points = i140
    .filter((p) => p.medianMonths !== null)
    .slice(-4)
    .map((p) => ({ key: `${p.fy}-${p.quarter}`, tick: `Q${p.quarter} ’${String(p.fy).slice(2)}`, value: p.medianMonths! }));
  const i140Now = i140Points.at(-1) ?? null;

  // The newest bulletin and the one before, as the archive holds them.
  const months: BulletinMonth[] = bulletins.map((b) => ({
    bulletinMonth: b.bulletinMonth,
    finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
    datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
  }));
  const latest = months.at(-1) ?? null;
  const previous = months.length > 1 ? months.at(-2)! : null;
  const moves = latest ? bulletinMoves(latest, previous, BULLETIN_CATEGORIES, BULLETIN_COUNTRIES) : [];
  const eb2 = moves.find((r) => r.category === "EB2")?.cells.find((c) => c.country === "worldwide") ?? null;
  const bulletinLabel = latest ? monthYear(latest.bulletinMonth) ?? latest.bulletinMonth : null;

  const pwdRuler = pwd?.span ? rulerOf(pwd.span, pwd.day) : null;
  const permRuler = perm?.span ? rulerOf(perm.span, perm.day) : null;
  const eb2Cut = latest ? parseCutoff(latest.finalAction["EB2"]?.worldwide) : null;
  const i140Days = i140Now ? Math.round(i140Now.value * 30.44) : null;
  // Every step's length on one scale, so the bars compare across the track.
  const scaleDays = waitScaleDays([pwdRuler?.waitedDays ?? 0, permRuler?.waitedDays ?? 0, i140Days ?? 0]);
  const dayLabel = perm ? monthDay(perm.day) ?? perm.day : "the last day";
  // Which way each step moved, coloured by direction.
  const pwdShift =
    pwd?.span && pwd.weekBefore?.span ? positionShift(pwd.weekBefore.span.middle, pwd.span.middle, monthDay(pwd.weekBefore.day) ?? pwd.weekBefore.day) : null;
  const permShift =
    perm?.span && perm.weekBefore?.span ? positionShift(perm.weekBefore.span.middle, perm.span.middle, monthDay(perm.weekBefore.day) ?? perm.weekBefore.day) : null;
  const i140Prev = i140Points.length > 1 ? i140Points.at(-2)! : null;
  const i140Shift = i140Now && i140Prev ? medianShift(i140Prev.value, i140Now.value, i140Prev.tick) : null;
  // Each step's state as a status board says it (Sabrina, Oct 27 2026: the backlog and retrogression marks).
  const pwdStatus = pwd ? backlogStatus(pwd.flow) : null;
  const permStatus = perm ? backlogStatus(perm.flow) : null;
  const i140Status = i140Now && i140Prev ? paceStatus(i140Prev.value, i140Now.value) : null;
  // Every line of the newest bulletin, for the station's category and country switch.
  const bulletinMonthName = latest ? (monthYear(latest.bulletinMonth)?.split(" ")[0] ?? "the newest bulletin") : "";
  const bulletinLines: BulletinLine[] = latest
    ? moves.flatMap((row) =>
        row.cells.map((cell) => {
          const cut = parseCutoff(latest.finalAction[row.category]?.[cell.country]);
          const filing = parseCutoff(latest.datesForFiling[row.category]?.[cell.country]);
          return {
            category: row.category,
            country: cell.country,
            finalAction: cell.latest,
            cutoffIso: cut?.kind === "date" ? cut.iso : null,
            datesForFiling: filing ? cutoffLabel(filing) : null,
            status: bulletinStatus(cell.kind),
            shift: bulletinShift(cell.kind, cell.movedDays, bulletinMonthName),
          };
        }),
      )
    : [];

  // USCIS's two lines as the same picture, from its quarterly received and completed counts
  // (Adam, Oct 27 2026: "why just those 2?"). USCIS publishes them once a quarter, so the
  // caption names the quarter rather than 30 days.
  const uscisLine = (row: (typeof i140)[number] | undefined) => {
    if (!row || row.received === null || row.completed === null) return null;
    const end = row.quarterEnd;
    const start = shiftMonth(end.slice(0, 7), -2);
    const words = `USCIS, ${monthYear(start)?.split(" ")[0] ?? start} to ${monthYear(end.slice(0, 7)) ?? end}`;
    return { flow: { ...lineFlow(row.received, row.completed), from: `${start}-01`, to: end }, period: words };
  };
  const i140Line = uscisLine(i140.filter((r) => r.received !== null).at(-1));
  const i485Line = uscisLine(i485History.filter((r) => /\(Employment\)/.test(r.title) && r.received !== null).at(-1));

  // Each step to a green card, picked one at a time (Sabrina, Oct 27 2026: "pick a stage is
  // nice"). How long each takes now comes from the same live figures as the track above.
  const stages: StageCard[] = [
    {
      key: "wage-request",
      name: "Wage request",
      who: "The employer, usually through its attorney",
      form: "ETA-9141, filed with DOL's National Prevailing Wage Center in FLAG",
      howLong: pwdRuler ? aboutMonths(pwdRuler.waitedDays) : "Not read yet",
      howLongNote: pwd && pwdRuler ? `Filed to decided, for DOL's middle decision on ${monthDay(pwd.day)}` : undefined,
      what: "DOL sets the lowest wage the job may offer, for its occupation and where the work is.",
      watch: "The determination is valid for 90 days to a year, and recruitment has to begin before it expires.",
      href: "/pwd-cases",
      linkLabel: "Wage requests now",
    },
    {
      key: "recruitment",
      name: "Recruitment",
      who: "The employer",
      form: "Nothing is filed: a state job order, two Sunday ads and a notice at the worksite, plus three more steps for a professional job",
      howLong: "About 2 months at the least",
      howLongNote: "A 30-day job order, then 30 days before the PERM can be filed",
      what: "The employer tests the job market for qualified US workers who are available.",
      watch: "File no sooner than 30 days after the last step and within 180 days of the first, or the steps have to be run again.",
      href: "/tools/perm-deadline-calculator",
      linkLabel: "Work out the deadlines",
    },
    {
      key: "perm",
      name: "PERM",
      who: "The employer, through its attorney",
      form: "ETA-9089, filed with DOL in FLAG",
      howLong: permRuler ? aboutMonths(permRuler.waitedDays) : "Not read yet",
      howLongNote: perm && permRuler ? `Filed to decided, for DOL's middle decision on ${monthDay(perm.day)}` : undefined,
      what: "A DOL analyst reviews the application and certifies or denies it, sometimes after asking for more: an audit or a request for information.",
      watch: "Cases wait in filing order. One put on hold, sent an RFI or under appeal leaves that order.",
      href: "/perm-queue",
      linkLabel: "Where the PERM line stands",
    },
    {
      key: "i140",
      name: "I-140",
      who: "The employer",
      form: "I-140, filed with USCIS with the certified ETA-9089",
      howLong: i140Now ? `${i140Now.value} months` : "Not read yet",
      howLongNote: i140Now ? `USCIS's median, ${i140Now.tick}. Premium processing is quicker, for a fee` : undefined,
      what: "USCIS checks that the worker meets the job's requirements and that the employer can pay the wage. The PERM's filing date becomes the priority date.",
      watch: "File within 180 days of the PERM's certification, or the certification expires.",
      href: "/uscis-processing-times",
      linkLabel: "USCIS processing times",
    },
    {
      key: "i485",
      name: "I-485",
      who: "The worker and their family, inside the US",
      form: "I-485, filed with USCIS once the priority date is current",
      howLong: i485 ? `${i485.medianMonths} months` : "Not read yet",
      howLongNote: i485 ? `USCIS's median for employment-based cases, Q${i485.quarter} ’${String(i485.fy).slice(2)}` : undefined,
      what: "USCIS decides the green card itself. A work permit and a travel document can come while it waits.",
      watch: "The visa bulletin decides the month you can file, from your category, country and priority date.",
      href: "/i485-by-field-office",
      linkLabel: "The I-485 by office",
    },
    {
      key: "green-card",
      name: "Green card",
      who: "USCIS approves it, once a visa number is free",
      form: "No new form: the I-485's approval",
      howLong: eb2Cut?.kind === "date" ? `Filed before ${shortDate(eb2Cut.iso)}` : eb2?.latest ?? "Not read yet",
      howLongNote: bulletinLabel ? `EB-2, rest of world, in the ${bulletinLabel} bulletin. Other lines differ` : undefined,
      what: "USCIS approves the I-485 once the priority date is earlier than the final action date for its line.",
      watch: "A cutoff can move back (retrogression), so a date that's current one month may not be the next.",
      href: "/visa-bulletin",
      linkLabel: "The visa bulletin",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Where every step stands today</h1>{" "}
        <p className="text-sm text-soft">
          From DOL, USCIS and the State Department{coverage?.checkedAt ? <>, checked {checkedLabel(coverage.checkedAt)}</> : null}
        </p>
      </header>{" "}
      <div className="mt-10">
        <Track steps={["Wage request", "PERM", "I-140", "Visa bulletin"]}>
          <Station
            step={1}
            name="Wage request"
            lead={pwd ? `DOL's middle decision on ${monthDay(pwd.day)} was filed` : "DOL's wage requests"}
            big={pwd?.span ? shortDate(pwd.span.middle) ?? pwd.span.middle : "Not read yet"}
            picture={
              pwdRuler && pwd?.span ? (
                <WaitBar
                  days={pwdRuler.waitedDays}
                  scaleDays={scaleDays}
                  from={<><b className="font-semibold text-foreground">{monthDay(pwd.span.middle)}</b> filed</>}
                  to={<><b className="font-semibold text-foreground">{monthDay(pwd.day)}</b> decided</>}
                  words={aboutMonths(pwdRuler.waitedDays)}
                  label={`A wage request DOL decided on ${monthDay(pwd.day)} had waited ${aboutMonths(pwdRuler.waitedDays)}`}
                />
              ) : null
            }
            shift={pwdShift}
            status={pwdStatus}
            href="/pwd-cases"
            linkLabel="Wage requests"
          />{" "}
          <Station
            step={2}
            name="PERM"
            lead={perm ? `DOL's middle decision on ${monthDay(perm.day)} was filed` : "DOL's PERM decisions"}
            big={perm?.span ? shortDate(perm.span.middle) ?? perm.span.middle : "Not read yet"}
            picture={
              permRuler && perm?.span ? (
                <WaitBar
                  days={permRuler.waitedDays}
                  scaleDays={scaleDays}
                  from={<><b className="font-semibold text-foreground">{monthDay(perm.span.middle)}</b> filed</>}
                  to={<><b className="font-semibold text-foreground">{monthDay(perm.day)}</b> decided</>}
                  words={aboutMonths(permRuler.waitedDays)}
                  label={`A PERM case DOL decided on ${monthDay(perm.day)} had waited ${aboutMonths(permRuler.waitedDays)}`}
                />
              ) : null
            }
            shift={permShift}
            status={permStatus}
            href="/perm-queue"
            linkLabel="Where the line stands"
          />{" "}
          <Station
            step={3}
            name="I-140"
            lead="USCIS's typical I-140 takes"
            big={i140Now ? `${i140Now.value} months` : "Not read yet"}
            picture={
              i140Days !== null && i140Now ? (
                <WaitBar
                  days={i140Days}
                  scaleDays={scaleDays}
                  from="filed"
                  to="decided"
                  words={`Median, ${i140Now.tick}`}
                  label={`USCIS's median I-140 time in ${i140Now.tick}: ${i140Now.value} months`}
                />
              ) : null
            }
            shift={i140Shift}
            status={i140Status}
            href="/uscis-processing-times"
            linkLabel="USCIS processing times"
          />{" "}
          {latest && bulletinLabel && bulletinLines.length ? (
            <BulletinStation step={4} lines={bulletinLines} bulletinMonth={latest.bulletinMonth} monthLabel={bulletinLabel} />
          ) : (
            <Station step={4} name="Visa bulletin" lead="The newest bulletin" big="Not read yet" picture={null} href="/visa-bulletin" linkLabel="The visa bulletin" />
          )}
        </Track>
      </div>{" "}
      <section aria-labelledby="steps" className="mt-16">
        <h2 id="steps" className="font-heading text-2xl font-bold">
          Pick a step
        </h2>{" "}
        <p className="mt-2 text-base text-soft">Who files it, where, and how long it takes right now.</p>{" "}
        <div className="mt-6">
          <StagePicker stages={stages} />
        </div>{" "}
        <Link href="/tools/green-card-timeline" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Date every step for your case <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
        </Link>
      </section>{" "}
      {pwd || perm ? (
        <section aria-labelledby="lines" className="mt-16">
          <h2 id="lines" className="font-heading text-2xl font-bold">
            Are the lines getting shorter?
          </h2>{" "}
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 [&>*]:min-w-0">
            {pwd ? <Balance name="Wage requests" flow={pwd.flow} href="/pwd-cases" /> : null}{" "}
            {perm ? <Balance name="PERM" flow={perm.flow} href="/perm-queue" /> : null}{" "}
            {i140Line ? (
              <Balance name="I-140" flow={i140Line.flow} period={i140Line.period} labels={["Received", "Completed"]} href="/uscis-processing-times" />
            ) : null}{" "}
            {i485Line ? (
              <Balance
                name="I-485, employment-based"
                flow={i485Line.flow}
                period={i485Line.period}
                labels={["Received", "Completed"]}
                href="/i485-by-field-office"
              />
            ) : null}
          </div>
        </section>
      ) : null}{" "}
      <section aria-labelledby="day" className="mt-16">
        <h2 id="day" className="font-heading text-2xl font-bold">
          PERM at DOL{perm ? <>, {dayLabel}</> : null}
        </h2>{" "}
        {perm ? (
          <div className="mt-6">
            <DecidedBar parts={decidedParts} dayLabel={dayLabel} />
          </div>
        ) : null}{" "}
        <h3 className="mt-10 font-heading text-lg font-bold">Still waiting</h3>{" "}
        <div className="mt-4">
          <StatusTiles rows={waitingRows} dayLabel={dayLabel} />
        </div>{" "}
        <h3 className="mt-10 font-heading text-lg font-bold">Decided, in our record</h3>{" "}
        <div className="mt-4">
          <StatusTiles rows={decidedRows} dayLabel={dayLabel} closed />
        </div>{" "}
        <h3 className="mt-12 font-heading text-lg font-bold">Decisions over time</h3>{" "}
        <div className="mt-4">
          <DecisionsOverTime days={observed} />
        </div>
      </section>{" "}
      {moves.length && bulletinLabel ? (
        <section aria-labelledby="bulletin" className="mt-16">
          <h2 id="bulletin" className="font-heading text-2xl font-bold">
            The {bulletinLabel} visa bulletin
          </h2>{" "}
          <div className="mt-6">
            <BulletinGrid rows={moves} monthLabel={bulletinLabel} />
          </div>
        </section>
      ) : null}{" "}
      <section aria-labelledby="pages" className="mt-16 border-t-2 border-border pt-10">
        <h2 id="pages" className="font-heading text-2xl font-bold">
          Every page, by topic
        </h2>{" "}
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-4 [&>*]:min-w-0">
          {GROUPS.map((g) => (
            <Fragment key={g}>
              {" "}
              <li>
              <h3 className="font-heading text-base font-bold">{g}</h3>{" "}
              <ul className="mt-1">
                {SECTIONS.filter((s) => s.group === g).map((s) => (
                  <Fragment key={s.href}>
                    {" "}
                    <li>
                      <Link href={s.href} className="link inline-flex min-h-11 items-center text-sm">
                        {s.label}
                      </Link>
                    </li>
                  </Fragment>
                ))}
              </ul>
              </li>
            </Fragment>
          ))}
        </ul>
      </section>
    </div>
  );
}
