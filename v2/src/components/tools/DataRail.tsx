"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight, CircleNotch } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

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
 * WHY A RAIL AT ALL. Adam: "instead of 2 tiers its confusing and not
 * intuitive... double header is awk." A top bar suits five to seven
 * destinations and this surface has fifteen in five groups, at which point a
 * horizontal nav either truncates into a menu or grows a second row. It had
 * the second row.
 *
 * WHY IT LOOKS LIKE THIS. The first rail was a bordered rectangle with a list
 * in it, floating in the gutter, and Adam was right to call it: "ugly lazy low
 * effort ai slop... mayb emake it like tabs? and coming out of the left not
 * floating?" A bordered box with a highlighted row is the DEFAULT answer to
 * "sidebar" - it has no relationship to the page it sits on and no
 * relationship to the thing it navigates.
 *
 * The metaphor here is not decoration, it is the subject's own artifact: this
 * is a system for reading government case records, and case records have index
 * tabs down the side. So the rail is BOLTED to the left edge rather than
 * floating beside it - no left border, negative margin cancelling the shell's
 * gutter - and each row is a tab rather than a list item.
 *
 * THE SIGNATURE IS THAT THE CURRENT TAB PROTRUDES. It extends past the rail's
 * right edge into the content gutter and carries its own hard shadow, the way
 * a pulled file tab sticks out of a drawer. "You are here" becomes a physical
 * fact rather than a background colour, which is the one place this component
 * spends any boldness. Everything else stays quiet.
 *
 * STRUCTURE CARRIES INFORMATION. Groups are set in the mono label face,
 * tracked and uppercase, because they are indices. Destinations are set in the
 * reading face, because they are places you can go. The old rail set both the
 * same way, so a container and a link were indistinguishable until you clicked
 * one - which is the complaint that started all of this.
 *
 * THE GROUP HEADERS ARE DISCLOSURES AND LOOK LIKE IT: a caret that rotates
 * rather than two icons swapping, no underline, no link colour. Nothing tells
 * a reader a parent is inert until they click it, and that is a documented
 * usability failure rather than a matter of taste.
 *
 * MOTION IS HORIZONTAL because the rail is edge-anchored. Rows slide right on
 * hover, toward the content; a vertical lift would fight the edge they are
 * attached to. The spine fills, the caret turns, the panel's height opens. All
 * of it is dropped entirely under `prefers-reduced-motion`.
 */

const RAIL_W = "17rem";

export function DataRail() {
  const pathname = usePathname();
  const active = sectionForPath(pathname);
  const onOverview = pathname.replace(/\/+$/, "") === OVERVIEW.href;

  const [open, setOpen] = useState<DataGroup | null>(active?.group ?? null);

  // Client-side navigation changes the pathname without remounting, so the
  // open group has to follow it. Without this, walking from Queue into
  // another group leaves the rail insisting you are still in Queue.
  useEffect(() => {
    const next = sectionForPath(pathname);
    if (next) setOpen(next.group);
  }, [pathname]);

  // The link just clicked, so the rail can show it is working. Cleared when
  // the pathname actually changes, which is the only honest signal that the
  // navigation finished.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  if (!isDataPath(pathname)) return null;

  const body = (
    <>
      <Tab
        href={OVERVIEW.href}
        label={OVERVIEW.label}
        current={onOverview}
        pending={pending === OVERVIEW.href}
        onNavigate={setPending}
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
                  "group/tab relative flex min-h-11 w-full items-center gap-2.5 py-2.5 pl-4 pr-3 text-left",
                  "font-mono text-xs font-bold uppercase tracking-[0.12em]",
                  "transition-[transform,background-color,color] duration-150 ease-out",
                  "hover:translate-x-[3px] hover:bg-tint-primary hover:text-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary",
                  "motion-reduce:transition-none motion-reduce:hover:translate-x-0",
                  isOpen ? "text-foreground" : "text-foreground/65",
                )}
              >
                {/* THE SPINE. Four pixels at the very edge, filled when this
                    group holds the page you are on. It replaces a dot that
                    used to sit at the far end of the row: the same fact,
                    stated where the eye already is when scanning a left edge,
                    and it survives the group being collapsed. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 transition-colors duration-150",
                    holdsActive
                      ? "bg-primary"
                      : "bg-transparent group-hover/tab:bg-border",
                  )}
                />
                <CaretRight
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
                <ul className="min-h-0 overflow-hidden" inert={!isOpen}>
                  {items.map((s) => (
                    <Fragment key={s.key}>{" "}
                      <li>
                        <Tab
                          href={s.href}
                          label={s.label}
                          current={active?.key === s.key}
                          pending={pending === s.href}
                          onNavigate={setPending}
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
      {/* Desktop: a full-height spine with the tabs hanging off the left edge.
          THE FIRST VERSION OF THIS WAS STILL A CARD and measuring it did not
          show that - `railLeft: 0` was true while a bordered box sat in the
          gutter with its own shadow, ending two thirds of the way down the
          page and leaving a tall empty column under it. It took a screenshot.

          So there is no box now. The COLUMN carries a single right border and
          stretches to the height of the content beside it, which is what makes
          the rail read as part of the page's structure rather than an object
          placed on it - and it is why the empty column is gone: there is
          nothing left to end early. No background either. `bg-card` is #1A1A1A
          against a #0A0A0A page, so in dark mode the box was a barely-there
          grey rectangle, which is worse than no box at all.

          `self-stretch` on the column is what lets the border run full height;
          the nav inside it stays `sticky`, so the tabs travel with the reader
          while the spine stays put. The negative margin cancels the shell's
          gutter so the tabs start at the viewport edge.

          NO `overflow-y` HERE, deliberately. Setting one axis to `auto` makes
          the other compute to `auto` as well rather than staying `visible`, so
          it would clip the active tab exactly where it protrudes - the one
          detail the design is built around. The rail is at most Overview plus
          five groups plus one open group's items, and only one group is ever
          open, so it fits any realistic viewport without scrolling. */}
      <div
        className="-ml-4 hidden sm:-ml-6 lg:block lg:shrink-0 lg:self-stretch lg:border-r-2 lg:border-border"
        style={{ width: RAIL_W }}
      >
        <nav
          aria-label="Data sections"
          className="sticky py-2"
          style={{ top: "calc(5rem + var(--security-banner-h, 0px))" }}
        >
          {body}
        </nav>
      </div>

      {/* Below lg: the same tree, stacked above the content. A 272px column on
          a 390px screen is most of the screen, so it collapses to one row. */}
      <nav aria-label="Data sections" className="lg:hidden">
        <details className="group/d border-2 border-border bg-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-3 font-mono text-xs font-bold uppercase tracking-[0.12em] [&::-webkit-details-marker]:hidden">
            <CaretRight
              className="size-3.5 shrink-0 transition-transform duration-200 ease-out group-open/d:rotate-90 motion-reduce:transition-none"
              weight="bold"
              aria-hidden="true"
            />{" "}
            <span>{active?.label ?? OVERVIEW.label}</span>{" "}
            <span className="ml-auto text-muted-foreground">Sections</span>
          </summary>{" "}
          <div className="border-t-2 border-border py-2">{body}</div>
        </details>
      </nav>
    </>
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
  pending,
  onNavigate,
  kind,
}: {
  href: string;
  label: string;
  current: boolean;
  pending: boolean;
  onNavigate: (href: string) => void;
  kind: "home" | "leaf";
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={() => {
        // Never on the page you are already on: a spinner that cannot resolve
        // is worse than none, because nothing will ever clear it.
        if (!current) onNavigate(href);
      }}
      className={cn(
        "relative flex min-h-11 items-center gap-2.5 py-2 pr-3 text-sm",
        "transition-[transform,background-color,box-shadow,color] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary",
        "motion-reduce:transition-none motion-reduce:hover:translate-x-0",
        kind === "home"
          ? "pl-4 font-heading font-black"
          : "pl-9 font-semibold",
        current
          ? // THE PULLED TAB. It runs past the rail's right border into the
            // gutter and carries the shadow, so the current page is a thing
            // sticking out rather than a tinted row. Black on lime measures
            // 9.83:1, which is why the label is ink and not white.
            "-mr-[6px] bg-primary pr-4 text-black shadow-hard-sm"
          : "text-foreground/75 hover:translate-x-[3px] hover:bg-tint-primary hover:text-foreground",
      )}
    >
      {kind === "leaf" ? (
        // The connector: a short rule tying the leaf back to the spine of the
        // group above it, so an indented row reads as belonging rather than
        // merely being pushed over.
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-4 top-0 h-full w-px transition-colors duration-150",
            current ? "bg-black/30" : "bg-border/60",
          )}
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center",
          current ? "text-black" : "text-transparent",
        )}
      >
        {pending ? (
          <CircleNotch className="size-3.5 animate-spin" weight="bold" />
        ) : (
          // A square, not a dot: the site's marker vocabulary is square.
          <span className="size-1.5 bg-current" />
        )}
      </span>{" "}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function slug(g: string): string {
  return g.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
