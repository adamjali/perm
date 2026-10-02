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
  className?: string;
}) {
  const edge = onBand ? "border-[var(--band-ink)]" : "border-border";
  return (
    <figure className={className}>
      <div className="relative">
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 translate-x-3 translate-y-3 border-3 bg-primary sm:translate-x-4 sm:translate-y-4",
            edge,
          )}
        />
        <div
          className={cn(
            "relative border-3 bg-background text-foreground",
            edge,
          )}
        >
          <div className="flex items-center gap-3 border-b-3 border-border bg-muted px-3 py-2">
            <span aria-hidden="true" className="flex gap-1.5">
              <span className="size-3 border-2 border-border bg-background" />{" "}
              <span className="size-3 border-2 border-border bg-background" />{" "}
              <span className="size-3 border-2 border-border bg-primary" />
            </span>{" "}
            <span className="truncate font-mono text-sm text-muted-foreground">
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
