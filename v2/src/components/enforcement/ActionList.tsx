import { Fragment } from "react";
import Link from "next/link";
import { ArrowSquareOutIcon, ProhibitIcon } from "@phosphor-icons/react/ssr";

import { FinePrint } from "@/components/data/FinePrint";
import { ROW_LINK } from "@/components/entities/caseRows";
import { entityHref } from "@/lib/entityPayload";
import { formatInt } from "@/lib/format";
import { shortDate } from "@convex/lib/months";
import type { EnforcementAction, EnforcementKind } from "@/lib/enforcement/actions";
import type { SponsorRecord } from "@/lib/db/sponsorRecords";
import { PROGRAM_LANES } from "./EnforcementTimeline";

/**
 * Every action, newest first: the day and what kind of action, the company and what it did, the money and
 * any bar, and beside it what DOL's own record shows for the company (its PERM filings, its newest one, what
 * still waits, and the H-1B LCAs it has filed since the action was announced). The record is DOL's; the
 * action is DOJ's or DOL's; the page joins them and says nothing more.
 */

const KIND: Record<EnforcementKind, string> = { settlement: "Settlement", lawsuit: "Lawsuit", suspension: "Suspension" };
const money = (n: number) => `$${formatInt(n)}`;

export function ActionList({
  actions,
  records,
}: {
  actions: readonly EnforcementAction[];
  records: ReadonlyMap<string, SponsorRecord>;
}) {
  const newestFirst = [...actions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <ol className="mt-6 space-y-4">
      {newestFirst.map((a) => {
        const lane = PROGRAM_LANES.find((l) => l.program === a.program);
        return (
          <Fragment key={a.id}>
            {" "}
            <li
              id={a.id}
              className="grid scroll-mt-28 grid-cols-1 gap-4 border-2 border-border bg-card p-5 [&>*]:min-w-0 lg:grid-cols-[9rem_1fr_17rem]"
            >
              <div>
                <p className="font-heading text-lg font-bold tabular-nums">{shortDate(a.date)}</p>{" "}
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <span className="border-2 border-border bg-tint px-2 text-sm font-semibold">{KIND[a.kind]}</span>{" "}
                  <span className={`border-2 border-foreground px-2 text-sm font-semibold text-black ${lane?.fill ?? ""}`}>
                    {a.program === "temporary visas" ? "Visa-only ads" : a.program}
                  </span>
                </p>
              </div>{" "}
              <div>
                <h3 className="font-heading text-xl font-bold leading-snug">
                  {a.company}
                  {/* One company can have several actions; the kind and day keep each heading its own. */}
                  <span className="sr-only">{`, ${KIND[a.kind].toLowerCase()}, ${shortDate(a.date)}`}</span>
                </h3>{" "}
                {a.place ? <p className="text-sm text-muted-foreground">{a.place}</p> : null}{" "}
                <p className="mt-2 text-base leading-relaxed">{a.conduct}</p>{" "}
                {a.civilPenalty || a.backPay ? (
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base">
                    {a.civilPenalty ? (
                      <div>
                        <dt className="inline text-muted-foreground">Civil penalty </dt>{" "}
                        <dd className="inline font-bold tabular-nums">{money(a.civilPenalty)}</dd>
                      </div>
                    ) : null}{" "}
                    {a.backPay ? (
                      <div>
                        <dt className="inline text-muted-foreground">{a.backPayIsFund ? "Fund for workers " : "Back pay "}</dt>{" "}
                        <dd className="inline font-bold tabular-nums">{money(a.backPay)}</dd>
                      </div>
                    ) : null}{" "}
                    {a.termYears ? (
                      <div>
                        <dt className="inline text-muted-foreground">Term </dt>{" "}
                        <dd className="inline font-bold">{`${a.termYears} years`}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}{" "}
                {a.bar ? (
                  <div className="mt-3 flex gap-3 border-2 border-l-8 border-data-bad-ink bg-card p-3">
                    <ProhibitIcon className="mt-0.5 size-5 shrink-0 text-data-bad-ink" aria-hidden="true" />
                    <div>
                      <p className="font-bold">
                        {a.bar.months ? `No PERM filing for ${a.bar.months} months` : `No PERM processing for ${a.bar.days} days`}
                      </p>{" "}
                      <FinePrint summary="In its own words" className="mt-1">
                        <p>
                          <q>{a.bar.words}</q>
                        </p>
                      </FinePrint>
                    </div>
                  </div>
                ) : null}{" "}
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  {a.sources.map((s) => (
                    <Fragment key={s.url}>
                      {" "}
                      <li>
                        <a href={s.url} target="_blank" rel="noopener" className={`${ROW_LINK} gap-1 text-sm`}>
                          {s.label}
                          <ArrowSquareOutIcon className="size-3.5" aria-hidden="true" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    </Fragment>
                  ))}
                </ul>
              </div>{" "}
              <Record action={a} records={records} />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Record({ action, records }: { action: EnforcementAction; records: ReadonlyMap<string, SponsorRecord> }) {
  const pages = action.pages ?? [];
  if (!pages.length) {
    return (
      <div className="bg-tint p-4 text-sm text-muted-foreground">
        No page here: DOL&apos;s records hold no filing under this name.
      </div>
    );
  }
  return (
    <div className="space-y-3 bg-tint p-4">
      <p className="text-sm font-bold">In DOL&apos;s record</p>{" "}
      {pages.map((slug) => {
        const r = records.get(slug);
        return (
          <div key={slug} className="text-sm">
            <Link href={entityHref("employer", slug)} className={`${ROW_LINK} font-semibold`}>
              {r?.name ?? slug}
            </Link>{" "}
            {r ? (
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
                <dt className="text-muted-foreground">Decided PERM filings</dt>{" "}
                <dd className="text-right font-semibold">{r.perm === null ? "none" : formatInt(r.perm)}</dd>{" "}
                <dt className="text-muted-foreground">Newest PERM filing</dt>{" "}
                <dd className="text-right font-semibold">{r.lastPerm ? shortDate(r.lastPerm) : "none"}</dd>{" "}
                <dt className="text-muted-foreground">Waiting at DOL</dt>{" "}
                <dd className="text-right font-semibold">{formatInt(r.waiting)}</dd>{" "}
                <dt className="text-muted-foreground">{`H-1B LCAs since ${shortDate(r.since)}`}</dt>{" "}
                <dd className="text-right font-semibold">{formatInt(r.lcaSince)}</dd>
              </dl>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
