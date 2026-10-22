import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A full-width band: its words on one side and a picture on the other, paper and ink bands alternating, stacked
 * one after another as the reader scrolls (the calculators, extension and data overview pages).
 *
 * Inside the attorney page's ribbon stage (TourStage, `pinned`) each band is also a layer filling the pinned frame,
 * clipped from the left by --wipe (100% hidden, 0% whole; TourStage writes it), its words always on the left; below
 * 1024px, under reduced motion and with scripts off those bands stack like the rest. The sideways stage is the
 * attorney page's alone (owner, Oct 21 2026: "keep that sideways scroll for attorney page, rest dont need it").
 */
export function StageBand({
  id,
  index,
  flip,
  ink,
  title,
  lead,
  children,
  picture,
  extra,
  bleed = true,
  pinned = false,
}: {
  id: string;
  index: number;
  /** In the static layout, the picture on the left. */
  flip: boolean;
  /** An ink band (dark in both themes). */
  ink: boolean;
  title: string;
  lead: string;
  /** Under the lead: the facts, or the links. */
  children?: ReactNode;
  /** The picture, usually an AppWindow; cut to one height from the top in the pinned frame. */
  picture: ReactNode;
  /** A second picture shown in the static layout only (inside the pinned frame it would run past the bottom). */
  extra?: ReactNode;
  /**
   * The picture runs off the right edge (the default, for a capture read from its top left). Off, it stays inside
   * the page whole: for a picture whose point is at its right, such as the extension's panel.
   */
  bleed?: boolean;
  /** A layer of TourStage's pinned frame (the attorney page). Off, the band is an ordinary section. */
  pinned?: boolean;
}) {
  return (
    <section
      id={id}
      data-tour-step={pinned ? index : undefined}
      style={pinned ? ({ "--wipe": index === 0 ? "0%" : "100%" } as CSSProperties) : undefined}
      className={cn(
        "scroll-mt-24 overflow-hidden border-b-2 border-black",
        ink
          ? "bg-[#141414] text-white [--band-ink:#ffffff] dark:bg-card dark:text-foreground dark:[--band-ink:var(--foreground)]"
          : "bg-background",
        pinned &&
          "lg:motion-safe:absolute lg:motion-safe:inset-0 lg:motion-safe:border-b-0 lg:motion-safe:[clip-path:inset(0_0_0_var(--wipe))]",
      )}
    >
      <div
        data-tour-grid=""
        className={cn(
          "mx-auto grid max-w-[1400px] gap-10 px-4 py-14 [&>*]:min-w-0 sm:px-8 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-14",
          pinned && "lg:motion-safe:h-full lg:motion-safe:py-8",
        )}
      >
        <div className={cn("lg:col-span-4", flip && (pinned ? "lg:motion-reduce:order-2" : "lg:order-2"))}>
          <h2 className="font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-4xl">{title}</h2>{" "}
          <p className={cn("mt-4 text-lg leading-relaxed", ink ? "text-white/80 dark:text-soft" : "text-soft")}>{lead}</p>{" "}
          {children}
        </div>{" "}
        {/* The window runs off the right edge; on a flipped row it stops at the page's own margin, because a
            window cut on the left loses its address bar and the page's heading. In the pinned frame every window
            runs off the right, cut to one height from the top so each band's window lies exactly over the last. */}
        <div
          data-tour-window=""
          className={cn(
            "relative lg:col-span-8",
            // An ordinary band shows its capture's top in a wide frame, where each tool's answer sits; whole on a phone.
            !pinned && bleed && "lg:[&_img]:aspect-[16/10] lg:[&_img]:object-cover lg:[&_img]:object-left-top",
            pinned &&
              (bleed
                ? "lg:motion-safe:-mr-[12%] lg:motion-safe:[&_img]:h-[calc(100dvh-var(--site-header-h)-16rem)] lg:motion-safe:[&_img]:object-cover lg:motion-safe:[&_img]:object-left-top"
                : "lg:motion-safe:[&_img]:max-h-[calc(100dvh-var(--site-header-h)-16rem)] lg:motion-safe:[&_img]:object-contain"),
            // The static layout's sides: always for an ordinary band, only below the pinned layout for a stage's.
            // Every class written out whole, so Tailwind finds it.
            flip
              ? pinned
                ? "lg:motion-reduce:order-1 lg:motion-reduce:-ml-8"
                : "lg:order-1 lg:-ml-8"
              : bleed && (pinned ? "lg:motion-reduce:-mr-[12%]" : "lg:-mr-[12%]"),
          )}
        >
          {picture}
          {extra ? <div className={pinned ? "lg:motion-safe:hidden" : undefined}>{extra}</div> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Without scripts the pinned frame would show only its first band, so a reader with scripts off gets the static
 * layout at every width. No quotes or ">" in it: React writes a style element's text as it is.
 */
export const STAGE_BAND_NO_SCRIPT_CSS = [
  "[data-stage=tour]{height:auto!important}",
  "[data-tour-frame]{position:static!important;display:block!important;height:auto!important;overflow:visible!important;border-bottom-width:0!important}",
  "[data-tour-ribbon]{display:none!important}",
  "[data-tour-area]{position:static!important}",
  "[data-tour-step]{position:relative!important;inset:auto!important;clip-path:none!important;border-bottom-width:2px!important}",
  "[data-tour-grid]{height:auto!important}",
  "[data-tour-window] img{height:auto!important}",
].join("");
