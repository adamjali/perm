import { Fragment } from "react";

import { EmployerFollowForm } from "@/components/employers/EmployerFollowForm";
import { StatusRibbon, ribbonLegend, ribbonParts } from "@/components/employers/StatusRibbon";
import { longDate, type EmployerMove, type EmployerStageRow } from "@/lib/employerStages";

/**
 * Follow an employer: what its pending cases look like today, what DOL has
 * done to them as a group, and one field to hear about the next time.
 *
 * The bar and the rail carry the content; the words are the legend. Every
 * rail entry is a sentence naming who acted, dated by the day this site
 * recorded it, with no reason, because DOL gives none. The markers reuse the
 * bar's colours: amber for a hold, lime for a batch certified, brick for a
 * batch denied, grey for everything that is neither.
 */

const RAIL_SHOWN = 6;
const int = (n: number) => n.toLocaleString("en-US");

function markerClass(m: EmployerMove): string {
  if (m.key.includes("|hold-on|")) return "bg-data-warn-ink";
  if (m.key.endsWith("|CERTIFIED")) return "bg-primary";
  if (m.key.endsWith("|DENIED")) return "bg-data-bad-ink";
  return "bg-background";
}

export function EmployerFollow({
  slug,
  name,
  row,
  moves,
  logFrom,
  asOf,
}: {
  slug: string;
  name: string;
  /** This employer's census row, or null when it has under five pending cases. */
  row: EmployerStageRow | null;
  /** This employer's employer-wide moves, newest first. */
  moves: EmployerMove[];
  logFrom: string | null;
  asOf: string | null;
}) {
  const parts = row ? ribbonParts(row) : null;
  const legend = parts ? ribbonLegend(parts) : [];
  const shown = moves.slice(0, RAIL_SHOWN);
  return (
    <section id="follow" className="mt-10 scroll-mt-28 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <h2 className="font-heading text-xl font-black sm:text-2xl">Follow {name}</h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
        An email when DOL moves its cases as a group: five or more on or off hold in a day, or a batch decided well above its usual pace.
      </p>

      {parts && parts.pending > 0 ? (
        <div className="mt-6">
          <p className="text-base font-bold">
            {`Its ${int(parts.pending)} pending PERM cases${asOf ? `, as of ${longDate(asOf)}` : ""}`}
          </p>{" "}
          <div className="mt-2">
            <StatusRibbon parts={parts} label={legend.map((l) => l.text).join("; ")} />
          </div>{" "}
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {legend.map((l) => (
              <Fragment key={l.key}>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className={`inline-block h-3.5 w-3.5 shrink-0 border-2 border-border ${l.cls}`} />{" "}
                  <span>{l.text}</span>
                </li>{" "}
              </Fragment>
            ))}
          </ul>
        </div>
      ) : null}{" "}

      <div className="mt-7">
        <p className="text-base font-bold">What DOL has done to its cases as a group</p>{" "}
        {shown.length === 0 ? (
          <p className="mt-2 text-base text-foreground/80">
            {logFrom ? `Nothing employer-wide since this site's record began on ${longDate(logFrom)}.` : "Nothing employer-wide in this site's record."}
          </p>
        ) : (
          <ol className="mt-3 border-l-2 border-border">
            {shown.map((m) => (
              <Fragment key={m.key}>
                <li className="relative grid grid-cols-1 gap-y-0.5 py-2 pl-6 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-x-4">
                  <span aria-hidden="true" className={`absolute -left-[9px] top-3.5 h-4 w-4 border-2 border-border ${markerClass(m)}`} />{" "}
                  <span className="text-sm font-semibold tabular-nums text-foreground/70">{longDate(m.date).replace(/, \d{4}$/, "")}</span>{" "}
                  <span className="text-base font-bold">{m.sentence}</span>
                </li>{" "}
              </Fragment>
            ))}
          </ol>
        )}{" "}
        {moves.length > RAIL_SHOWN ? (
          <p className="mt-2 text-sm text-foreground/70">{`${int(moves.length - RAIL_SHOWN)} earlier in the record.`}</p>
        ) : null}
      </div>{" "}

      <div className="mt-7 border-t-2 border-border pt-6">
        <EmployerFollowForm slug={slug} source="employer-page" />
      </div>
    </section>
  );
}
