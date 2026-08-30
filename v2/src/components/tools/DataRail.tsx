"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDown, CaretRight, CircleNotch } from "@phosphor-icons/react";

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
 * The data surface's navigation: one vertical rail, replacing a two-tier bar.
 *
 * WHY A RAIL. Adam: "instead of 2 tiers its confusing and not intuitive...
 * double header is awk." The research agrees and gives the threshold: a top
 * bar suits five to seven destinations, and this surface has fifteen in five
 * groups, at which point a horizontal nav either truncates into a menu or
 * grows a second row - the site had the second row. NN/g's finding is that a
 * vertical list is scanned in fewer eye fixations than a horizontal one, and
 * a rail can hold nested groups without hiding them behind a hover.
 *
 * The marketing header above is untouched. It has five links and is correctly
 * a top bar; the mistake was making a fifteen-item dashboard nav look like a
 * second one.
 *
 * THE GROUP HEADERS ARE BUTTONS AND LOOK LIKE BUTTONS. That is the actual
 * complaint - "ppl click the top ones and are confused why they didnt go
 * anywhere" - and it is a documented failure mode: nothing tells a reader a
 * parent is inert until they click it. Each header carries a caret that
 * points right when closed and down when open, is not underlined, and does
 * not take link colour. It is a disclosure, and it reads as one.
 *
 * ONLY ONE GROUP IS OPEN AT A TIME, and the one holding the current page opens
 * on arrival. A rail where everything is expanded is a fifteen-item list with
 * headings in it, which is the flat menu this replaced.
 *
 * BELOW `lg` THERE IS NO RAIL. A 260px column on a 390px screen is most of the
 * screen, so the same groups render as a stacked disclosure above the content.
 * The markup is one tree; only the container's positioning differs.
 */

const RAIL_W = "17rem";

export function DataRail() {
  const pathname = usePathname();
  const active = sectionForPath(pathname);
  const onOverview = pathname.replace(/\/+$/, "") === OVERVIEW.href;

  // The group holding the current page, so arriving anywhere opens the right
  // one. `null` on Overview: it belongs to no group, and force-opening one
  // there would assert a relationship that does not exist.
  const [open, setOpen] = useState<DataGroup | null>(active?.group ?? null);

  // Client-side navigation changes the pathname without remounting, so the
  // open group has to follow it. Without this, walking from Queue to a link
  // in another group leaves the rail insisting you are still in Queue.
  useEffect(() => {
    const next = sectionForPath(pathname);
    if (next) setOpen(next.group);
  }, [pathname]);

  // The link the reader has just clicked, so the rail can show it is working.
  // Cleared whenever the pathname actually changes, which is the only honest
  // signal that the navigation finished.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  if (!isDataPath(pathname)) return null;

  const body = (
    <>
      <RailLink
        href={OVERVIEW.href}
        label={OVERVIEW.label}
        current={onOverview}
        pending={pending === OVERVIEW.href}
        onNavigate={setPending}
        emphasis
      />{" "}
      {GROUPS.map((g) => {
        const isOpen = g === open;
        const items = SECTIONS.filter((s) => s.group === g);
        const holdsActive = active?.group === g;
        return (
          <Fragment key={g}>{" "}
            <div className="mt-1">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`rail-${slug(g)}`}
                onClick={() => setOpen(isOpen ? null : g)}
                className={cn(
                  // NOT link-styled: no underline, no link colour. A reader
                  // must be able to tell this is a disclosure before clicking.
                  "flex min-h-11 w-full items-center gap-2 px-3 text-left font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                  "hover:bg-tint-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  isOpen ? "text-foreground" : "text-foreground/60 hover:text-foreground",
                )}
              >
                {isOpen ? (
                  <CaretDown className="size-3.5 shrink-0" weight="bold" aria-hidden="true" />
                ) : (
                  <CaretRight className="size-3.5 shrink-0" weight="bold" aria-hidden="true" />
                )}{" "}
                <span className="flex-1">{g}</span>{" "}
                {/* Marks the group holding the current page while a different
                    one is open, so "where am I" survives browsing. */}
                {holdsActive && !isOpen ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                  />
                ) : null}
              </button>{" "}
              <ul
                id={`rail-${slug(g)}`}
                hidden={!isOpen}
                className="mt-0.5 border-l-2 border-border/50 pl-2"
              >
                {items.map((s) => (
                  <Fragment key={s.key}>{" "}
                    <li>
                      <RailLink
                        href={s.href}
                        label={s.label}
                        current={active?.key === s.key}
                        pending={pending === s.href}
                        onNavigate={setPending}
                      />
                    </li>
                  </Fragment>
                ))}
              </ul>
            </div>
          </Fragment>
        );
      })}
    </>
  );

  return (
    <>
      {/* Desktop: a sticky rail. `top` clears the fixed header plus the
          security banner, whose height is published as a variable and set to
          0 when dismissed - the same expression the header and the old bar
          used, so all three move together. */}
      <nav
        aria-label="Data sections"
        className="hidden lg:block lg:shrink-0 lg:self-start lg:sticky"
        style={{
          width: RAIL_W,
          top: "calc(5rem + var(--security-banner-h, 0px))",
          maxHeight: "calc(100dvh - 6rem - var(--security-banner-h, 0px))",
          overflowY: "auto",
        }}
      >
        <div className="border-2 border-border bg-card py-2 shadow-hard-sm">{body}</div>
      </nav>

      {/* Below lg: the same tree, stacked above the content and collapsed by
          default so it costs one row rather than a screen. */}
      <nav aria-label="Data sections" className="lg:hidden">
        <details className="border-2 border-border bg-card">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-mono text-xs font-bold uppercase tracking-[0.1em] marker:content-none [&::-webkit-details-marker]:hidden">
            <CaretRight className="size-3.5 shrink-0" weight="bold" aria-hidden="true" />{" "}
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
 * One destination.
 *
 * The pending state is the reason this is not a bare `<Link>`. A data page can
 * take a moment to render, and without a signal the rail looks inert and gets
 * clicked twice. The spinner replaces the marker rather than sitting beside
 * it, so nothing moves when it appears.
 */
function RailLink({
  href,
  label,
  current,
  pending,
  onNavigate,
  emphasis,
}: {
  href: string;
  label: string;
  current: boolean;
  pending: boolean;
  onNavigate: (href: string) => void;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={() => {
        // Never on the page you are already on: a spinner that cannot resolve
        // is worse than none, because nothing will clear it.
        if (!current) onNavigate(href);
      }}
      className={cn(
        "flex min-h-11 items-center gap-2 px-3 text-sm transition-colors",
        "hover:bg-tint-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        emphasis ? "font-heading font-black" : "font-semibold",
        current
          ? "bg-tint-primary text-foreground"
          : "text-foreground/70 hover:text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center",
          current ? "text-primary" : "text-transparent",
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
