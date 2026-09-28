/**
 * An open manila case folder, drawn like the case cards (manila fill, black
 * ink, a hard offset shadow). "empty" shows a blank sheet waiting to be added;
 * "no-match" shows the folder under a magnifier, for a filter with no results.
 * The folder keeps black ink in both themes, as the case cards do, because
 * manila stays light in dark mode.
 */
import { cn } from "@/lib/utils";

interface DocketFolderArtProps {
  variant?: "empty" | "no-match";
  className?: string;
}

export function DocketFolderArt({ variant = "empty", className }: DocketFolderArtProps) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label={variant === "empty" ? "An empty case folder" : "A case folder under a magnifying glass"}
      className={cn("h-auto w-52", className)}
    >
      {/* Back of the folder, with its tab */}
      <path d="M34 40 h52 l10 -14 h70 v124 h-132 z" className="fill-foreground dark:fill-foreground/15" transform="translate(8 8)" />
      <path d="M34 40 h52 l10 -14 h70 v124 h-132 z" className="fill-manila-dark stroke-black" strokeWidth="2" />
      <rect x="104" y="30" width="46" height="8" className="fill-manila stroke-black" strokeWidth="1.5" />

      {/* The sheet */}
      <rect x="48" y="32" width="104" height="92" className="fill-white stroke-black" strokeWidth="2" />
      {variant === "empty" ? (
        <g className="stroke-black" strokeWidth="2">
          <rect x="60" y="44" width="80" height="68" className="fill-none" strokeDasharray="5 4" />
          <path d="M100 66 v24 M88 78 h24" strokeLinecap="square" />
        </g>
      ) : (
        <g>
          {[46, 58, 70, 82].map((y) => (
            <rect key={y} x="60" y={y} width={y === 82 ? 48 : 80} height="5" className="fill-black/25" />
          ))}
        </g>
      )}

      {/* Front flap */}
      <path d="M26 72 h148 l-10 78 h-128 z" className="fill-manila stroke-black" strokeWidth="2" />
      <rect x="44" y="92" width="58" height="8" className="fill-black/15" />
      <rect x="44" y="106" width="36" height="6" className="fill-black/10" />

      {variant === "no-match" && (
        <g>
          <circle cx="158" cy="118" r="26" className="fill-white/70 stroke-black" strokeWidth="5" />
          <circle cx="158" cy="118" r="26" className="fill-none stroke-black" strokeWidth="2" />
          <path d="M177 137 l18 18" className="stroke-black" strokeWidth="9" strokeLinecap="square" />
        </g>
      )}
    </svg>
  );
}
