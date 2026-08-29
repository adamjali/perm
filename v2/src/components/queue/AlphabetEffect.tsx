import { Fragment } from "react";

import type { Alphabet } from "@/lib/turso/alphabet";

/**
 * What the employer's first letter is actually worth.
 *
 * THE DRAWING'S JOB IS TO MAKE A SMALL EFFECT LOOK SMALL. DOL works a filing
 * month alphabetically, so the ordering is real and every rival estimator uses
 * it; one of them prints a 160-day spread for the term and sells the initial as
 * most of the answer. Measured here it is worth about 27 days end to end. A
 * chart that scaled each bar to fit the panel would show a dramatic gradient
 * and quietly agree with the rival, so the axis is anchored at the corpus mean
 * and the bars are drawn against a fixed, labelled span - the same discipline
 * as an axis that does not start at zero being a lie.
 *
 * ONE COLOUR EACH SIDE, AND THEY MEAN OPPOSITE THINGS. Faster than the mean and
 * slower than the mean are opposite directions, not two intensities, so they
 * are the good and bad tokens rather than one hue at two opacities.
 *
 * THE REVERSAL COUNT IS NOT A FOOTNOTE. In a sixth of measured months the back
 * half of the alphabet came out ahead. A reader deciding how much to weigh
 * their own initial needs that more than they need the pooled gradient, so it
 * is stated in the panel rather than left in a caveats block.
 */
export function AlphabetEffect({ data }: { data: Alphabet }) {
  // A fixed span, not a fit-to-data one. Rounded out from the observed extreme
  // so the widest bar leaves headroom and the scale reads as chosen.
  const span = Math.max(
    20,
    Math.ceil(Math.max(...data.letters.map((l) => Math.abs(l.deltaDays))) / 5) * 5,
  );
  const pct = (d: number) => (Math.abs(d) / span) * 50;

  return (
    <div>
      <ul className="m-0 mb-5 flex list-none flex-wrap items-center gap-x-6 gap-y-2 p-0 text-xs text-foreground/70">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-8 border-2 border-border bg-data-good-ink" />{" "}
          <span>Decided faster than average</span>
        </li>{" "}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-8 border-2 border-border bg-data-warn-ink" />{" "}
          <span>Decided slower than average</span>
        </li>{" "}
      </ul>{" "}
      <ol className="m-0 list-none p-0">
        {data.letters.map((l) => {
          const faster = l.deltaDays < 0;
          return (
            <Fragment key={l.letter}>
              <li className="grid grid-cols-[1.5rem_1fr_4.5rem] items-center gap-2 py-[3px] [&>*]:min-w-0">
                <span className="font-mono text-sm font-bold">{l.letter}</span>{" "}
                <span
                  aria-hidden="true"
                  className="relative block h-3 border-l-2 border-border"
                  style={{ marginLeft: "50%", width: "50%" }}
                >
                  <span
                    className={`absolute top-0 h-3 border-2 border-border ${
                      faster ? "bg-data-good-ink" : "bg-data-warn-ink"
                    }`}
                    style={
                      faster
                        ? { right: "100%", width: `${pct(l.deltaDays) * 2}%` }
                        : { left: 0, width: `${pct(l.deltaDays) * 2}%` }
                    }
                  />
                </span>{" "}
                <span className="text-right font-mono text-xs tabular-nums text-foreground/70">
                  {l.deltaDays > 0 ? "+" : ""}
                  {l.deltaDays.toFixed(1)}d
                </span>
              </li>{" "}
            </Fragment>
          );
        })}
      </ol>{" "}
      <p className="mt-5 text-sm leading-relaxed text-foreground/70">
        Against a corpus mean of{" "}
        <b className="text-foreground">{Math.round(data.meanDays)} days</b> over{" "}
        {data.cases.toLocaleString("en-US")} decided cases. The whole alphabet
        is worth{" "}
        <b className="text-foreground">
          about {Math.round(data.spreadDays)} days
        </b>{" "}
        end to end.
      </p>
    </div>
  );
}
