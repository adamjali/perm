import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * The named parts of a long entity page, as one plain row of links under the
 * page's top. It doesn't stick or track the scroll: the site header is the
 * only thing that stays on screen.
 */

export interface ChapterItem {
  id: string;
  label: string;
}

export function ChapterNav({ items, className }: { items: ChapterItem[]; className?: string }) {
  return (
    <nav aria-label="On this page" className={cn("border-t border-border pt-6 print:hidden", className)}>
      <p className="text-sm text-muted-foreground">On this page</p>{" "}
      <ol className="mt-1 flex flex-wrap gap-x-5">
        {items.map((i) => (
          <Fragment key={i.id}>
            {" "}
            <li>
              <a href={`#${i.id}`} className="link inline-flex min-h-11 items-center text-base">
                {i.label}
              </a>
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
