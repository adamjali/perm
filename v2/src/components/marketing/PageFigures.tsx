/**
 * Figures for the pages that had none.
 *
 * Adam: "all pages should have some sort of visual (picture or something) like
 * /email-preferences doesnt, its boring lazy low effort, ai slop... unique
 * creative simple on theme, unique structure, layout, skeleton."
 *
 * NO STOCK PHOTOGRAPHY HERE, and that is a decision rather than an omission.
 * The house rule ranks real photographs above diagrams, but it is written for
 * pages about a business with premises and people. These are utility pages -
 * an email preference centre, a sign-up form - and there is nothing to
 * photograph. A stock laptop is filler, and filler is the thing being
 * complained about, not the cure for it.
 *
 * So each figure DRAWS THE THING THE PAGE IS ABOUT, and each is a different
 * shape because each page is about something different: three lanes of a
 * trigger reaching an inbox, a case's dates laid on a track, and three routes
 * converging on one. The alternative - one house chart repeated - is the
 * five-identical-cards defect from the homepage in another place.
 *
 * THEY ARE LABELLED, NOT HIDDEN. The reflex here is `aria-hidden`, on the
 * grounds that a decorative figure beside explanatory text adds nothing for a
 * screen reader. That is right for the homepage cards, whose figures are the
 * SHAPE of a number stated next to them. It is wrong here: each of these
 * carries information the prose does not - which triggers exist, that the
 * window closes at the earlier of two dates, that three routes reach one
 * inbox - so each is a `role="img"` with a sentence describing what it shows.
 * Hiding content because it happens to be drawn is how a diagram becomes
 * decoration for some readers and evidence for others.
 *
 * All of them: `currentColor` and theme tokens, never a raw hex, so they
 * invert with the theme rather than needing a second definition; and no
 * animation, so nothing here can pulse.
 */

/**
 * What actually reaches an inbox, and what sets it off.
 *
 * Three lanes because there are three alert kinds, and they differ in what
 * triggers them rather than in what they look like: a case changing status, a
 * queue month being reached, a bulletin cutoff moving. The diagram says
 * "something happens on the left, one email arrives on the right", which is
 * the whole contract of the page.
 */
export function AlertLanesFigure({ className }: { className?: string }) {
  const lanes = [
    { y: 16, label: "Case status" },
    { y: 46, label: "Queue month" },
    { y: 76, label: "Bulletin move" },
  ];
  return (
    <svg
      viewBox="0 0 300 100"
      className={className}
      role="img"
      aria-label="Three kinds of trigger, each producing one email"
    >
      {lanes.map((l) => (
        <g key={l.label}>
          {/* The trigger: a mark on the federal record. */}
          <rect
            x="2"
            y={l.y - 7}
            width="14"
            height="14"
            fill="var(--data-good-ink)"
          />
          {/* The wait. Dashed because nothing is sent while nothing changes,
              which is the promise the page makes. */}
          <line
            x1="22"
            y1={l.y}
            x2="236"
            y2={l.y}
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          {/* The email. One per trigger, never a digest of guesses. */}
          <rect
            x="242"
            y={l.y - 9}
            width="26"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <polyline
            points={`242,${l.y - 9} 255,${l.y + 1} 268,${l.y - 9}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </g>
      ))}
    </svg>
  );
}

/**
 * Where a message actually lands.
 *
 * The contact page lists three routes - email, the issue tracker, the case
 * lookup - and the thing worth drawing is that they are not three inboxes.
 * Two of them are faster than a form because they go somewhere specific; the
 * form is the catch-all underneath. Converging lines say that in one look,
 * and the page's headings say it in words.
 */
export function RoutingFigure({ className }: { className?: string }) {
  const starts = [14, 47, 80];
  return (
    <svg
      viewBox="0 0 300 96"
      className={className}
      role="img"
      aria-label="Three ways to get in touch, all reaching one inbox"
    >
      {starts.map((y) => (
        <g key={y}>
          <rect x="2" y={y - 7} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d={`M22 ${y} H140 Q168 ${y} 168 47 H196`}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="2"
          />
        </g>
      ))}
      {/* The one inbox. Filled, because it is the destination rather than a
          step on the way to one. */}
      <rect x="200" y="30" width="34" height="24" fill="var(--data-good-ink)" />
      <polyline
        points="200,30 217,44 234,30"
        fill="none"
        stroke="var(--background)"
        strokeWidth="2"
      />
    </svg>
  );
}
