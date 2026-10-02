/**
 * The departures board: DOL's queue told the way a station tells a timetable.
 *
 * WHY A SPLIT-FLAP BOARD. It is the object the two explainer films are built
 * on (STATUS / WAITING / DECISION, flapping until an answer lands), so the
 * site and the films share one world. And it does a job: three live figures a
 * person waiting on a case reads first, each on its own row, dated by the
 * board's own "checked" line.
 *
 * A SERVER COMPONENT, COMPLETE WITHOUT JAVASCRIPT. Each value is in the page
 * text exactly once, as the row's `<dd>`; the cells draw their glyphs from
 * `data-c` with CSS, so a search snippet reads "Now deciding Dec 2025" and not
 * the value twice. The flip is CSS keyed off the curtain's `html[data-pre]`
 * (globals.css, "Flap board"), runs once, and is skipped under reduced motion.
 * The decoy glyph that shows before a cell settles (`data-r`) is a
 * pseudo-element too, so it can never land in a snippet either.
 *
 * The decoys are deterministic (a function of position), so the server and
 * any re-render agree byte for byte.
 */

const DECOYS = "QX7MDK4WZ2HBRF9TJ";

export interface FlapRow {
  /** What the row is, in plain words. */
  label: string;
  /** The value as it reads aloud; the board upper-cases it. Keep it short. */
  value: string;
}

export function FlapBoard({
  rows,
  footer,
  className = "",
}: {
  rows: readonly FlapRow[];
  footer?: React.ReactNode;
  className?: string;
}) {
  let cell = 0;
  return (
    <figure className={`flap-board m-0 ${className}`}>
      <div className="flap-board-head">
        <span>DOL</span>{" "}
        <span aria-hidden="true" className="flap-board-dot" />{" "}
        <span>PERM queue</span>
      </div>{" "}
      <dl className="m-0">
        {rows.map((row) => (
          <div key={row.label} className="flap-row">
            <dt className="flap-label">{row.label}</dt>{" "}
            <dd className="m-0">
              {/* The value once, as text; the cells are its picture. */}
              <span className="sr-only">{row.value}</span>{" "}
              <span className="flap-cells" aria-hidden="true">
                {[...row.value.toUpperCase()].map((ch, i) => {
                  if (ch === " ") return <span key={i} className="flap-cell flap-gap" />;
                  const n = cell++;
                  return (
                    <span
                      key={i}
                      className="flap-cell"
                      data-c={ch}
                      data-r={DECOYS[(n * 7 + i * 3) % DECOYS.length]}
                      style={{ "--i": n } as React.CSSProperties}
                    />
                  );
                })}
              </span>
            </dd>
          </div>
        ))}
      </dl>{" "}
      {footer ? <figcaption className="flap-board-foot">{footer}</figcaption> : null}
    </figure>
  );
}

/**
 * A single word on flap cells, no board around it: the films' end card
 * ("PERMTRACKER.APP") as a small object. Decorative, so hidden from assistive
 * tech; the heading beside it carries the meaning. No `data-r`, so it settles
 * without a decoy.
 */
export function FlapWord({ word, className = "" }: { word: string; className?: string }) {
  return (
    <span className={`flap-cells flap-word ${className}`} aria-hidden="true">
      {[...word.toUpperCase()].map((ch, i) =>
        ch === " " ? (
          <span key={i} className="flap-cell flap-gap" />
        ) : (
          <span key={i} className="flap-cell" data-c={ch} style={{ "--i": i } as React.CSSProperties} />
        ),
      )}
    </span>
  );
}
