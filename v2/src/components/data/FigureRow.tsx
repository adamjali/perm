import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A row of headline figures: each one its label, the number and what it
 * counts. No boxes; the space between them does the grouping, and on a phone
 * they stack.
 */
export function FigureRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-x-10 gap-y-6", className)}>{children}</div>;
}

export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 basis-48">
      <p className="text-sm text-muted-foreground">{label}</p>{" "}
      <p className="mt-1 font-heading text-3xl font-bold leading-none tabular-nums">{value}</p>{" "}
      {note ? <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{note}</p> : null}
    </div>
  );
}
