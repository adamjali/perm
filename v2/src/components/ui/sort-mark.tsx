import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * The one mark a sortable column header carries, on every table (owner, Nov 5 2026: the
 * text "↕" phones draw as a grey emoji box, and the tables each did it their own way).
 *
 * A column that sorts and isn't sorted shows a faint up-and-down caret, so it reads as
 * something to press; the sorted column shows one firm caret for its direction. It's a
 * Phosphor icon, the site's only icon set, from the server entry so a server table can
 * use it too. Hidden from screen readers: the `th` carries `aria-sort`.
 */
export function SortMark({ dir, className }: { dir: "asc" | "desc" | null; className?: string }) {
  const Icon = dir === "asc" ? CaretUpIcon : dir === "desc" ? CaretDownIcon : CaretUpDownIcon;
  return (
    <Icon
      aria-hidden="true"
      data-sort-mark={dir ?? "none"}
      weight={dir ? "bold" : "regular"}
      className={cn("inline-block size-3.5 shrink-0 align-[-0.125em]", dir ? "" : "opacity-50", className)}
    />
  );
}
