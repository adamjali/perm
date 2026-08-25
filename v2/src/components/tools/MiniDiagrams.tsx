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
      <rect x={4 + cleared * 14} y={4} width={34} height={12} fill="currentColor" />
      <text
        x={4 + cleared * 14 + 3}
        y={13}
        fontSize="8"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        fill="var(--background)"
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
