import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * A capture of the running app in a window frame, on a lime block.
 *
 * The captures come from the "Tour/" stories: the app's real pages drawn from
 * a sample firm's recorded data (src/components/tour/). Each is taken in both
 * themes, and most also at a phone width, where the app lays itself out for a
 * phone; the frame swaps them by theme and by width. The caption says the cases
 * are samples, because invented employers shown without saying so would be a
 * small dishonesty on the page whose job is to show what an account gets.
 */

export interface Shot {
  src: string;
  width: number;
  height: number;
}

export interface WindowShots {
  light: Shot;
  dark: Shot;
  /** The phone-width capture, shown below the lg breakpoint. */
  narrowLight?: Shot;
  narrowDark?: Shot;
}

function ThemedPicture({
  wide,
  narrow,
  alt,
  priority,
  className,
}: {
  wide: Shot;
  narrow?: Shot;
  alt: string;
  priority: boolean;
  className: string;
}) {
  return (
    <picture className={className}>
      {narrow ? (
        <source
          media="(max-width: 1023px)"
          srcSet={narrow.src}
          width={narrow.width}
          height={narrow.height}
        />
      ) : null}
      <img
        src={wide.src}
        width={wide.width}
        height={wide.height}
        alt={alt}
        {...(priority
          ? { fetchPriority: "high" as const }
          : { loading: "lazy" as const })}
        decoding="async"
        className="block h-auto w-full"
      />
    </picture>
  );
}

export function AppWindow({
  url,
  shots,
  alt,
  caption = "Sample cases. The employers are invented.",
  priority = false,
  onBand = false,
  fluid = false,
  className,
}: {
  url: string;
  shots: WindowShots;
  alt: string;
  caption?: string | null;
  /** The first picture on the page loads at once; the rest wait until near. */
  priority?: boolean;
  /** On a dark band the frame and caption take the band's light colour. */
  onBand?: boolean;
  /**
   * Inside a composition that's a container (`@container`), size the title bar
   * and the lime offset in container units, so the whole window shrinks with
   * the picture instead of keeping a full-size bar over a small capture. The
   * values equal the fixed ones at a 1,336px container (the attorney hero's
   * widest).
   */
  fluid?: boolean;
  className?: string;
}) {
  const edge = onBand ? "border-[var(--band-ink)]" : "border-border";
  return (
    <figure className={className}>
      <div className="relative">
        {/* The lime block the window sits on, offset like a hard shadow. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 border-2 bg-primary",
            fluid
              ? "translate-x-[1.05cqw] translate-y-[1.05cqw]"
              : "translate-x-2.5 translate-y-2.5 sm:translate-x-3.5 sm:translate-y-3.5",
            edge,
          )}
        />
        <div
          className={cn(
            "relative border-2 bg-background text-foreground",
            edge,
          )}
        >
          <div
            className={cn(
              "flex items-center border-b-2 border-border bg-muted",
              fluid ? "gap-[0.9cqw] px-[0.9cqw] py-[0.6cqw]" : "gap-3 px-3 py-2",
            )}
          >
            <span aria-hidden="true" className={cn("flex", fluid ? "gap-[0.45cqw]" : "gap-1.5")}>
              {["bg-background", "bg-background", "bg-primary"].map((fill, i) => (
                <Fragment key={i}>
                  {i > 0 ? " " : null}
                  <span
                    className={cn(
                      "border-border",
                      fluid ? "size-[0.9cqw] border-[max(1px,0.15cqw)]" : "size-3 border-2",
                      fill,
                    )}
                  />
                </Fragment>
              ))}
            </span>{" "}
            <span
              className={cn(
                "truncate font-mono text-muted-foreground",
                fluid ? "text-[1.05cqw] leading-[1.45]" : "text-sm",
              )}
            >
              {url}
            </span>
          </div>
          <ThemedPicture
            wide={shots.light}
            narrow={shots.narrowLight}
            alt={alt}
            priority={priority}
            className="block dark:hidden"
          />
          <ThemedPicture
            wide={shots.dark}
            narrow={shots.narrowDark}
            alt={alt}
            priority={false}
            className="hidden dark:block"
          />
        </div>
      </div>{" "}
      {caption ? (
        <figcaption
          className={cn(
            "mt-6 text-sm sm:mt-7",
            onBand ? "opacity-70" : "text-muted-foreground",
          )}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
