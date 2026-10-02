import { EnvelopeSimpleIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * Figures for utility pages: a drawing of the thing each page is about.
 *
 * NO STOCK PHOTOGRAPHY HERE, and that is a decision rather than an omission.
 * The house rule ranks real photographs above diagrams, but it is written for
 * pages about a business with premises and people. These are utility pages -
 * an email preference centre, a sign-up form - and there is nothing to
 * photograph. A stock laptop is filler, and filler is the thing being
 * complained about, not the cure for it.
 *
 * So each figure DRAWS THE THING THE PAGE IS ABOUT, and each is a different
 * shape because each page is about something different: lanes of a
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
 * What actually reaches an inbox, and what sets it off: one lane per alert
 * kind, a change on the federal record at the left, one email at the right,
 * and a dashed wait between them because nothing is sent while nothing
 * changes. HTML rather than SVG so the labels keep their size at any width.
 */
const ALERT_LANES = [
  "A case's status changes",
  "DOL's queue reaches your month",
  "Your bulletin cutoff moves",
  "DOL moves an employer's cases",
] as const;

export function AlertLanesFigure({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Four kinds of change on the federal record, each sending one email"
      className={cn("grid gap-4", className)}
    >
      {ALERT_LANES.map((label) => (
        <div key={label} className="flex items-center gap-3">
          <span aria-hidden="true" className="size-3.5 shrink-0 bg-data-good-ink" />{" "}
          <span className="whitespace-nowrap text-sm font-semibold">{label}</span>{" "}
          <span aria-hidden="true" className="h-0 min-w-6 flex-1 border-t-2 border-dashed border-foreground/35" />{" "}
          <EnvelopeSimpleIcon aria-hidden="true" className="size-6 shrink-0" weight="bold" />
        </div>
      ))}
    </div>
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
