/**
 * The mini-diagram kit: one small drawing per card, one drawing system.
 *
 * Every card that names a tool also SHOWS the tool's idea: a queue is drawn
 * as depth, a window as spans on an axis, the DOL line as the tape, the
 * bulletin as a stepped cutoff that sometimes steps backwards, the timeline
 * as stages to scale. Shapes are deterministic (no randomness, no data
 * fetch) so they render identically everywhere; the LIVE numbers stay in the
 * stat chips beside them.
 *
 * All strokes and fills ride currentColor plus var(--primary), so one
 * component reads correctly on card, tint and ink tones alike. Decorative:
 * aria-hidden, never a substitute for the copy.
 */

const FRAME = "h-auto w-full";

/**
 * A faceted index: four ways in, one record out.
 *
 * Four index rows over one corpus. Each row is a run of records, the lit cell
 * is the one a case sits in, and the rule threading them is the intersection
 * all four indexes agree on. It draws the mechanism of a faceted search rather
 * than decorating a link with a magnifying glass.
 *
 * Shares WindowSpansMini's 120x56 viewBox on purpose: two cards standing side
 * by side get figure panels of identical height without either one being told
 * a pixel value.
 */
export function FacetIndexMini() {
  const ROWS = 4;
  const CELLS = 12;
  const X0 = 4;
  const PITCH = 112 / CELLS;
  const CW = PITCH - 1.6;
  /** The column every index resolves to. */
  const HIT = 6;
  const RH = 8;
  const RGAP = 4;
  const TOP = 6;
  const H = TOP * 2 + ROWS * RH + (ROWS - 1) * RGAP;
  const thread = X0 + HIT * PITCH + CW / 2;
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < CELLS; c++) cells.push({ r, c });
  return (
    <svg viewBox={`0 0 120 ${H}`} className={FRAME} aria-hidden="true">
      {/* Drawn first, so the cells sit on top of it and the thread shows only
          in the gaps: four hits on one line rather than a line over four. */}
      <line
        x1={thread}
        y1={1}
        x2={thread}
        y2={H - 1}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {cells.map(({ r, c }) => {
        const lit = c === HIT;
        return (
          <rect
            key={`${r}-${c}`}
            x={X0 + c * PITCH}
            y={TOP + r * (RH + RGAP)}
            width={CW}
            height={RH}
            // Lime on manila measures 1.73:1, so a lit cell is defined by its
            // edge and never by its fill. Same rule the whole kit follows.
            fill={lit ? "var(--primary)" : "currentColor"}
            opacity={lit ? 1 : 0.16}
            stroke={lit ? "currentColor" : "none"}
            strokeWidth={lit ? 1.5 : 0}
          />
        );
      })}
    </svg>
  );
}

/** Requests stacked ahead of yours: a queue drawn as depth. */
export function QueueDepthMini({ deep = false }: { deep?: boolean }) {
  const rows = deep
    ? [92, 84, 78, 70, 62, 55, 47, 40]
    : [88, 76, 64, 52, 40];
  const rh = deep ? 7 : 10;
  const gap = deep ? 4 : 6;
  const H = rows.length * (rh + gap) + 18;
  return (
    <svg viewBox={`0 0 120 ${H}`} className={FRAME} aria-hidden="true">
      {rows.map((rw, i) => (
        <rect
          key={i}
          x={4}
          y={4 + i * (rh + gap)}
          width={rw}
          height={rh}
          fill="currentColor"
          opacity={0.14 + i * 0.02}
        />
      ))}
      {/* You, at the back of the line. */}
      <rect
        x={4}
        y={4 + rows.length * (rh + gap)}
        width={30}
        height={rh}
        fill="var(--primary)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x={40}
        y={4 + rows.length * (rh + gap) + rh - 1}
        fontSize="8"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        fill="currentColor"
        opacity="0.7"
      >
        YOU
      </text>
    </svg>
  );
}

/** The regulatory spans: recruitment, quiet period, filing window. */
export function WindowSpansMini() {
  return (
    <svg viewBox="0 0 120 56" className={FRAME} aria-hidden="true">
      <line x1="4" y1="48" x2="116" y2="48" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {[4, 42, 72, 116].map((x) => (
        <line key={x} x1={x} y1="44" x2={x} y2="52" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      ))}
      <rect x="4" y="6" width="38" height="9" fill="currentColor" opacity="0.35" />
      <rect x="42" y="19" width="30" height="9" fill="currentColor" opacity="0.18" />
      <rect x="72" y="32" width="44" height="9" fill="var(--primary)" stroke="currentColor" strokeWidth="1.5" />
      <text x="74" y="30" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700" fill="currentColor" opacity="0.7">
        FILE HERE
      </text>
    </svg>
  );
}

/** The DOL line as the tape: cleared months, the frontier flag. */
export function TapeMini() {
  const cells = 8;
  const cleared = 5;
  return (
    <svg viewBox="0 0 120 52" className={FRAME} aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <rect
          key={i}
          x={4 + i * 14}
          y={22}
          width={13}
          height={20}
          fill={i < cleared ? "var(--primary)" : "currentColor"}
          opacity={i < cleared ? 1 : 0.12}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      {/* The frontier flag. */}
      <line
        x1={4 + cleared * 14}
        y1={8}
        x2={4 + cleared * 14}
        y2={22}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Outlined, not filled: a filled currentColor flag with
          var(--background) text is unreadable on any card whose surface
          isn't the page background - the ink calculator card rendered a
          white box with white "DOL" inside it in light mode. An outline
          plus currentColor text reads on every surface. */}
      <rect
        x={4 + cleared * 14}
        y={4}
        width={34}
        height={12}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x={4 + cleared * 14 + 4}
        y={13}
        fontSize="8"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        fill="currentColor"
      >
        DOL
      </text>
    </svg>
  );
}

/** The bulletin cutoff: forward steps, one honest retrogression. */
export function BulletinStepsMini() {
  const d = "M4 44 H22 V36 H40 V28 H58 V34 H76 V22 H94 V12 H116";
  return (
    <svg viewBox="0 0 120 52" className={FRAME} aria-hidden="true">
      <line x1="4" y1="48" x2="116" y2="48" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
      {/* The backwards step, marked: the part people do not expect. */}
      <circle cx="67" cy="34" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Every stage to scale: the whole process in five bars. */
export function ScaleBarsMini() {
  const stages: [number, boolean][] = [
    [34, false],
    [16, true],
    [42, false],
    [22, false],
    [30, false],
  ];
  let x = 4;
  return (
    <svg viewBox="0 0 160 30" className={FRAME} aria-hidden="true">
      {stages.map(([wd, you], i) => {
        const el = (
          <rect
            key={i}
            x={x}
            y={8}
            width={wd}
            height={14}
            fill={you ? "var(--primary)" : "currentColor"}
            opacity={you ? 1 : 0.16 + i * 0.05}
            stroke="currentColor"
            strokeWidth="1"
          />
        );
        x += wd + 3;
        return el;
      })}
    </svg>
  );
}

/** Two queues disagreeing: the published time next to the arithmetic. */
export function TwoBarsMini() {
  return (
    <svg viewBox="0 0 120 44" className={FRAME} aria-hidden="true">
      <rect x="4" y="8" width="62" height="10" fill="currentColor" opacity="0.3" />
      <text x="70" y="17" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700" fill="currentColor" opacity="0.7">
        PUBLISHED
      </text>
      <rect x="4" y="26" width="96" height="10" fill="var(--primary)" stroke="currentColor" strokeWidth="1.5" />
      <text x="7" y="34" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700" fill="#000">
        THE QUEUE
      </text>
    </svg>
  );
}

/**
 * An answer that is a range: a floor that is certain, and a span that is not.
 *
 * The I-485 queue drawn as its own certainty bar. Solid to the floor, hatched
 * across the width USCIS withholds, scaled to the ceiling with no empty track
 * behind it, so it reads as a measurement with a known precision rather than
 * as a progress meter.
 *
 * The hatch is explicit lines rather than an SVG `<pattern>` because a pattern
 * needs an id, and this kit is server-rendered with no `useId` available. The
 * lines are clamped to the hatched rect in arithmetic, which also keeps the
 * shape deterministic as the rest of the kit is.
 */
export function CertaintyRangeMini() {
  const X0 = 4;
  const X1 = 116;
  const SPLIT = 68;
  const TOP = 16;
  const BOT = 32;
  // Lines at 45 degrees: y = -x + c, swept across the hatched rect and
  // clamped at both ends so none of them overhangs it.
  const hatch: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let c = SPLIT + TOP; c <= X1 + BOT; c += 6) {
    let xb = c - BOT;
    let yb = BOT;
    let xt = c - TOP;
    let yt = TOP;
    if (xb < SPLIT) {
      xb = SPLIT;
      yb = c - SPLIT;
    }
    if (xt > X1) {
      xt = X1;
      yt = c - X1;
    }
    if (xt > xb) hatch.push({ x1: xb, y1: yb, x2: xt, y2: yt });
  }
  return (
    <svg viewBox="0 0 120 48" className={FRAME} aria-hidden="true">
      <rect x={X0} y={TOP} width={SPLIT - X0} height={BOT - TOP} fill="var(--primary)" />
      {hatch.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.45"
        />
      ))}
      <rect
        x={X0}
        y={TOP}
        width={X1 - X0}
        height={BOT - TOP}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x={X0} y={10} fontSize="8" fontFamily="var(--font-mono)" fontWeight="700" fill="currentColor" opacity="0.7">
        AT LEAST
      </text>
      <text x={X1} y={44} fontSize="8" fontFamily="var(--font-mono)" fontWeight="700" fill="currentColor" opacity="0.7" textAnchor="end">
        AT MOST
      </text>
    </svg>
  );
}

/**
 * A corpus of decided cases with one row found, and its outcome.
 *
 * Three cards on the tools page were drawing `TapeMini`, which is the DOL
 * QUEUE FRONTIER: cleared months behind a flag. That is the right picture for
 * "where is the line", and the wrong picture for all three of them - a search
 * over a published corpus, a wage determination, and a certified attestation
 * are three different ideas and were reading as one product. A drawing that
 * names the wrong subject is worse than no drawing, because it is confidently
 * wrong and nobody re-reads a thumbnail.
 *
 * This one draws what the case search actually does: many published records,
 * a query narrowing them, one row lit, and its decision at the end. The
 * outcome mark is a rule, not a tick or a cross, because the corpus holds both
 * and the drawing must not imply the answer is always a certification.
 */
export function RecordMatchMini() {
  const rows = [0, 1, 2, 3];
  const hit = 2;
  return (
    <svg viewBox="0 0 120 52" className={FRAME} aria-hidden="true">
      {rows.map((r) => {
        const y = 6 + r * 12;
        const lit = r === hit;
        return (
          <g key={r}>
            {/* The record: a run of fields. */}
            {[0, 1, 2].map((f) => (
              <rect
                key={f}
                x={4 + f * 26}
                y={y}
                width={f === 1 ? 22 : 20}
                height={8}
                fill={lit ? "var(--primary)" : "currentColor"}
                opacity={lit ? 1 : 0.14}
                stroke="currentColor"
                strokeWidth={lit ? 1.5 : 1}
              />
            ))}
            {/* The decision column, drawn for every row so the lit one is
                found rather than singled out by having a field nobody else
                has. */}
            <rect
              x={86}
              y={y}
              width={30}
              height={8}
              fill="none"
              stroke="currentColor"
              strokeWidth={lit ? 1.5 : 1}
              opacity={lit ? 1 : 0.3}
            />
            <line
              x1={90}
              y1={y + 4}
              x2={lit ? 112 : 100}
              y2={y + 4}
              stroke="currentColor"
              strokeWidth="1.5"
              opacity={lit ? 0.85 : 0.25}
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A prevailing wage determination: four levels, one of them set.
 *
 * DOL does not return a number out of thin air. It places the job at one of
 * four experience levels within its occupation and the level carries the wage,
 * which is why this is a stepped scale with one step marked rather than a bar
 * whose length is a dollar figure. The marked step is II because that is the
 * modal level, and a drawing that always pointed at IV would read as a claim
 * about wages rather than a picture of the mechanism.
 *
 * Deliberately unlike `TwoBarsMini` (two bars disagreeing) and `ScaleBarsMini`
 * (stages to scale): ascending discrete steps with a caret is a third shape.
 */
export function WageLevelsMini() {
  const heights = [10, 18, 26, 34];
  const set = 1;
  return (
    <svg viewBox="0 0 120 52" className={FRAME} aria-hidden="true">
      <line x1="4" y1="44" x2="116" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {heights.map((h, i) => (
        <rect
          key={i}
          x={8 + i * 26}
          y={44 - h}
          width={20}
          height={h}
          fill={i === set ? "var(--primary)" : "currentColor"}
          opacity={i === set ? 1 : 0.16}
          stroke="currentColor"
          strokeWidth={i === set ? 1.5 : 1}
        />
      ))}
      {/* The determination, sitting on the level it set. */}
      <text
        x={8 + set * 26 - 2}
        y={44 - heights[set]! - 5}
        fontSize="8"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        fill="currentColor"
      >
        SET
      </text>
    </svg>
  );
}

/**
 * A certified attestation, filed in volume.
 *
 * An LCA is not adjudicated the way a PERM is. The employer attests, DOL
 * certifies, and it happens hundreds of thousands of times a year - so the
 * honest picture is a stack, not a queue. Offset sheets with a certification
 * rule on the face give this card a shape nothing else in the kit uses, which
 * is the whole point: three cards in one row must not share a drawing.
 */
export function AttestationStackMini() {
  return (
    <svg viewBox="0 0 120 52" className={FRAME} aria-hidden="true">
      {/* The stack behind: how many there are. Offset down-right so the face
          sits at the top-left and the depth reads as depth rather than as a
          second document that failed to line up. */}
      {[2, 1].map((d) => (
        <rect
          key={d}
          x={4 + d * 6}
          y={4 + d * 4}
          width={78}
          height={38}
          fill="currentColor"
          opacity={0.1}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      {/* The face. */}
      <rect x="4" y="4" width="78" height="38" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[12, 19, 26].map((y, i) => (
        <line
          key={y}
          x1="10"
          y1={y}
          x2={i === 2 ? 46 : 76}
          y2={y}
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.35"
        />
      ))}
      {/* Certified: a stamp ON the form, wholly inside its edge. Outlined
          rather than filled so it reads on card, tint and ink alike - a filled
          currentColor box with background-coloured text renders as a white box
          with white text on the ink surface, the bug TapeMini's flag already
          carries a comment about. */}
      <rect x="34" y="30" width="44" height="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="34" y="30" width="4" height="9" fill="var(--primary)" />
      <text x="41" y="37.2" fontSize="6" fontFamily="var(--font-mono)" fontWeight="700" fill="currentColor">
        CERTIFIED
      </text>
    </svg>
  );
}

/**
 * Three programs, one search: three streams joining into one result.
 *
 * The cross-program search is the only card on that grid that is not a cut of
 * one dataset, so its drawing has to say "these three become one" rather than
 * name a subject. Three inbound runs at different lengths (the programs hold
 * very different volumes) fold into a single lit row.
 */
export function UnionMini() {
  const lanes = [
    { y: 8, w: 34 },
    { y: 20, w: 26 },
    { y: 32, w: 30 },
  ];
  return (
    <svg viewBox="0 0 120 52" className={FRAME} aria-hidden="true">
      {lanes.map((l) => (
        <g key={l.y}>
          <rect x={4} y={l.y} width={l.w} height={8} fill="currentColor" opacity="0.16" stroke="currentColor" strokeWidth="1" />
          {/* The fold: out of the lane, across to the join. */}
          <path
            d={`M ${4 + l.w} ${l.y + 4} H 56 L 66 ${24} H 72`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.4"
          />
        </g>
      ))}
      <rect x={72} y={20} width={44} height={8} fill="var(--primary)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
