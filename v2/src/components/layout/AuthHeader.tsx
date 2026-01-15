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
import { usePathname } from "next/navigation";
import { AUTH_NAV_LINKS, HOME_SECTION_LINKS } from "@/lib/constants/navigation";
import ThemeToggle from "./ThemeToggle";
import { NavLink } from "@/components/ui/nav-link";
import { FileText, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuthHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<string>("hero");

  const showSignIn = pathname !== "/login";
  const showSignUp = pathname !== "/signup";
  const isHomePage = pathname === "/";

  // Track scroll position for header shadow effect
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
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
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b-3 border-white/20 bg-black transition-[padding] duration-200",
        isScrolled ? "py-2" : "py-4"
      )}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 sm:px-8">
        {/* Logo */}
        <NavLink
          href="/"
          className="group flex items-center gap-2 px-2 py-1 font-heading text-2xl font-bold transition-colors hover:bg-primary"
          spinnerClassName="text-primary group-hover:text-black"
        >
          <FileText
            className="size-6 text-primary transition-colors group-hover:text-black"
            strokeWidth={2.5}
          />
          <span>
            <span className="text-primary transition-colors group-hover:text-black">PERM</span>
            <span className="text-white transition-colors group-hover:text-black"> Tracker</span>
          </span>
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 sm:flex">
          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {isHomePage ? (
              HOME_SECTION_LINKS.map((link) => {
                const sectionId = link.href.replace("#", "");
                const isActive = activeSection === sectionId;
                return (
                  <a
                    key={link.href}
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
                  </a>
                );
              })
            ) : (
              AUTH_NAV_LINKS.filter((link) => link.href !== pathname).map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                  spinnerClassName="text-white"
                  spinnerSize={14}
                >
                  {link.label}
                </NavLink>
              ))
            )}
          </div>

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
            )}

            {showSignUp && (
              <NavLink
                href="/signup"
                className="border-2 border-black bg-primary px-4 py-2 font-heading text-sm font-semibold text-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_rgba(0,0,0,0.5)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                spinnerClassName="text-black"
                spinnerSize={14}
              >
                Sign Up
              </NavLink>
            )}

            <ThemeToggle />
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center border-2 border-white/20 text-white transition-colors hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b-3 border-white/20 bg-black px-4 py-4 sm:hidden">
          <nav className="flex flex-col gap-3">
            {isHomePage ? (
              HOME_SECTION_LINKS.map((link) => {
                const sectionId = link.href.replace("#", "");
                const isActive = activeSection === sectionId;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className={cn(
                      "block py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
                      isActive ? "text-primary" : "text-white hover:text-primary"
                    )}
                  >
                    {link.label}
                  </a>
                );
              })
            ) : (
              AUTH_NAV_LINKS.filter((link) => link.href !== pathname).map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  className="block py-2 font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                  spinnerClassName="text-white"
                  spinnerSize={14}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))
            )}
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
              )}
              {showSignUp && (
                <NavLink
                  href="/signup"
                  className="block border-2 border-black bg-primary px-4 py-2 text-center font-heading text-sm font-semibold text-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
