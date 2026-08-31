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

  // Below `lg` the rail is a real side panel that slides in, not a list
  // stacked above the article. Adam: "on mobile it should be a side still but
  // expandable with an arrow tab thing that can open and close the side panel."
  const [panelOpen, setPanelOpen] = useState(false);

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
  useEffect(() => {
    setPending(null);
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
                {/* THE SPINE, AND ONLY WHILE THE GROUP IS SHUT. Four pixels of
                    lime at the very edge saying "the page you are on is in
                    here", which is worth stating when the group is collapsed
                    and its contents are invisible.

                    Open, it was actively bad. Adam: "the left side of the
                    dropdown category is awk and weird u see the green behind
                    it?" With the group expanded, the active leaf directly
                    below is already a solid lime block, so the spine put a
                    second, thinner piece of lime immediately above it at a
                    different width - reading as the fill leaking out from
                    behind the header rather than as a marker. The expanded
                    caret and the lit leaf say the same thing between them, so
                    the spine has nothing left to add and gets out of the way. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 transition-colors duration-150",
                    holdsActive && !isOpen
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
                <ul
                  // WIDENED BY THE PROTRUSION, and that is not a cosmetic
                  // tweak. `overflow-hidden` is what makes the `0fr` collapse
                  // actually reach zero height, and it clips HORIZONTALLY too -
                  // so a leaf tab reaching past the rail's border was being cut
                  // off at this box's edge while its geometry said otherwise.
                  // The tab measured 284 wide and painted to 269.5, which no
                  // DOM measurement shows and a pixel scan of a screenshot did.
                  // It is also why Overview protruded and no leaf ever could:
                  // Overview is not inside one of these.
                  //
                  // WIDEN IT BY THE PROTRUSION *PLUS THE SHADOW*, which is the
                  // second half of the same bug. Adam, once the fill came
                  // through: "it like is blunt end or something and looks
                  // ugly... esp the borders/edges of the green rectangle."
                  // `shadow-hard-sm` is `2px 2px 0`, so a clip box sized to the
                  // fill exactly cuts the shadow off flush down the tab's right
                  // side - a hard vertical stop where Overview, which is not in
                  // one of these boxes, gets its full offset edge. `pb-[2px]`
                  // is the same fix downward, for the last item in the list.
                  //
                  // 16px = 14 of reach + 2 of shadow. Each leaf then carries
                  // the margin that decides where it stops (below).
                  className="min-h-0 w-[calc(100%+16px)] overflow-hidden pb-[2px]"
                  inert={!isOpen}
                >
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
        className="-ml-4 hidden bg-background sm:-ml-6 lg:block lg:shrink-0 lg:self-stretch lg:border-r-2 lg:border-border"
        style={{ width: RAIL_W }}
      >
        {/* A flex column with a MIN height, so the footer's `mt-auto` has a
            viewport to push against and the rail still grows rather than
            clipping if the open group makes it taller than that. `min-height`
            and not `height` for exactly that reason, and no `overflow` for the
            reason given above - a scroll container would clip the protrusion. */}
        <nav
          aria-label="Data sections"
          className="sticky flex flex-col py-2"
          style={{
            top: "calc(5rem + var(--security-banner-h, 0px))",
            minHeight: "calc(100dvh - 7rem - var(--security-banner-h, 0px))",
          }}
        >
          {body}
          <RailFooter />
        </nav>
      </div>

      {/* Below lg: STILL A SIDE PANEL, pulled out by a tab on the screen edge.
          Adam: "on mobile it should be a side still but expandable with an
          arrow tab thing that can open and close the side panel... with
          animation and arrow switches direction when open v closed and bonus
          if when closed still shows what's selected."

          It used to be a `<details>` stacked above the article, which is the
          ordinary answer and loses the thing that makes this rail work: on
          desktop the sections are a fixed edge you navigate from, and turning
          them into a strip above the text on a phone makes them a header you
          scroll past once. A panel that slides out of the same edge keeps one
          idea across both widths.

          The handle is a real tab, drawn like the current one on desktop: no
          left border, so it belongs to the edge rather than sitting near it.
          Closed, it carries the current section's name set vertically, so the
          phone answers "where am I" without being opened at all. */}
      <button
        type="button"
        aria-expanded={panelOpen}
        aria-controls="data-rail-panel"
        onClick={() => setPanelOpen((v) => !v)}
        className={cn(
          "fixed left-0 top-[84px] z-[61] flex items-center gap-1 py-3 pl-1 pr-1.5",
          "border-y-2 border-r-2 border-border bg-background shadow-hard-sm",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "lg:hidden",
          panelOpen && "translate-x-[17rem]",
        )}
      >
        <span className="sr-only">
          {panelOpen ? "Close data sections" : "Open data sections"}
        </span>
        <CaretRight
          className={cn(
            "size-4 shrink-0 text-primary transition-transform duration-200 ease-out",
            "motion-reduce:transition-none",
            panelOpen && "rotate-180",
          )}
          weight="bold"
          aria-hidden="true"
        />{" "}
        {!panelOpen ? (
          <span
            aria-hidden="true"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/70"
            // Vertical so the handle stays a thin tab rather than a slab
            // across the edge of the article. `mixed` keeps the Latin
            // characters upright inside the rotated line.
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            {active?.label ?? OVERVIEW.label}
          </span>
        ) : null}
      </button>

      {/* The scrim. It is what makes the panel dismissible by tapping away,
          which is the gesture people actually use, and it is `aria-hidden`
          because Escape and the handle are the accessible affordances. */}
      {panelOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
        />
      ) : null}

      <nav
        id="data-rail-panel"
        aria-label="Data sections"
        aria-hidden={!panelOpen}
        inert={!panelOpen}
        className={cn(
          // THE CURRENT TAB RUNS THE FULL WIDTH OF THE PANEL HERE. Adam: "the
          // selection for mobile should go all the way not stop early."
          //
          // Cancelling the tab's negative right margin is what allows that
          // while the panel still scrolls. A scrolling box cannot have
          // `overflow-x: visible` - setting one axis to `auto` makes the other
          // `auto` as well - so a tab reaching past the panel's edge would
          // become a horizontal scrollbar rather than a protrusion. An earlier
          // version padded the panel instead, which stopped the overflow and
          // also stopped the tab about six pixels short of the edge, which is
          // the thing being complained about. Zero the margin and it lands
          // exactly on the boundary.
          //
          // The protrusion stays a desktop move, where there is a gutter for it
          // to reach into and nothing clipping it.
          "fixed inset-y-0 left-0 z-[60] flex w-[17rem] flex-col overflow-y-auto border-r-2 border-border bg-background py-4 [&_[aria-current=page]]:mr-0",
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
        "relative flex min-h-11 items-center gap-2.5 py-2 pr-3",
        "transition-[transform,background-color,box-shadow,color] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary",
        "motion-reduce:transition-none motion-reduce:hover:translate-x-0",
        // SIZE IS THE HIERARCHY. Adam: "make overview bigger and make this one
        // like the (old) overview if u want hierarchy or something." Overview
        // is the parent of every group rather than a peer of any item, so it
        // takes a larger step on the type scale and a taller row. The leaves
        // keep the indent. Neither has to give up the selected shape to say
        // where it sits.
        kind === "home" ? "min-h-12 pl-4 text-base" : "pl-9 text-sm",
        // WHERE THE ROW STOPS, and the two kinds get there differently because
        // they live in different boxes. A leaf sits inside a clip box that is
        // 16px wider than the rail, so its margin subtracts back down: 2px
        // leaves the fill ending 12px past the border with the shadow's 2px
        // still inside the box, 16px pulls an unselected row back to the border
        // so hover tint never crosses it. Overview sits directly in the nav
        // with nothing clipping it and pulls itself out with a negative margin.
        //
        // Overview reaches further on purpose. Adam: "just make overview one a
        // bit bigger (or extend out a bit more for visual heirscrchy)". It is
        // the parent of every group, so it gets both - a step up the type scale
        // and 18px of reach against a leaf's 12 - while the treatment itself
        // stays identical, which is what he asked for first: "make this just
        // like the og overview one".
        kind === "leaf" && (current ? "mr-[2px]" : "mr-[16px]"),
        current
          ? // THE PULLED TAB, AND IT IS THE SAME SHAPE WHEREVER IT SITS. It
            // runs from the screen edge past the rail's border into the
            // gutter and carries the shadow, so the current page is a thing
            // sticking out rather than a tinted row. Black on lime measures
            // 9.83:1, which is why the label is ink and not white.
            //
            // THE BLOCK MATCHES OVERVIEW; THE LABEL STAYS WITH ITS SIBLINGS.
            // Adam, on the Overview tab: "i like how it's done here how it's
            // like a nice rectangle and extends past", on a selected leaf:
            // "when it's selecting from one that's under a sub it doesn't look
            // at good... if find a way to show its from an expanded but match
            // the overview one it would look the best", and then, on making
            // them identical: "needs to be obv part of the category thing."
            //
            // Both are right, and they are not in tension once you separate
            // the two things the old leaf style was doing at once. The SHAPE -
            // starting at the screen edge, running past the rail's border,
            // carrying the shadow - is what says "this is the page you are
            // on", and shortening it for a nested page made the selected state
            // weaker for no reason. The TEXT INDENT is what says "this sits
            // inside the group above", and it survives untouched: the label
            // lines up with its unselected siblings, under a header whose
            // caret is turned down. One rectangle, two facts, neither one
            // paying for the other.
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
          className="absolute left-4 top-0 h-full w-px bg-border/60 transition-colors duration-150"
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

/**
 * What sits under the last section.
 *
 * Adam: "we do need to add something to the bottom of that side thing though."
 * The tabs ran out two thirds of the way up and left the column empty under
 * them, which on a rail that now runs the full height of the page is a large
 * amount of nothing.
 *
 * IT IS THE ACTION, NOT ANOTHER LINK. A second copy of the nav list, a logo, or
 * a "resources" block would be filler dressed as content. The one thing a
 * reader of these pages reliably wants next is their own case: every figure
 * here is an aggregate, and the question underneath every aggregate is "where
 * does that leave me". So the bottom of the rail is the lookup, phrased as what
 * it does rather than as a slogan.
 *
 * It repeats a destination that also appears under Case tools, and that is
 * fine - a list entry and a call to action are different things doing different
 * jobs, and only one of them is findable by someone who has not thought to open
 * a group.
 */
function RailFooter() {
  return (
    // `mt-auto` is what pins it to the bottom of the panel rather than letting
    // it trail the last tab. Adam: "the thing added below the tabs in side
    // panel should be near the bottom." Both navs are flex columns with a
    // height to push against, so this resolves to the foot of the rail on a
    // tall viewport and collapses to a normal gap on a short one.
    <div className="mt-auto border-t-2 border-border px-4 pb-2 pt-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Track a case
      </p>{" "}
      <p className="mt-2 text-sm text-foreground/75">
        Look up a case number for its DOL record and its place in the queue.
      </p>{" "}
      <Link
        href="/perm-case-status"
        className={cn(
          "mt-3 flex min-h-11 items-center justify-center border-2 border-border bg-primary px-3",
          "font-heading text-sm font-black text-black shadow-hard-sm",
          "transition-transform duration-150 ease-out hover:-translate-y-[1px] active:translate-y-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        Check my case
      </Link>
    </div>
  );
}

function slug(g: string): string {
  return g.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
