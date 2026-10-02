import Link from "next/link";
import { Fragment } from "react";

import { stageMeta } from "@/components/rfi/stageMeta";
import { HOLD_STATUS, holdSincePhrase, longDate } from "@/lib/employerStages";
import { getEmployerStages } from "@/lib/turso/employerStages";
import { formatInt, formatShare } from "@/lib/format";

/**
 * The on-hold guide's numbers, read live from the census the sweep writes.
 *
 * WHY THIS EXISTS. A number typed into prose is true on the day it is typed,
 * and an on-hold count can move by hundreds in a few weeks; this component
 * makes the guide true on the day it is read, and says which day that is.
 *
 * WHO IS NAMED. Only employers with at least `NAMED_FLOOR` cases on hold,
 * which is a hold on an employer's filings as a group. A small filer with a
 * handful held is counted in "the rest" and never named here: a guide for the
 * person waiting has no reason to single one out. No reason for any hold
 * appears in this component, and none may: the guide names the one
 * publicly explained hold in its own sourced paragraph, apart from this list.
 */

const NAMED_FLOOR = 25;
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export async function OnHoldNow() {
  const doc = await getEmployerStages().catch(() => null);
  if (!doc) {
    return (
      <p>
        The live count is unavailable for the moment. The{" "}
        <Link href="/perm-rfi-audit/application-on-hold" className={LINK}>
          application on hold stage page
        </Link>{" "}
        carries the same cases.
      </p>
    );
  }

  const held = doc.nationwide[HOLD_STATUS] ?? 0;
  const stages = Object.entries(doc.nationwide).sort((a, b) => b[1] - a[1]);
  const named = doc.employers
    .filter((e) => (e.byStatus[HOLD_STATUS] ?? 0) >= NAMED_FLOOR)
    .sort((a, b) => (b.byStatus[HOLD_STATUS] ?? 0) - (a.byStatus[HOLD_STATUS] ?? 0));
  const namedHeld = named.reduce((a, e) => a + (e.byStatus[HOLD_STATUS] ?? 0), 0);
  const rest = held - namedHeld;

  return (
    <div className="not-prose my-6 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <p className="text-base leading-relaxed">
        {`As of ${longDate(doc.asOf)}, ${formatInt(held)} of the ${formatInt(doc.pendingTotal)} PERM cases waiting on DOL are on hold (${formatShare(
          doc.pendingTotal ? held / doc.pendingTotal : 0,
        )}), read from DOL's own case system.`}
      </p>{" "}
      <table className="mt-4 w-full border-collapse text-left text-base">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="py-2 pr-4 font-bold">{"Where pending cases sit "}</th>
            <th className="py-2 text-right font-bold">{"Cases "}</th>
          </tr>
        </thead>
        <tbody translate="no">
          {stages.map(([status, n]) => (
            <tr key={status} className="border-b border-border">
              <td className={`py-2 pr-4 ${status === HOLD_STATUS ? "font-bold" : ""}`}>{`${stageMeta(status).label} `}</td>
              <td className={`py-2 text-right tabular-nums ${status === HOLD_STATUS ? "font-bold" : ""}`}>{`${formatInt(n)} `}</td>
            </tr>
          ))}
        </tbody>
      </table>{" "}
      {named.length > 0 ? (
        <>
          <p className="mt-5 text-base leading-relaxed">
            {`${named.length === 1 ? "One employer holds" : `${named.length} employers hold`} ${formatInt(namedHeld)} of the ${formatInt(held)} (${formatShare(
              held ? namedHeld / held : 0,
            )}):`}
          </p>{" "}
          <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
            {named.map((e) => {
              const since = holdSincePhrase(e, doc.logFrom);
              return (
                <Fragment key={e.slug ?? e.name}>
                  <li>
                    {e.slug ? (
                      <Link href={`/perm-employers/${e.slug}`} className={`font-bold ${LINK}`}>
                        {e.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{e.name}</span>
                    )}
                    {`: ${formatInt(e.byStatus[HOLD_STATUS] ?? 0)} of ${formatInt(e.pending)} pending on hold${since ? `; ${since}` : ""}. `}
                  </li>{" "}
                </Fragment>
              );
            })}
          </ul>{" "}
          <p className="mt-3 text-base leading-relaxed">
            {`The other ${formatInt(rest)} are spread across smaller filers. When nearly all of one employer's pending cases are on hold, the hold is on its filings as a group, and no one application in it was picked out. The status itself carries no reason.`}
          </p>
        </>
      ) : null}{" "}
      <p className="mt-4 text-sm text-foreground/70">
        <Link href="/perm-employers/under-review" className={LINK}>
          Every employer&apos;s count, and the days DOL moved them
        </Link>
      </p>
    </div>
  );
}
