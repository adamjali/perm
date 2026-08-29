import { Fragment } from "react";
import Link from "next/link";

import type { ChangeFeed as Feed } from "@/lib/turso/changes";
import { getStatusMeaning } from "@/lib/permStatus";

/**
 * The colour a status is written in, from its kind.
 *
 * The kind lookup is the shared logic and lives in `permStatus`; only this
 * mapping to a text token is local, because the one in `CaseStatusResult`
 * paints backgrounds for a hero band and would be wrong inline.
 */
function toneOf(status: string): string {
  switch (getStatusMeaning(status)?.kind) {
    case "decided":
      return "text-data-good-ink";
    case "action":
      return "text-data-warn-ink";
    case "appeal":
      return "text-data-bad-ink";
    default:
      return "text-foreground";
  }
}

/**
 * Which cases DOL moved on one day, and what they moved from and to.
 *
 * THE TRANSITION IS THE POINT, SO BOTH ENDS ARE DRAWN. A status on its own
 * cannot tell an RFI being issued apart from one being answered: both rows say
 * "RFI ISSUED" somewhere. `ANALYST REVIEW -> RFI ISSUED` and
 * `RFI ISSUED -> ANALYST REVIEW` are opposite events and are drawn as opposite
 * directions, which is the whole reason this reads from the event table rather
 * than from a status column.
 *
 * THE DAY'S SHAPE COMES BEFORE THE LIST. A hundred rows of one employer's
 * certifications reads as "a busy day for that employer" when the real story is
 * usually the mix: how many certified, how many were denied, how many entered
 * an RFI. The counts sit above the list so the list is read as evidence for
 * them rather than as the finding itself.
 *
 * "OBSERVED", NOT "HAPPENED". Every date here is when our sweep SAW the change.
 * DOL does not publish a timestamp, so a change made on a Friday and seen on
 * the Monday is a Monday row. The heading says observed and the note says why;
 * calling it "decided on" would be a claim the data cannot support.
 */
export function ChangeFeed({ feed }: { feed: Feed }) {
  const shown = feed.changes.length;

  return (
    <div>
      <ul className="m-0 mb-6 flex list-none flex-wrap gap-2 p-0">
        {feed.transitions.map((t) => (
          <Fragment key={`${t.fromStatus}>${t.toStatus}`}>
            <li className="border-2 border-border bg-card px-3 py-2 text-sm">
              <span className="text-foreground/60">{t.fromStatus}</span>{" "}
              <span aria-hidden="true" className="text-muted-foreground">
                &rarr;
              </span>{" "}
              <span className={toneOf(t.toStatus)}>{t.toStatus}</span>{" "}
              <b className="ml-1 font-black tabular-nums">
                {t.n.toLocaleString("en-US")}
              </b>
            </li>{" "}
          </Fragment>
        ))}
      </ul>{" "}
      <ol className="m-0 list-none p-0">
        {feed.changes.map((c) => (
          <Fragment key={c.caseNumber}>
            <li className="grid grid-cols-1 gap-x-4 gap-y-1 border-t-2 border-border py-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] [&>*]:min-w-0">
              <div>
                <Link
                  href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                  className="font-mono text-sm font-bold underline underline-offset-2"
                >
                  {c.caseNumber}
                </Link>{" "}
                <p className="mt-0.5 text-sm text-foreground/70">
                  {c.employerName ?? "Employer not named in the live record yet"}
                  {c.jobTitle ? ` · ${c.jobTitle}` : ""}
                </p>
              </div>{" "}
              <p className="text-sm sm:text-right">
                <span className="text-foreground/60">{c.fromStatus}</span>{" "}
                <span aria-hidden="true" className="text-muted-foreground">
                  &rarr;
                </span>{" "}
                <b className={toneOf(c.toStatus)}>{c.toStatus}</b>
              </p>
            </li>{" "}
          </Fragment>
        ))}
      </ol>{" "}
      {shown < feed.total ? (
        <p className="mt-4 text-sm text-foreground/70">
          Showing {shown.toLocaleString("en-US")} of{" "}
          {feed.total.toLocaleString("en-US")} changes observed that day.
        </p>
      ) : null}
    </div>
  );
}
