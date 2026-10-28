import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import {
  Balance,
  BulletinGrid,
  CutoffLine,
  DecidedBar,
  Station,
  StatusTiles,
  Track,
  WaitBar,
} from "@/components/board/BoardParts";
import { PermPulse } from "@/components/pulse/PermPulse";
import {
  aboutMonths,
  bulletinMoves,
  bulletinShift,
  medianShift,
  positionShift,
  rulerOf,
  waitScaleDays,
  type StatusMove,
} from "@/lib/board";
import { cutoffLabel } from "@/lib/bulletinNext";
import { getPermBoard, getPwdBoard } from "@/lib/db/board";
import { getLiveCensus } from "@/lib/db/liveCensus";
import { getVisaBulletins } from "@/lib/db/publicData";
import { getObservedDays } from "@/lib/db/pulse";
import { getSweepCoverage } from "@/lib/db/sweepCoverage";
import { getUscisFormHistory } from "@/lib/db/uscisQuarterly";
import { parseCutoff, type BulletinMonth, type CountryKey } from "@/lib/perm";
import { GROUPS, SECTIONS } from "@/lib/siteMap";
import { withSocialCard } from "@/lib/socialCard";
import { checkedLabel } from "@/lib/time";
import { monthDay, monthYear, shortDate } from "@convex/lib/months";

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
// The archive keys categories as the bulletin codes them (EB2, EW3), not "EB-2".
const BULLETIN_CATEGORIES = ["EB1", "EB2", "EB3", "EW3"];
const BULLETIN_COUNTRIES: CountryKey[] = ["worldwide", "china", "india", "mexico", "philippines"];

export default async function TodayPage() {
  const [perm, pwd, census, observed, coverage, i140, bulletins] = await Promise.all([
    getPermBoard().catch(() => null),
    getPwdBoard().catch(() => null),
    getLiveCensus().catch(() => null),
    getObservedDays().catch(() => []),
    getSweepCoverage().catch(() => null),
    getUscisFormHistory("I-140"),
    getVisaBulletins().catch(() => []),
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
  const eb2Shift = eb2 && latest ? bulletinShift(eb2.kind, eb2.movedDays, monthYear(latest.bulletinMonth)?.split(" ")[0] ?? "the newest bulletin") : null;

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
            href="/uscis-processing-times"
            linkLabel="USCIS processing times"
          />{" "}
          <Station
            step={4}
            name="Visa bulletin"
            lead="EB-2, rest of world: current if filed before"
            big={eb2?.latest ?? (latest ? cutoffLabel(eb2Cut) : "Not read yet")}
            picture={
              eb2Cut?.kind === "date" && latest ? (
                <CutoffLine
                  cutoff={eb2Cut.iso}
                  bulletinMonth={latest.bulletinMonth}
                  label={`In the ${bulletinLabel} bulletin, EB-2 rest-of-world priority dates before ${shortDate(eb2Cut.iso)} are current`}
                />
              ) : null
            }
            shift={eb2Shift}
            href="/visa-bulletin"
            linkLabel="The visa bulletin"
          />
        </Track>
      </div>{" "}
      {pwd || perm ? (
        <section aria-labelledby="lines" className="mt-16">
          <h2 id="lines" className="font-heading text-2xl font-bold">
            Are the lines getting shorter?
          </h2>{" "}
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 [&>*]:min-w-0">
            {pwd ? <Balance name="Wage requests" flow={pwd.flow} href="/pwd-cases" /> : null}{" "}
            {perm ? <Balance name="PERM" flow={perm.flow} href="/perm-queue" /> : null}
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
        <div className="mt-12">
          <PermPulse variant="charts" days={observed} checkedAt={coverage?.checkedAt ?? null} />
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
