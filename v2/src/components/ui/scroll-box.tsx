import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A box that scrolls sideways when what's inside is wider than the screen: a
 * table or a strip on a phone. It is a named region with a tab stop, so a
 * keyboard can reach it and scroll it with the arrow keys (WCAG 2.1.1); a box
 * holding only text and figures would otherwise be out of a keyboard's reach.
 *
 * A chart with hover figures scrolls inside `ChartTips` instead (its `scroll`
 * prop), which keeps one tab stop for the box and the figures together.
 */
export function ScrollBox({
  label,
  className,
  children,
}: {
  /** What the box holds, read out when it takes focus. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("scroll-box overflow-x-auto", className)}>
      {children}
    </div>
  );
}
