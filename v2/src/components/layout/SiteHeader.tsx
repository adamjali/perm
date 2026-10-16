"use client";

/**
 * The public site's header: one 64px bar, the page's own colour, on every
 * public page (Oct 14 2026).
 *
 *   PERM Tracker | Case status · Processing times · Data · Learn · For attorneys | search | Sign in
 *
 * The first two are what most people come for. Data opens one panel with the
 * six groups of data pages side by side, so nothing is hunted for group by
 * group; Learn opens the reading and reference pages. On a phone the bar holds
 * the logo, search and Menu, and the menu is one sheet, two levels at most.
 *
 * Every menu link is in the server HTML whether a menu is open or not (search
 * engines read it); a closed panel is `inert`, so it's out of the tab order and
 * the accessibility tree. The bar never changes height and nothing in it moves
 * on scroll: it is the only thing on the page that stays on screen.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDownIcon, FileTextIcon, ListIcon, XIcon } from "@phosphor-icons/react";

import { SiteSearch } from "@/components/search/SiteSearch";
import type { SearchArticle } from "@/components/search/SearchPalette";
import {
  DATA_MENU_FOOTER,
  GROUPS,
  HEADER_PAGES,
  LEARN_PAGES,
  SECTIONS,
  isDataPath,
  type SitePage,
} from "@/lib/siteMap";
import { isArticlePath } from "@/lib/breadcrumbNames";
import { cn } from "@/lib/utils";

type Menu = "data" | "learn" | "mobile" | null;

const pagesIn = (group: string) => SECTIONS.filter((s) => s.group === group);

function isLearnPath(path: string): boolean {
  return LEARN_PAGES.some((p) => path === p.href) || isArticlePath(path);
}

/** A link in the bar: current page marked by a green rule under it. */
function BarLink({ page, current }: { page: SitePage; current: boolean }) {
  return (
    <Link
      href={page.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-11 items-center border-b-2 px-3 text-base transition-colors",
        current ? "border-primary-text font-semibold text-foreground" : "border-transparent text-soft hover:text-foreground",
      )}
    >
      <span className={current ? undefined : "hover-underline"}>{page.name}</span>
    </Link>
  );
}

function MenuButton({
  id,
  label,
  open,
  current,
  onToggle,
}: {
  id: string;
  label: string;
  open: boolean;
  current: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
      className={cn(
        "flex h-11 items-center gap-1 border-b-2 px-3 text-base transition-colors",
        current || open ? "border-primary-text font-semibold text-foreground" : "border-transparent text-soft hover:text-foreground",
      )}
    >
      <span className={current || open ? undefined : "hover-underline"}>{label}</span>
      <CaretDownIcon aria-hidden="true" className={cn("size-4 transition-transform duration-150", open && "rotate-180")} />
    </button>
  );
}

/** A panel under the bar. Always in the HTML; inert and invisible when closed. */
function Panel({ id, open, className, children }: { id: string; open: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "absolute inset-x-0 top-full max-h-[calc(100dvh-var(--site-header-h))] overflow-y-auto overscroll-contain border-b-2 border-black bg-popover shadow-hard transition-opacity duration-150",
        !open && "pointer-events-none invisible opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PanelLink({ page, pathname }: { page: SitePage; pathname: string }) {
  const here = pathname === page.href;
  return (
    <Link
      href={page.href}
      aria-current={here ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center py-1 pl-3 text-[15px] leading-snug transition-colors hover:text-foreground hover:underline",
        here
          ? "font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:bg-primary before:content-['']"
          : "text-soft",
      )}
    >
      {page.name}
    </Link>
  );
}

export default function SiteHeader({ articles = [] }: { articles?: SearchArticle[] }) {
  const pathname = usePathname();
  const [menu, setMenu] = React.useState<Menu>(null);
  const barRef = React.useRef<HTMLElement>(null);

  // A route change closes any menu: one left open covers the page asked for.
  const [shownFor, setShownFor] = React.useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setMenu(null);
  }

  React.useEffect(() => {
    if (menu === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menu]);

  const toggle = (m: Exclude<Menu, null>) => setMenu((now) => (now === m ? null : m));
  const onData = isDataPath(pathname);
  const onLearn = isLearnPath(pathname);

  return (
    <header
      ref={barRef}
      data-site-header=""
      style={{ height: "var(--site-header-h)" }}
      className="fixed inset-x-0 top-0 z-40 border-b-2 border-black bg-[#141414] print:hidden"
    >
      {/* Black in both themes, like the footer (owner, Oct 15 2026): the bar is
          dark-scoped, its dropdown panels below keep the page's theme. */}
      <div className="dark mx-auto flex h-full max-w-[1440px] items-center gap-2 px-4 text-foreground sm:px-6 lg:gap-6">
        <Link
          href="/"
          className="flex h-11 shrink-0 items-center gap-2 font-heading text-xl font-bold text-foreground"
        >
          <FileTextIcon aria-hidden="true" className="size-6 text-primary-text" />
          <span>
            <span className="text-primary-text">PERM</span> Tracker
          </span>
        </Link>{" "}
        <nav aria-label="Main" className="hidden items-center lg:flex">
          <BarLink page={HEADER_PAGES.caseStatus} current={pathname === HEADER_PAGES.caseStatus.href} />{" "}
          <BarLink page={HEADER_PAGES.processingTimes} current={pathname === HEADER_PAGES.processingTimes.href} />{" "}
          <MenuButton
            id="data-menu"
            label="Data"
            open={menu === "data"}
            current={onData && pathname !== HEADER_PAGES.caseStatus.href && pathname !== HEADER_PAGES.processingTimes.href}
            onToggle={() => toggle("data")}
          />{" "}
          <MenuButton id="learn-menu" label="Learn" open={menu === "learn"} current={onLearn} onToggle={() => toggle("learn")} />{" "}
          <BarLink page={HEADER_PAGES.forAttorneys} current={pathname === HEADER_PAGES.forAttorneys.href} />
        </nav>{" "}
        <div className="ml-auto flex items-center gap-1 lg:gap-3">
          <SiteSearch articles={articles} className="w-96" />{" "}
          {pathname !== "/login" ? (
            <Link
              href="/login"
              className="hidden h-10 items-center border border-input bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-accent lg:flex"
            >
              Sign in
            </Link>
          ) : null}{" "}
          <button
            type="button"
            aria-expanded={menu === "mobile"}
            aria-controls="mobile-menu"
            onClick={() => toggle("mobile")}
            className="flex h-11 items-center gap-2 px-2 text-base font-semibold text-foreground hover:bg-accent lg:hidden"
          >
            {menu === "mobile" ? <XIcon aria-hidden="true" className="size-5" /> : <ListIcon aria-hidden="true" className="size-5" />}
            Menu
          </button>
        </div>
      </div>

      <Panel id="data-menu" open={menu === "data"} className="hidden lg:block">
        <div className="mx-auto grid max-w-[1440px] grid-cols-6 gap-x-6 px-6 py-6 xl:gap-x-10">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="pl-3 font-heading text-base font-bold text-foreground">{group}</p>{" "}
              <ul className="mt-2">
                {pagesIn(group).map((p) => (
                  <li key={p.href}>
                    <PanelLink page={p} pathname={pathname} />{" "}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <ul className="mx-auto flex max-w-[1440px] flex-wrap gap-x-8 px-6 py-2">
            {DATA_MENU_FOOTER.map((p) => (
              <li key={p.href}>
                <PanelLink page={p} pathname={pathname} />{" "}
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel id="learn-menu" open={menu === "learn"} className="hidden lg:block">
        <ul className="mx-auto grid max-w-[1440px] grid-cols-4 gap-x-10 px-6 py-5">
          {LEARN_PAGES.map((p) => (
            <li key={p.href}>
              <PanelLink page={p} pathname={pathname} />{" "}
            </li>
          ))}
        </ul>
      </Panel>

      {/* The phone's menu: one sheet, two levels at most. Rendered only while
          open; the desktop panels above already carry every link in the HTML. */}
      {menu === "mobile" ? (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--site-header-h))] overflow-y-auto overscroll-contain border-b-2 border-black bg-popover px-4 pb-8 shadow-hard md:left-auto md:right-4 md:w-[26rem] md:border-x-2 lg:hidden"
        >
          <nav aria-label="Menu" className="divide-y divide-border">
            {[HEADER_PAGES.caseStatus, HEADER_PAGES.processingTimes].map((p) => (
              <Link key={p.href} href={p.href} className="flex min-h-12 items-center text-lg font-semibold">
                {p.name}
              </Link>
            ))}
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-lg font-semibold">
                Data
                <CaretDownIcon aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-5 pb-4">
                {GROUPS.map((group) => (
                  <div key={group}>
                    <p className="text-sm font-semibold text-muted-foreground">{group}</p>
                    <ul>
                      {pagesIn(group).map((p) => (
                        <li key={p.href}>
                          <PanelLink page={p} pathname={pathname} />{" "}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <ul>
                  {DATA_MENU_FOOTER.map((p) => (
                    <li key={p.href}>
                      <PanelLink page={p} pathname={pathname} />{" "}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-lg font-semibold">
                Learn
                <CaretDownIcon aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="pb-4">
                {LEARN_PAGES.map((p) => (
                  <li key={p.href}>
                    <PanelLink page={p} pathname={pathname} />{" "}
                  </li>
                ))}
              </ul>
            </details>
            <Link href={HEADER_PAGES.forAttorneys.href} className="flex min-h-12 items-center text-lg font-semibold">
              {HEADER_PAGES.forAttorneys.name}
            </Link>
            {pathname !== "/login" ? (
              <Link href="/login" className="flex min-h-12 items-center text-lg font-semibold">
                Sign in
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
