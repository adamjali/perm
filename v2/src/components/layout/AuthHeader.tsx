"use client";

/**
 * AuthHeader Component
 * Header for public/authentication pages.
 *
 * ONE NAV, EVERY PUBLIC PAGE: no homepage-only section anchors, because two
 * shapes for one header make the site feel like two sites. The unified list
 * leads with the
 * highest-intent destination (Track my case), then Timelines, Data, the
 * Learn dropdown, and For attorneys, plus site-wide search (Cmd+K).
 *
 * Features:
 * - Logo linking to home (/)
 * - Unified nav from PUBLIC_NAV_LINKS + LEARN_NAV_LINKS with active states
 * - Site search trigger (palette lazy-loads on first open)
 * - Context-aware auth buttons with loading states:
 *   - Hides Sign In on /login page, Sign Up on /signup page
 * - Theme toggle button
 * - Scroll effect: compacts padding when the page is scrolled
 */

import * as React from "react";

// useLayoutEffect warns when React renders this on the server. Same idiom the
// SecurityIncidentBanner already uses.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** The bar compacts past this scroll depth (px)... */
export const SCROLL_COMPACT_ABOVE = 24;
/** ...and grows back only near the top. The band must exceed the bar's 12px change. */
export const SCROLL_EXPAND_BELOW = 4;
import { usePathname } from "next/navigation";
import {
  LEARN_NAV_LINKS,
  PUBLIC_NAV_LINKS,
} from "@/lib/constants/navigation";
import ThemeToggle from "./ThemeToggle";
import { NavLink } from "@/components/ui/nav-link";
import { SiteSearch } from "@/components/search/SiteSearch";
import type { SearchArticle } from "@/components/search/SearchPalette";
import { CaretDownIcon, FileTextIcon, ListIcon as Menu, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export default function AuthHeader({
  articles = [],
}: {
  /** Compact article list for the search palette, read by the server layout. */
  articles?: SearchArticle[];
}) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  // Armed only AFTER the first paint. See the scroll effect below.
  const [motionArmed, setMotionArmed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isLearnOpen, setIsLearnOpen] = React.useState(false);
  const learnRef = React.useRef<HTMLDivElement>(null);

  // Close Learn dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (learnRef.current && !learnRef.current.contains(e.target as Node)) {
        setIsLearnOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Route changes close the mobile menu; a menu that survives navigation
  // covers the page someone just asked for.
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsLearnOpen(false);
  }, [pathname]);

  const showSignIn = pathname !== "/login";
  const showSignUp = pathname !== "/signup";
  const learnActive = LEARN_NAV_LINKS.some((l) => l.href === pathname);

  // Track scroll position for header padding.
  //
  // A LAYOUT effect, not a passive one, and this is the whole point. This
  // component is mounted by three different layouts, so every navigation
  // between the public group and the auth group UNMOUNTS and REMOUNTS it with
  // `isScrolled` back at false. A passive effect corrects that after the
  // browser has already painted, so a visitor arriving from a scrolled page
  // would see the tall bar for one frame and then watch it animate 12px
  // shorter.
  //
  // useLayoutEffect runs synchronously before paint, so the first frame is
  // already correct. `motionArmed` then flips in a passive effect (which runs
  // AFTER that paint) so the corrected value never animates into place on
  // arrival, while ordinary scrolling still transitions.
  //
  // TWO THRESHOLDS, NOT ONE. Compacting the bar moves it 12px,
  // and anything that shifts the page by that much (the browser's scroll
  // anchoring, a phone toolbar) can carry scrollY back across a single
  // threshold, flip the bar, shift the page again, and flip it back. That
  // ping-pong throws React's "Maximum update depth exceeded" (#185) from this
  // handler. The bar compacts past 24px and only grows
  // again under 4px, a 20px band no 12px shift can cross.
  useIsoLayoutEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled((was) => (was ? y > SCROLL_EXPAND_BELOW : y > SCROLL_COMPACT_ABOVE));
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    setMotionArmed(true);
  }, []);

  /**
   * Publish this bar's real height as `--site-header-h`.
   *
   * The bar is 71px at rest, but it isn't a constant: `py-3` becomes
   * `py-1.5` on scroll, the security banner shifts it, and a long label or a
   * zoomed font can wrap it. Anything placed under the fixed header reads this
   * variable rather than a number. Same mechanism `SecurityIncidentBanner`
   * uses for `--security-banner-h`.
   */
  const headerRef = React.useRef<HTMLElement>(null);
  useIsoLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    let max = 0;
    const publish = () => {
      const h = el.offsetHeight;
      root.style.setProperty("--site-header-h", `${h}px`);
      // The RESERVATION never shrinks. `main` pads by this, and padding that
      // followed the live height would reflow the whole page on every scroll.
      if (h > max) {
        max = h;
        root.style.setProperty("--site-header-max-h", `${h}px`);
      }
    };
    publish();
    // `box: "border-box"`: a ResizeObserver watches the content box by
    // default, and this bar shrinks by changing its padding, which would
    // never fire it.
    const ro = new ResizeObserver(publish);
    ro.observe(el, { box: "border-box" });
    // A width change can shrink the bar back, and ResizeObserver alone can't
    // lower a high-water mark. Reset it on a WIDTH change only: a phone fires
    // `resize` whenever its toolbar shows or hides, and resetting then would
    // drop the reservation to the compact bar while scrolled and jump the
    // page 12px.
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      max = 0;
      publish();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      style={{ top: "var(--security-banner-h, 0px)" }}
      className={cn(
        "fixed inset-x-0 z-50 border-b-3 border-white/20 bg-black",
        motionArmed && "transition-[padding,top] duration-200",
        isScrolled ? "py-1.5" : "py-3"
      )}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 sm:px-8">
        {/* Logo */}
        <NavLink
          href="/"
          // One line at every width: the text steps down below 400px and the
          // icon drops below 360px, so the bar is one height everywhere.
          className="group flex min-h-[44px] items-center gap-2 whitespace-nowrap px-2 py-1 font-heading text-xl font-bold transition-colors hover:bg-primary min-[400px]:text-2xl"
          spinnerClassName="text-(--primary) group-hover:text-black"
        >
          <FileTextIcon
            aria-hidden="true"
            className="hidden size-6 text-(--primary) transition-colors group-hover:text-black min-[360px]:block"
          />
          <span>
            {/* text-(--primary), not text-primary: the header is black in both themes,
                so the logo keeps the bright lime everywhere. text-primary now resolves
                to the darkened light-mode reading colour, which made the green change
                between themes on a surface that never changes. */}
            <span className="text-(--primary) transition-colors group-hover:text-black">PERM</span>{" "}
            <span className="text-white transition-colors group-hover:text-black"> Tracker</span>
          </span>
        </NavLink>{" "}

        {/* Desktop navigation from xl (1280px): it needs 1,137px on one line,
            so narrower screens get the menu button instead. */}
        <nav className="hidden items-center gap-4 xl:flex">
          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {PUBLIC_NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <React.Fragment key={link.href}>
                  <NavLink
                    href={link.href}
                    className={cn(
                      "relative px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                      // text-(--primary), not text-primary: the header is black in
                      // both themes, and text-primary resolves to the darkened
                      // light-mode reading colour there.
                      isActive
                        ? "text-(--primary)"
                        : "text-white hover:text-(--primary)"
                    )}
                    spinnerClassName="text-white"
                    spinnerSize={14}
                  >
                    {link.label}
                    <span
                      className={cn(
                        "absolute bottom-0 left-3 right-3 h-[2px] bg-primary transition-transform duration-200 origin-left",
                        isActive ? "scale-x-100" : "scale-x-0"
                      )}
                    />
                  </NavLink>{" "}
                </React.Fragment>
              );
            })}{" "}

            {/* Learn dropdown — links are ALWAYS rendered in the DOM (not
                behind a `{isLearnOpen &&}` conditional) so Googlebot sees
                them in the initial SSR HTML, a documented sitelinks input.
                The `"use client"` directive at the top of this file does
                NOT prevent SSR, Next.js still renders client components
                to HTML on the initial server response, which is what
                Googlebot's first fetch sees before any JS runs.

                Visibility is controlled when closed via:
                  - `inert` removes the subtree from focus order AND the
                    accessibility tree in modern browsers (per the
                    WHATWG inert spec).
                  - `aria-hidden` is defense-in-depth for browsers that
                    pre-date `inert` (Safari <15.5, Firefox <112, Chromium
                    <102); modern browsers excise inert subtrees from the
                    a11y tree automatically without needing this attribute.
                  - `invisible pointer-events-none opacity-0` for visual.

                DO NOT revert to conditional render, that breaks SEO. */}
            <div ref={learnRef} className="relative">
              <button
                type="button"
                onClick={() => setIsLearnOpen(!isLearnOpen)}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                  learnActive
                    ? "text-(--primary)"
                    : "text-white hover:text-(--primary)"
                )}
                aria-expanded={isLearnOpen}
                aria-haspopup="menu"
              >
                Learn
                <CaretDownIcon className={cn("h-3.5 w-3.5 transition-transform duration-200", isLearnOpen && "rotate-180")} />
              </button>{" "}
              <div
                role="menu"
                aria-hidden={!isLearnOpen}
                inert={!isLearnOpen}
                className={cn(
                  "absolute left-0 top-full z-50 mt-1 w-44 border-2 border-white/20 bg-black py-1 shadow-[4px_4px_0_rgba(255,255,255,0.2)] transition-opacity duration-150",
                  !isLearnOpen && "invisible pointer-events-none opacity-0"
                )}
              >
                {LEARN_NAV_LINKS.map((link) => (
                  <React.Fragment key={link.href}>
                    <NavLink
                      href={link.href}
                      className={cn(
                        "block px-4 py-2 font-heading text-sm font-semibold transition-colors",
                        pathname === link.href
                          ? "bg-primary/10 text-(--primary)"
                          : "text-white hover:bg-white/5 hover:text-(--primary)"
                      )}
                      spinnerClassName="text-white"
                      spinnerSize={14}
                      onClick={() => setIsLearnOpen(false)}
                    >
                      {link.label}
                    </NavLink>{" "}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>{" "}

          {/* Search + Auth Buttons */}
          <div className="flex items-center gap-3">
            <SiteSearch articles={articles} />{" "}
            {showSignIn && (
              <NavLink
                href="/login"
                className="inline-flex min-h-[44px] items-center justify-center border-2 px-4 font-heading text-sm font-bold shadow-[2px_2px_0px_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none border-white bg-transparent text-white"
                spinnerClassName="text-white"
                spinnerSize={14}
              >
                Sign in
              </NavLink>
            )}{" "}

            {showSignUp && (
              <NavLink
                href="/signup"
                className="inline-flex min-h-[44px] items-center justify-center border-2 px-4 font-heading text-sm font-bold shadow-[2px_2px_0px_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none border-primary bg-primary text-black"
                spinnerClassName="text-black"
                spinnerSize={14}
              >
                Sign up
              </NavLink>
            )}{" "}

            <ThemeToggle />
          </div>
        </nav>{" "}

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3 xl:hidden">
          <SiteSearch articles={articles} />{" "}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            // 44px, not 40: the hamburger is the only way into the menu on a phone.
            className="flex h-11 w-11 items-center justify-center border-2 border-white/20 text-white transition-colors hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>{" "}

      {/* Mobile Menu */}
      {/* Mobile menu — conditional render is intentionally OK here, unlike the
          desktop Learn dropdown above. Reason: the desktop nav already SSR-
          renders every link visibly to Googlebot in the same HTML response,
          so the SEO sitelinks contract is satisfied at the page level. Mobile
          is purely a viewport-specific UX surface. */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b-3 border-white/20 bg-black px-4 py-4 xl:hidden">
          <nav className="flex flex-col gap-3">
            {PUBLIC_NAV_LINKS.map((link) => (
              <React.Fragment key={link.href}>
                <NavLink
                  href={link.href}
                  className={cn(
                    "block py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                    pathname === link.href
                      ? "text-(--primary)"
                      : "text-white hover:text-(--primary)"
                  )}
                  spinnerClassName="text-white"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </NavLink>{" "}
              </React.Fragment>
            ))}{" "}

            {/* Learn section */}
            <div className="border-t border-white/10 pt-2 mt-1">
              <p className="py-1 font-heading text-sm font-bold uppercase tracking-widest text-white/70">
                Learn
              </p>{" "}
              {LEARN_NAV_LINKS.map((link) => (
                <React.Fragment key={link.href}>
                  <NavLink
                    href={link.href}
                    className={cn(
                      "block py-2 pl-2 font-heading text-sm font-semibold transition-colors",
                      pathname === link.href
                        ? "text-(--primary)"
                        : "text-white hover:text-(--primary)"
                    )}
                    spinnerClassName="text-white"
                    spinnerSize={14}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>{" "}
                </React.Fragment>
              ))}
            </div>{" "}
            <div className="flex flex-col gap-3 border-t border-white/20 pt-3">
              {showSignIn && (
                <NavLink
                  href="/login"
                  className="flex min-h-[48px] items-center justify-center border-2 px-4 text-center font-heading text-base font-bold shadow-[2px_2px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none border-white bg-transparent text-white"
                  spinnerClassName="text-white"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign in
                </NavLink>
              )}{" "}
              {showSignUp && (
                <NavLink
                  href="/signup"
                  className="flex min-h-[48px] items-center justify-center border-2 px-4 text-center font-heading text-base font-bold shadow-[2px_2px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none border-primary bg-primary text-black"
                  spinnerClassName="text-black"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign up
                </NavLink>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
