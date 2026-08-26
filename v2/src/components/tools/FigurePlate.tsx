import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The figure plate: one drawing language for every chart on the site.
 *
 * The characteristic artifact of this subject is a federal document — the
 * ETA-9089, a quarterly disclosure appendix, the visa bulletin's monospaced
 * cutoff table. So the drawings are dressed as figures in one: a hairline
 * frame with corner ticks, a corner title block reading FIG 04 / DENIAL RATE
 * BY WAGE BAND, tracked mono labels, and a caption that states the source.
 *
 * This exists because the alternative is what the rival ships: default chart
 * library output on white, indistinguishable from every other dashboard. A
 * plate makes a drawing look authored, and it makes ten different drawings
 * across ten pages read as one system rather than ten widgets.
 *
 * The number is not decoration. It is the figure's address, so a caption or
 * an article can refer to "Fig 04" and mean something.
 */

export interface FigurePlateProps {
  /** Two-digit figure number within its page, e.g. "04". */
  n: string;
  /** The title block's subject line. Rendered as tracked caps. */
  title: string;
  /** Optional second line in the title block: the scale, the window, the unit. */
  subject?: string;
  /** What the reader should take away. Sits under the drawing, in prose. */
  caption?: ReactNode;
  /** Where the numbers came from. Always name it. */
  source?: ReactNode;
  tone?: "paper" | "ink";
  className?: string;
  children: ReactNode;
}

export function FigurePlate({
  n,
  title,
  subject,
  caption,
  source,
  tone = "paper",
  className,
  children,
}: FigurePlateProps) {
  const ink = tone === "ink";
  return (
    <figure
      className={cn(
        "relative m-0 border-2 border-border shadow-hard",
        ink ? "bg-foreground text-background" : "bg-card",
        className,
      )}
    >
      {/* Corner ticks. Four short rules that read as a drawing frame rather
          than a card border, and cost nothing. */}
      {(
        [
          "left-0 top-0 border-l-4 border-t-4",
          "right-0 top-0 border-r-4 border-t-4",
          "left-0 bottom-0 border-l-4 border-b-4",
          "right-0 bottom-0 border-r-4 border-b-4",
        ] as const
      ).map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute h-4 w-4",
            ink ? "border-primary" : "border-foreground",
            pos,
          )}
        />
      ))}

      {/* Title block, top-left, like a drawing sheet. */}
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 px-5 py-3 sm:px-6",
          ink ? "border-background/25" : "border-border",
        )}
      >
        <span
          className={cn(
            "font-mono text-xs font-bold uppercase tracking-[0.18em]",
            ink ? "text-primary" : "text-muted-foreground",
          )}
        >
          Fig {n}
        </span>{" "}
        <span className="font-mono text-xs font-bold uppercase tracking-[0.14em]">
          {title}
        </span>{" "}
        {subject ? (
          <span
            className={cn(
              "font-mono text-xs tracking-[0.08em]",
              ink ? "text-background/55" : "text-muted-foreground",
            )}
          >
            {subject}
          </span>
        ) : null}
      </div>

      <div className="px-5 py-6 sm:px-6 sm:py-7">{children}</div>

      {caption || source ? (
        <figcaption
          className={cn(
            "border-t-2 px-5 py-3 text-sm leading-relaxed sm:px-6",
            ink ? "border-background/25 text-background/70" : "border-border text-foreground/70",
          )}
        >
          {caption}
          {source ? (
            <>
              {caption ? " " : null}
              <span
                className={cn(
                  "font-mono text-xs uppercase tracking-wider",
                  ink ? "text-background/50" : "text-muted-foreground",
                )}
              >
                {source}
              </span>
            </>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A short tracked-caps label with a rule under it. The plate's own heading
 * device, for grouping inside a drawing without introducing an h-level.
 */
export function PlateLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 border-b border-border/40 pb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}
