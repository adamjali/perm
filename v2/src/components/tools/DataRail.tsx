"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CaretRightIcon, CircleNotchIcon, HouseIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/ui/pending-link";

import {
  GROUPS,
  OVERVIEW,
  SECTIONS,
  isDataPath,
  sectionForPath,
  type DataGroup,
} from "./dataSections";

/**
 * The data surface's navigation: index tabs bolted to the left edge.
 *
 * A rail rather than a top bar because the surface has about fifteen
 * destinations in groups, which a horizontal bar can only show as a second
 * row. It is attached to the screen edge (no left border, a negative margin
 * cancelling the shell's gutter) and each row is a tab, after the index tabs
 * on a case file.
 *
 * The current tab protrudes past the rail's border with its own hard shadow,
 * so "you are here" is a shape rather than a tint. Groups are disclosures (a
 * caret that turns, set in the label face); destinations are links (the
 * reading face). Motion is horizontal, toward the content, and is dropped
 * under `prefers-reduced-motion`.
 */

const RAIL_W = "17rem";
const RAIL_W_COLLAPSED = "3rem";

export function DataRail() {
  const pathname = usePathname();
  const active = sectionForPath(pathname);
  const onOverview = pathname.replace(/\/+$/, "") === OVERVIEW.href;

  // Below `lg` the rail is a side panel that slides in from the same edge.
  const [panelOpen, setPanelOpen] = useState(false);

  // Desktop starts open, and collapsing is a layout change, not an overlay.
  // The state isn't kept in a URL or cookie: reading either would make every
  // data page dynamic.
  const [railOpen, setRailOpen] = useState(true);

  const [open, setOpen] = useState<DataGroup | null>(active?.group ?? null);

  // Sticky only when it fits. A sticky element taller than the viewport never
  // shows its bottom, and a scroll box would clip the protruding tab, so the
  // rail measures itself against the space under the header and scrolls with
  // the page when it's taller.
  const navRef = useRef<HTMLElement>(null);
  const [fits, setFits] = useState(true);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => {
      const root = getComputedStyle(document.documentElement);
      const header = parseFloat(root.getPropertyValue("--site-header-max-h")) || 72;
      const banner = parseFloat(root.getPropertyValue("--security-banner-h")) || 0;
      setFits(el.scrollHeight <= window.innerHeight - header - banner);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [railOpen]);

  // Client-side navigation changes the pathname without remounting, so the
  // open group has to follow it. Without this, walking from Queue into
  // another group leaves the rail insisting you are still in Queue.
  useEffect(() => {
    const next = sectionForPath(pathname);
    if (next) setOpen(next.group);
  }, [pathname]);

  // Arriving somewhere closes the drawer.
  useEffect(() => {
    setPanelOpen(false);
  }, [pathname]);

  // Escape closes the panel, and the body stops scrolling behind it. Both are
  // what a reader expects of anything that covers the page, and neither is
  // optional once the thing is an overlay rather than a block in the flow.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [panelOpen]);

  if (!isDataPath(pathname)) return null;

  const body = (
    <>
      <Tab
        href={OVERVIEW.href}
        label={OVERVIEW.label}
        current={onOverview}
        kind="home"
      />{" "}
      {GROUPS.map((g) => {
        const isOpen = g === open;
        const items = SECTIONS.filter((s) => s.group === g);
        const holdsActive = active?.group === g;
        return (
          <Fragment key={g}>{" "}
            <div>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`rail-${slug(g)}`}
                onClick={() => setOpen(isOpen ? null : g)}
                className={cn(
                  // `group/tab` stays because a child targets it; the rest
                  // is the `rail-tab` class in globals.css.
                  "group/tab rail-tab",
                  isOpen ? "text-foreground" : "text-foreground/65",
                )}
              >
                {/* The spine: four pixels of lime marking the group that holds
                    the current page, shown only while the group is shut. Open,
                    the lit leaf below already says it, and a second strip of
                    lime above it reads as a leak. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 transition-colors duration-150",
                    holdsActive && !isOpen
                      ? "bg-primary"
                      : "bg-transparent group-hover/tab:bg-border",
                  )}
                />
                <CaretRightIcon
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-200 ease-out",
                    "motion-reduce:transition-none",
                    isOpen && "rotate-90",
                  )}
                  weight="bold"
                  aria-hidden="true"
                />{" "}
                <span className="flex-1">{g}</span>
              </button>{" "}
              {/* The height animation. `grid-template-rows` 0fr to 1fr is the
                  one technique that transitions to content height without a
                  measured pixel value - and it only collapses if the child
                  carries BOTH `min-h-0` and `overflow-hidden`, which is the
                  documented trap. `inert` takes the links out of the tab order
                  while closed; `hidden` would defeat the transition. */}
              <div
                id={`rail-${slug(g)}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  "motion-reduce:transition-none",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <ul
                  // Wider than the rail by the tab's reach plus its shadow
                  // (14 + 2 = 16px). `overflow-hidden`, which makes the `0fr`
                  // collapse reach zero, also clips sideways, so without this
                  // the current leaf's fill and shadow would be cut at the
                  // rail's edge. Each leaf's margin decides where it stops.
                  className={cn(
                    "min-h-0 w-[calc(100%+16px)] overflow-hidden",
                    // Only while open: `overflow` clips at the padding box, so
                    // bottom padding on a collapsed group would show 2px of the
                    // current tab's lime.
                    isOpen && "pb-[2px]",
                  )}
                  inert={!isOpen}
                >
                  {items.map((s) => (
                    <Fragment key={s.key}>{" "}
                      <li>
                        <Tab
                          href={s.href}
                          label={s.label}
                          current={active?.key === s.key}
                          kind="leaf"
                        />
                      </li>
                    </Fragment>
                  ))}
                </ul>
              </div>
            </div>
          </Fragment>
        );
      })}
    </>
  );

  return (
    <>
      {/* Desktop: a column with one right border that stretches to the
          content's height, so the rail reads as part of the page's structure.
          The nav inside is sticky. No background (a card tint in dark mode is a
          faint grey box), and no `overflow-y`: setting one axis to `auto` makes
          the other `auto` too, which would clip the protruding tab. */}
      <div
        className={cn(
          "-ml-4 hidden bg-background sm:-ml-6 lg:block lg:shrink-0 lg:self-stretch",
          // Collapsed, there's no rail to draw an edge for, just a tab.
          railOpen && "lg:border-r-2 lg:border-border",
          // Collapsing changes this column's width; the content beside it is
          // `lg:flex-1` and takes the space back. No overlay, no scrim.
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        )}
        style={{ width: railOpen ? RAIL_W : RAIL_W_COLLAPSED }}
      >
        {/* Sticky at the column's own top (the same offset `main` pads by), so
            the rail never drifts on the first pixels of scroll. A flex column
            with a minimum height, so the footer's `mt-auto` has a viewport to
            push against; no `overflow`, which would clip the protruding tab. */}
        <nav
          ref={navRef}
          aria-label="Data sections"
          className={cn("flex flex-col py-2 lg:py-1", fits ? "sticky" : "relative")}
          style={{
            // `top` only while sticky: on a `relative` element the same value
            // would shift the rail down by a header's height.
            top: fits
              ? "calc(var(--site-header-max-h, 4.5rem) + var(--security-banner-h, 0px))"
              : undefined,
            minHeight: "calc(100dvh - var(--site-header-max-h, 4.5rem) - 2rem - var(--security-banner-h, 0px))",
          }}
        >
          {railOpen ? (
            <>
              {/* The collapse control, drawn as a tab sitting ON the rail's
                  right border so it reads as part of that edge rather than a
                  button placed near it - the same reasoning as the mobile
                  handle, which is the shape it turns into when collapsed. */}
              <button
                type="button"
                aria-expanded={true}
                aria-controls="data-rail-desktop"
                onClick={() => setRailOpen(false)}
                className={cn(
                  // Sits on the rail's right border with no left border of its
                  // own: its left edge overlaps the rail's 2px border, so the
                  // two outlines join into one shape (the mobile handle does
                  // the same).
                  "-mr-[36px] mb-1 flex size-9 shrink-0 items-center justify-center self-end",
                  "border-y-2 border-r-2 border-border bg-background text-primary",
                  "transition-colors duration-150 hover:bg-tint-primary",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  "motion-reduce:transition-none",
                )}
              >
                <span className="sr-only">Collapse data sections</span>
                <CaretRightIcon className="size-4 rotate-180" weight="bold" aria-hidden="true" />
              </button>
              <div id="data-rail-desktop" className="flex flex-1 flex-col">
                {body}
                <RailFooter />
              </div>
            </>
          ) : (
            /* Collapsed, the tab still names the current section, set
               vertically. A caret pointing into the page means "this opens". */
            <button
              type="button"
              aria-expanded={false}
              aria-controls="data-rail-desktop"
              onClick={() => setRailOpen(true)}
              className={cn(
                // A tab, not a bar: sized to its content and protruding like
                // every other tab. No `w-full`: with an explicit width the
                // negative margin moves the next sibling instead of reaching
                // out.
                "-mr-[12px] flex shrink-0 flex-col items-center gap-3 py-3",
                "border-y-2 border-r-2 border-border bg-background",
                "text-primary transition-colors duration-150 hover:bg-tint-primary",
                "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary",
                "motion-reduce:transition-none",
              )}
            >
              <span className="sr-only">Expand data sections</span>
              <CaretRightIcon className="size-4 shrink-0" weight="bold" aria-hidden="true" />
              <span
                aria-hidden="true"
                className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-foreground/70"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                {active?.label ?? OVERVIEW.label}
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Below lg: the same side panel, pulled out by a tab on the screen edge,
          so the sections are a fixed edge on every width. The handle is the
          caret alone, a 44px square in the gap under the header; a version
          carrying the section name was tall enough to cover the page's heading.
          The panel names the section once it's open. */}
      <button
        type="button"
        aria-expanded={panelOpen}
        aria-controls="data-rail-panel"
        onClick={() => setPanelOpen((v) => !v)}
        // The header's measured height, not a constant: it shrinks on scroll.
        style={{ top: "calc(var(--site-header-h, 4.5rem) + 4px)" }}
        className={cn(
          // `z-[41]`: above the panel, below the header's 50. At equal z-index
          // the panel (rendered later) would paint its border over the handle.
          "fixed left-0 z-[41] flex size-11 items-center justify-center",
          "border-y-2 border-r-2 border-border bg-background shadow-hard-sm",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "lg:hidden",
          // Open, it lands 2px short of the panel's right edge so it sits on
          // that border and the outlines join. It doesn't move vertically: the
          // drawer reserves `pt-[52px]` so the handle sits beside empty panel.
          panelOpen && "translate-x-[calc(17rem-2px)]",
        )}
      >
        <span className="sr-only">
          {panelOpen ? "Close data sections" : "Open data sections"}
        </span>
        <CaretRightIcon
          className={cn(
            "size-4 shrink-0 text-primary transition-transform duration-200 ease-out",
            "motion-reduce:transition-none",
            panelOpen && "rotate-180",
          )}
          weight="bold"
          aria-hidden="true"
        />{" "}
      </button>

      {/* The scrim. It is what makes the panel dismissible by tapping away,
          which is the gesture people actually use, and it is `aria-hidden`
          because Escape and the handle are the accessible affordances. */}
      {panelOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      ) : null}

      <nav
        id="data-rail-panel"
        aria-label="Data sections"
        style={{ top: "var(--site-header-h, 4.5rem)" }}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
        className={cn(
          // Below the header (`z-40`), starting at its bottom edge, so the
          // header and its menu are always on top and nothing overlaps.
          //
          // Here the current tab runs the panel's full width: the panel
          // scrolls, and a scrolling box can't let a tab protrude (one axis
          // `auto` makes the other `auto`), so its negative margin is zeroed.
          // The protrusion stays a desktop move.
          "fixed bottom-0 left-0 z-40 flex w-[17rem] flex-col overflow-y-auto border-r-2 border-border bg-background pb-4 pt-[52px] [&_[aria-current=page]]:mr-0 [&_ul]:w-full",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          "lg:hidden",
          panelOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {body}
        <RailFooter />
      </nav>
    </>
  );
}

/**
 * The state marker at the head of a tab, and the one place the rail says it is
 * working.
 *
 * It reads `useLinkStatus`, so it sits inside the link: Next publishes the
 * pending state through a context the `<Link>` renders. That clears on commit,
 * failure and supersede alike, so a click that goes nowhere can't leave a row
 * spinning.
 *
 * The marker BOX never changes size, so a row does not jump when a navigation
 * turns out to be slow: the spinner replaces the glyph in place. It rotates,
 * it does not pulse, and `motion-reduce` stops the rotation.
 */
function TabMarker({ current, kind }: { current: boolean; kind: "home" | "leaf" }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "rail-marker",
        current ? "text-black" : kind === "home" ? "text-primary" : "text-transparent",
        // A leaf's marker is transparent until it is the current page. While a
        // navigation is running it has to be visible or there is no signal at
        // all, which is the whole point of the row.
        pending && !current && "text-foreground",
      )}
    >
      {pending ? (
        <CircleNotchIcon className="size-3.5 animate-spin motion-reduce:animate-none" weight="bold" />
      ) : kind === "home" ? (
        // Overview alone gets a real glyph. It is the section's front page
        // rather than a page inside it, and a house says that in the place
        // where every other row carries only a state marker.
        <HouseIcon className="size-3.5" weight="fill" />
      ) : (
        // A square, not a dot: the site's marker vocabulary is square.
        <span className="size-1.5 bg-current" />
      )}
    </span>
  );
}

/**
 * One tab. A destination, not a container.
 *
 * `kind` is the type distinction made visible: `home` is the section's own
 * front page and takes the heading face; `leaf` is a page inside a group and
 * takes the reading face, indented under the group it belongs to.
 *
 * The pending state is why this is not a bare `<Link>`. A data page can take a
 * moment, and without a signal the rail looks dead and gets clicked twice.
 */
function Tab({
  href,
  label,
  current,
  kind,
}: {
  href: string;
  label: string;
  current: boolean;
  kind: "home" | "leaf";
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        // `rail-row` (globals.css) carries the layout, transition, focus ring
        // and reduced-motion opt-out as one class; this row renders about 30
        // times on every data page.
        "rail-row",
        // Size is the hierarchy: Overview is the parent of every group, so it
        // takes a larger type step and a taller row; leaves keep the indent.
        kind === "home" ? "min-h-11 pl-4 text-base" : "pl-9 text-sm",
        // Where the row stops. A leaf sits in a clip box 16px wider than the
        // rail, so its margin subtracts back: 2px leaves the fill 12px past the
        // border with the shadow inside the box; 16px pulls an unselected row
        // back to the border. Overview sits in the nav itself and reaches
        // further (18px) to mark it as the parent.
        kind === "leaf" && (current ? "mr-[2px]" : "mr-[16px]"),
        current
          ? // The pulled tab, the same shape wherever it sits: from the screen
            // edge past the border, with the shadow. Black on lime is 9.83:1.
            // The label keeps its sibling's indent, so a selected leaf still
            // reads as inside its group.
            cn(
              "bg-primary pr-4 font-heading font-black text-black shadow-hard-sm",
              kind === "home" && "-mr-[20px]",
            )
          : cn(
              "text-foreground/75 hover:translate-x-[3px] hover:bg-tint-primary hover:text-foreground",
              kind === "home" ? "font-heading font-black" : "font-semibold",
            ),
      )}
    >
      {kind === "leaf" && !current ? (
        // The connector: a short rule tying the leaf back to the group above
        // it, so an indented row reads as belonging rather than merely being
        // pushed over. The current tab has no indent to explain, and drawing
        // it there would put a rule through the middle of a solid block.
        <span
          aria-hidden="true"
          className="rail-guide"
        />
      ) : null}
      <TabMarker current={current} kind={kind} />{" "}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

/**
 * What sits under the last section: the lookup, pinned to the foot of the rail.
 *
 * It stays at the bottom (`mt-auto` in a flex column with a viewport-based
 * minimum height); the rail fits around it with 40px rows at `lg` and up, and
 * drops `sticky` when the viewport is too short (measured above). Overview,
 * six groups, one open group and this block measure about 740px at 1440x812.
 *
 * IT IS THE ACTION, NOT ANOTHER LINK. Every figure on these pages is an
 * aggregate, and the question underneath every aggregate is "where does that
 * leave me". It repeats a destination that also appears under Case tools,
 * and that is fine: a list entry and a call to action are different things
 * doing different jobs.
 */
function RailFooter() {
  return (
    // Tighter padding at `lg`, where the rail has to fit under the header.
    <div className="mt-auto border-t-2 border-border px-4 pb-2 pt-3 lg:pb-1 lg:pt-2">
      <p className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Track a case
      </p>{" "}
      {/* The sentence shows only in the touch drawer, which scrolls; on the
          desktop rail the label and button say enough in less height. */}
      <p className="mt-1 text-sm leading-snug text-foreground/75 lg:hidden">
        Its DOL record and its place in the queue.
      </p>{" "}
      <Link
        href="/perm-case-status"
        className={cn(
          "mt-2.5 flex min-h-11 items-center justify-center gap-2 border-2 border-border bg-primary px-3 lg:mt-2",
          "font-heading text-sm font-black text-black shadow-hard-sm",
          "transition-transform duration-150 ease-out hover:-translate-y-[1px] active:translate-y-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        {/* The case page can ask DOL live (seconds), so it shows a pending
            signal. */}
        <LinkPending />
        Check my case
      </Link>
    </div>
  );
}

function slug(g: string): string {
  return g.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
