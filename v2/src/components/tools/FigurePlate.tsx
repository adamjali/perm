import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MoreText, firstSentence, plainText, wordCount } from "@/components/data/MoreText";

/**
 * The frame every chart on the site sits in: an ink frame, a title band naming
 * what the drawing shows (and its scale or window), the drawing, then a
 * caption band saying what to take from it and where the numbers came from.
 *
 * One frame for every chart makes ten drawings across ten pages read as one
 * system. Long captions fold: past 28 words the first sentence shows and the
 * rest opens on demand, every word still in the HTML.
 */

export interface FigurePlateProps {
  /** What the drawing shows, in sentence case. */
  title: string;
  /** A second line beside the title: the scale, the window, the unit. */
  subject?: string;
  /** What the reader should take away. Sits under the drawing, in prose. */
  caption?: ReactNode;
  /** Where the numbers came from. Always name it. */
  source?: ReactNode;
  /** "ink" sets the drawing on the dark panel; the default is paper. */
  tone?: "paper" | "ink";
  /** An anchor, for a page's list of parts to jump to. */
  id?: string;
  className?: string;
  children: ReactNode;
}

const CORNERS = [
  "left-0 top-0 border-l-4 border-t-4",
  "right-0 top-0 border-r-4 border-t-4",
  "left-0 bottom-0 border-l-4 border-b-4",
  "right-0 bottom-0 border-r-4 border-b-4",
] as const;

export function FigurePlate({ title, subject, caption, source, tone = "paper", id, className, children }: FigurePlateProps) {
  const ink = tone === "ink";
  return (
    // A drawing sheet (round 2, Oct 15 2026, back toward the original): an ink
    // frame with a small hard shadow, corner ticks, a title band ruled off the
    // drawing and a caption band under it. One frame for every chart.
    <figure
      id={id}
      className={cn(
        "relative m-0 border-2 border-border shadow-hard",
        ink ? "dark border-black bg-[#141414] text-foreground" : "bg-card text-foreground",
        className,
      )}
    >
      {CORNERS.map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={cn("pointer-events-none absolute h-3.5 w-3.5", ink ? "border-primary" : "border-foreground", pos)}
        />
      ))}
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 px-4 py-3 sm:px-5",
          ink ? "border-white/25" : "border-border",
        )}
      >
        <span className="font-heading text-lg font-bold">{title}</span>{" "}
        {subject ? <span className={cn("text-sm", ink ? "text-white/75" : "text-soft")}>{subject}</span> : null}
      </div>

      <div className="px-4 py-5 sm:px-5 sm:py-6">{children}</div>

      {caption || source ? (
        <figcaption
          className={cn(
            "border-t-2 px-4 py-3 text-sm leading-relaxed sm:px-5",
            ink ? "border-white/25 text-white/80" : "border-border bg-tint text-muted-foreground",
          )}
        >
          {caption && wordCount(caption) > 28 ? (
            <MoreText gist={firstSentence(plainText(caption))} size="sm" className="max-w-none">
              <div>{caption}</div>
            </MoreText>
          ) : (
            caption
          )}
          {source ? (
            <>
              {caption ? " " : null}
              <span className="text-sm">{source}</span>
            </>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A short label with a rule under it, for grouping inside a drawing without
 * introducing a heading level.
 */
export function PlateLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 border-b border-border pb-1.5 text-sm font-bold text-foreground">
      {children}
    </p>
  );
}
