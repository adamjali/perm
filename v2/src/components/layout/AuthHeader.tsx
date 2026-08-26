"use client";

/**
 * AuthHeader Component
 * Header for public/authentication pages.
 *
 * Features:
 * - Logo linking to home (/)
 * - Context-aware navigation:
 *   - Home page: Scroll-spy section navigation (#journey, #features, etc.)
 *   - Other pages: Home and Demo links
 * - Context-aware auth buttons with loading states:
 *   - Hides Sign In on /login page
 *   - Hides Sign Up on /signup page
 *   - Shows both on other pages
 * - Sign Up button has neobrutalist primary outline style
 * - Theme toggle button
 * - Scroll effect: adds shadow when page is scrolled
 *
 */

import * as React from "react";

// useLayoutEffect warns when React renders this on the server. Same idiom the
// SecurityIncidentBanner already uses.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
import { usePathname } from "next/navigation";
import {
  AUTH_NAV_LINKS,
  HOME_SECTION_LINKS,
  CONTENT_NAV_LINKS,
  TOOLS_NAV_LINK,
} from "@/lib/constants/navigation";
import ThemeToggle from "./ThemeToggle";
import { NavLink } from "@/components/ui/nav-link";
import { CaretDown, FileText, List as Menu, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export default function AuthHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  // Armed only AFTER the first paint. See the scroll effect below.
  const [motionArmed, setMotionArmed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isLearnOpen, setIsLearnOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<string>("hero");
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

  const showSignIn = pathname !== "/login";
  const showSignUp = pathname !== "/signup";
  const isHomePage = pathname === "/";

  // Track scroll position for header padding.
  //
  // A LAYOUT effect, not a passive one, and this is the whole point. This
  // component is mounted by three different layouts, so every navigation
  // between the public group and the auth group UNMOUNTS and REMOUNTS it with
  // `isScrolled` back at false. A passive effect corrects that after the
  // browser has already painted, so a visitor arriving from a scrolled page
  // saw the tall bar for one frame and then watched it animate 12px shorter.
  // That twitch is a real part of "the header flashes a different one".
  //
  // useLayoutEffect runs synchronously before paint, so the first frame is
  // already correct. `motionArmed` then flips in a passive effect (which runs
  // AFTER that paint) so the corrected value never animates into place on
  // arrival, while ordinary scrolling still transitions.
  useIsoLayoutEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    setMotionArmed(true);
  }, []);

  // IntersectionObserver for scroll-spy (more accurate than scroll position)
  React.useEffect(() => {
    if (!isHomePage) return;

    const sectionIds = HOME_SECTION_LINKS.map(link => link.href.replace("#", ""));
    const sections = sectionIds
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    // Track which sections are visible and their intersection ratios
    const visibleSections = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visibleSections.set(id, entry.intersectionRatio);
          } else {
            visibleSections.delete(id);
          }
        });

        // Find the most visible section (highest in document among visible)
        if (visibleSections.size > 0) {
          // Get the first visible section in document order
          for (const id of sectionIds) {
            if (visibleSections.has(id)) {
              setActiveSection(id);
              break;
            }
          }
        }
      },
      {
        // rootMargin: negative top margin to trigger when section is near top of viewport
        // This accounts for the fixed header height
        rootMargin: "-80px 0px -50% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      }
    );

    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, [isHomePage]);

  // Smooth scroll to section
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const sectionId = href.replace("#", "");
    const section = document.getElementById(sectionId);
    if (section) {
      const headerOffset = 80;
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      setActiveSection(sectionId);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header
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
          className="group flex min-h-[44px] items-center gap-2 px-2 py-1 font-heading text-2xl font-bold transition-colors hover:bg-primary"
          spinnerClassName="text-(--primary) group-hover:text-black"
        >
          <FileText
            className="size-6 text-(--primary) transition-colors group-hover:text-black"
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

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 sm:flex">
          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {isHomePage ? (
              <>
                {HOME_SECTION_LINKS.map((link) => {
                  const sectionId = link.href.replace("#", "");
                  const isActive = activeSection === sectionId;
                  return (
                    <React.Fragment key={link.href}>
                      <a
                      href={link.href}
                      onClick={(e) => scrollToSection(e, link.href)}
                      className={cn(
                        "relative px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                        isActive ? "text-primary" : "text-white hover:text-primary"
                      )}
                    >
                      {link.label}
                      <span
                        className={cn(
                          "absolute bottom-0 left-3 right-3 h-[2px] bg-primary transition-transform duration-200 origin-left",
                          isActive ? "scale-x-100" : "scale-x-0 hover:scale-x-100"
                        )}
                      />
                      </a>{" "}
                    </React.Fragment>
                  );
                  })}{" "}

                {/* Tools hub. The homepage branch renders section anchors
                    instead of AUTH_NAV_LINKS, so this link has to be placed
                    here explicitly or the suite is unreachable from the
                    homepage nav. */}
                <NavLink
                  href={TOOLS_NAV_LINK.href}
                  className="relative px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                  spinnerClassName="text-white"
                  spinnerSize={14}
                >
                  {TOOLS_NAV_LINK.label}
                </NavLink>{" "}

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
                    className="flex items-center gap-1 px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                    aria-expanded={isLearnOpen}
                    aria-haspopup="menu"
                  >
                    Learn
                    <CaretDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isLearnOpen && "rotate-180")} />
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
                    {CONTENT_NAV_LINKS.map((link) => (
                      <React.Fragment key={link.href}>
                        <NavLink
                        href={link.href}
                        className="block px-4 py-2 font-heading text-sm font-semibold text-white transition-colors hover:bg-white/5 hover:text-primary"
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
              </>
            ) : (
              <>
                {AUTH_NAV_LINKS.filter((link) => link.href !== pathname).map((link) => (
                  <React.Fragment key={link.href}>
                    <NavLink
                    href={link.href}
                    className="px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                    spinnerClassName="text-white"
                    spinnerSize={14}
                    >
                    {link.label}
                    </NavLink>{" "}
                  </React.Fragment>
                ))}{" "}

                {/* Learn dropdown — see homepage branch above for the SSR-render
                    rationale and a11y contract. Same pattern, active-link styling. */}
                <div ref={learnRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsLearnOpen(!isLearnOpen)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                      CONTENT_NAV_LINKS.some(l => l.href === pathname) ? "text-primary" : "text-white hover:text-primary"
                    )}
                    aria-expanded={isLearnOpen}
                    aria-haspopup="menu"
                  >
                    Learn
                    <CaretDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isLearnOpen && "rotate-180")} />
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
                    {CONTENT_NAV_LINKS.map((link) => (
                      <React.Fragment key={link.href}>
                        <NavLink
                        href={link.href}
                        className={cn(
                        "block px-4 py-2 font-heading text-sm font-semibold transition-colors",
                        pathname === link.href ? "bg-primary/10 text-primary" : "text-white hover:bg-white/5 hover:text-primary"
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
              </>
            )}
          </div>{" "}

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {showSignIn && (
              <NavLink
                href="/login"
                className="border-2 border-white bg-transparent px-4 py-2 font-heading text-sm font-semibold text-white shadow-[2px_2px_0px_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                spinnerClassName="text-white"
                spinnerSize={14}
              >
                Sign In
              </NavLink>
            )}{" "}

            {showSignUp && (
              <NavLink
                href="/signup"
                className="border-2 border-black bg-primary px-4 py-2 font-heading text-sm font-semibold text-black shadow-[2px_2px_0px_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                spinnerClassName="text-black"
                spinnerSize={14}
              >
                Sign Up
              </NavLink>
            )}{" "}

            <ThemeToggle />
          </div>
        </nav>{" "}

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            // 44px, not 40: the hamburger is the only way into the menu on a phone.
            className="flex h-11 w-11 items-center justify-center border-2 border-white/20 text-white transition-colors hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>{" "}

      {/* Mobile Menu */}
      {/* Mobile menu — conditional render is intentionally OK here, unlike the
          desktop Learn dropdown above. Reason: the desktop nav already SSR-
          renders all five CONTENT_NAV_LINKS visibly to Googlebot in the same
          HTML response, so the SEO sitelinks contract is satisfied at the page
          level. Mobile is purely a viewport-specific UX surface, no Googlebot-
          facing implication of mounting it lazily. */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b-3 border-white/20 bg-black px-4 py-4 sm:hidden">
          <nav className="flex flex-col gap-3">
            {isHomePage ? (
              <>
                {HOME_SECTION_LINKS.map((link) => {
                  const sectionId = link.href.replace("#", "");
                  const isActive = activeSection === sectionId;
                  return (
                    <React.Fragment key={link.href}>
                      <a
                      href={link.href}
                      onClick={(e) => scrollToSection(e, link.href)}
                      className={cn(
                        "block py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                        isActive ? "text-primary" : "text-white hover:text-primary"
                      )}
                    >
                      {link.label}
                      </a>{" "}
                    </React.Fragment>
                  );
                  })}{" "}

                {/* Tools hub, same reasoning as the desktop branch. */}
                <NavLink
                  href={TOOLS_NAV_LINK.href}
                  className="block py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                  spinnerClassName="text-white"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {TOOLS_NAV_LINK.label}
                </NavLink>{" "}

                {/* Learn section */}
                <div className="border-t border-white/10 pt-2 mt-1">
                  <p className="py-1 font-heading text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Learn
                  </p>{" "}
                  {CONTENT_NAV_LINKS.map((link) => (
                    <React.Fragment key={link.href}>
                      <NavLink
                      href={link.href}
                      className="block py-2 pl-2 font-heading text-sm font-semibold text-white transition-colors hover:text-primary"
                      spinnerClassName="text-white"
                      spinnerSize={14}
                      onClick={() => setIsMobileMenuOpen(false)}
                      >
                      {link.label}
                      </NavLink>{" "}
                    </React.Fragment>
                  ))}
                </div>
              </>
            ) : (
              <>
                {AUTH_NAV_LINKS.filter((link) => link.href !== pathname).map((link) => (
                  <React.Fragment key={link.href}>
                    <NavLink
                    href={link.href}
                    className="block py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
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
                  <p className="py-1 font-heading text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Learn
                  </p>{" "}
                  {CONTENT_NAV_LINKS.map((link) => (
                    <React.Fragment key={link.href}>
                      <NavLink
                      href={link.href}
                      className={cn(
                      "block py-2 pl-2 font-heading text-sm font-semibold transition-colors",
                      pathname === link.href ? "text-primary" : "text-white hover:text-primary"
                      )}
                      spinnerClassName="text-white"
                      spinnerSize={14}
                      onClick={() => setIsMobileMenuOpen(false)}
                      >
                      {link.label}
                      </NavLink>{" "}
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}{" "}
            <div className="flex flex-col gap-3 border-t border-white/20 pt-3">
              {showSignIn && (
                <NavLink
                  href="/login"
                  className="block border-2 border-white bg-transparent px-4 py-2 text-center font-heading text-sm font-semibold text-white shadow-[2px_2px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  spinnerClassName="text-white"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </NavLink>
              )}{" "}
              {showSignUp && (
                <NavLink
                  href="/signup"
                  className="block border-2 border-black bg-primary px-4 py-2 text-center font-heading text-sm font-semibold text-black shadow-[2px_2px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  spinnerClassName="text-black"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign Up
                </NavLink>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
