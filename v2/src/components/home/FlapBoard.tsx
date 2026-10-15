/**
 * The departures board: DOL's queue told the way a station tells a timetable.
 *
 * It is the object the explainer films are built on, and it does a job: the
 * few live figures a person waiting on a case reads first, each on its own
 * row, dated by the board's own "checked" line.
 *
 * A server component, complete without JavaScript, and still: nothing flaps
 * on load. Each value is in the page text exactly once, as the row's sr-only
 * copy; the cells draw their glyphs from `data-c` with CSS, so a search
 * snippet reads "Now deciding Dec 2025" and never the value twice.
 */

export interface FlapRow {
  /** What the row is, in plain words. */
  label: string;
  /** The value as it reads aloud; the board upper-cases it. Keep it short. */
  value: string;
}

export function FlapBoard({
  title,
  rows,
  footer,
  caps = false,
  className = "",
}: {
  title: string;
  rows: readonly FlapRow[];
  footer?: React.ReactNode;
  /** Station-board capitals on the labels (one- and two-word labels only). */
  caps?: boolean;
  className?: string;
}) {
  return (
    <figure className={`flap-board m-0 ${className}`} data-caps={caps ? "" : undefined}>
      <div className="flap-board-head">
        <span aria-hidden="true" className="flap-board-dot" />{" "}
        <span>{title}</span>
      </div>{" "}
      <dl>
        {rows.map((row) => (
          <div key={row.label} className="flap-row">
            <dt className="flap-label">{row.label}</dt>{" "}
            <dd className="m-0">
              <span className="sr-only">{row.value}</span>{" "}
              <span className="flap-cells" aria-hidden="true">
                {[...row.value.toUpperCase()].map((ch, i) =>
                  ch === " " ? (
                    <span key={i} className="flap-cell flap-gap" />
                  ) : (
                    <span key={i} className="flap-cell" data-c={ch} />
                  ),
                )}
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
 * tech; the heading beside it carries the meaning.
 */
export function FlapWord({ word, className = "" }: { word: string; className?: string }) {
  return (
    <span className={`flap-cells flap-word ${className}`} aria-hidden="true">
      {[...word.toUpperCase()].map((ch, i) =>
        ch === " " ? <span key={i} className="flap-cell flap-gap" /> : <span key={i} className="flap-cell" data-c={ch} />,
      )}
    </span>
  );
}
