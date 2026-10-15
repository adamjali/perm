import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * One Settings section: a heading, at most one line saying what it's for,
 * then the controls. Sections are plain and divided by a line, so a page of
 * settings reads as one list, not a stack of boxes.
 */
export function SettingsCard({
  title,
  description,
  headerRight,
  tone,
  children,
}: {
  title: string;
  description?: string;
  headerRight?: React.ReactNode;
  /** "danger" for the section that deletes the account */
  tone?: "danger";
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-5 border-t border-border pt-8 first:border-t-0 first:pt-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={headingId}
            className={cn("font-heading text-xl font-bold", tone === "danger" ? "text-destructive-text" : "text-foreground")}
          >
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

/** A section's placeholder while its data loads: the same shape, no box. */
export function SettingsCardSkeleton({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 border-t border-border pt-8 first:border-t-0 first:pt-0">{children}</div>;
}
