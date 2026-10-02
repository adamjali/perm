import type { Icon } from "@phosphor-icons/react";

/**
 * The card every Settings section sits in: an icon, a heading, one line of
 * description and the controls.
 */
export function SettingsCard({
  icon: Glyph,
  title,
  description,
  headerRight,
  children,
}: {
  icon: Icon;
  title: string;
  description: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-2 border-border bg-card p-6 shadow-hard">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Glyph aria-hidden="true" className="size-5 text-foreground" />
          <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
        </div>
        {headerRight}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
