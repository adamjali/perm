import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One named part of the page: a heavy rule, its title, one line on what it holds. */
export function Chapter({
  id,
  title,
  dek,
  children,
  className,
}: {
  id: string;
  title: string;
  dek?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("mt-16", className)}>
      <div className="border-t-2 border-foreground pt-4">
        <h2 id={`${id}-title`} className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
          {title}
        </h2>{" "}
        {dek ? <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">{dek}</p> : null}
      </div>{" "}
      {children}
    </section>
  );
}
