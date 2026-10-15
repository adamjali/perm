import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MoreText, firstSentence, plainText, wordCount } from "@/components/data/MoreText";

/**
 * The frame every chart on the site sits in: a 1px line, a title row naming
 * what the drawing shows (and its scale or window), the drawing, then a
 * caption saying what to take from it and where the numbers came from.
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
  /** An anchor, for a page's list of parts to jump to. */
  id?: string;
  className?: string;
  children: ReactNode;
}

export function FigurePlate({ title, subject, caption, source, id, className, children }: FigurePlateProps) {
  return (
    // One heavy ink rule over the figure, no box: the figure reads as a
    // figure, and the page keeps no hairline frames around its charts.
    <figure id={id} className={cn("m-0 border-t-2 border-[var(--object-border)] pt-3 text-foreground", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-lg font-bold">{title}</span>{" "}
        {subject ? <span className="text-sm text-soft">{subject}</span> : null}
      </div>

      <div className="py-5">{children}</div>

      {caption || source ? (
        <figcaption className="text-sm leading-relaxed text-muted-foreground">
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
              <span className="text-sm text-muted-foreground">{source}</span>
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
    <p className="mb-3 text-sm font-semibold text-foreground">
      {children}
    </p>
  );
}
