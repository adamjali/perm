"use client";

// KEEP "use client" HERE. Making this a server component was tried on
// 2026-09-01, got all the way to a green build, was MEASURED, and made every
// page BIGGER. Do not try it again without reading this.
//
// THE MODEL THAT MOTIVATED IT WAS BACKWARDS, and that is the useful part.
// The reasoning was: half of a cached page is the RSC flight payload (measured,
// 163 KB of 330 KB on an entity page), so a component with no interactivity
// should not be a client component, because then it is "stored twice" - once as
// HTML, once in the payload. Convert it and the page shrinks.
//
// That is not how the payload works. A CLIENT component appears in it as a
// compact client REFERENCE: a module id plus its props. A SERVER component's
// full rendered element tree is serialized into it. So converting a
// markup-heavy component from client to server REPLACES a small reference with
// a large serialized tree, and the page grows.
//
// Measured, same build, four routes, local vs production:
//
//     /tools            181,750 -> 191,266 B   +9,516
//     /perm-queue       295,935 -> 305,451 B   +9,516
//     /perm-wages/...   338,201 -> 347,581 B   +9,380
//     /                 327,680 -> 335,246 B   +7,566
//
// The identical +9,516 on two unrelated routes is Footer's constant per-page
// cost. That is +1 ISR write unit on EVERY page, the opposite of the intent.
//
// SO THE PAYLOAD IS NOT REDUCED BY MOVING BOUNDARIES. It is reduced by
// rendering less, or by rendering it somewhere that is not serialized at all.
// Anyone optimising ISR write volume here should start from that.
//
// TWO THINGS FOUND ALONG THE WAY THAT WERE KEPT, both real:
//   1. `@phosphor-icons/react`'s MAIN entry calls `createContext` at module
//      scope for its IconContext, so it needs React's client build. Importing
//      it from a server component is what produced
//      `TypeError: (0 , d.createContext) is not a function` - an error naming
//      webpack bootstrap and no source file, found only by reading the module
//      ids in the emitted chunk (`.next/server/chunks/*.js`). The `/ssr` entry
//      exists for this and ~60 files here already use it. Footer is a client
//      component again so its main-entry import is fine. NOTE: three other
//      server files were briefly recorded as dormant traps here; that was a
//      FALSE POSITIVE - their main-entry imports are `import type`, which is
//      erased at compile. Measured 2026-09-02: zero server-side VALUE imports
//      of the main entry exist in src/.
//   2. 25 modules used client-only APIs with no boundary of their own, working
//      purely by inheriting somebody else's. Those are declared now.

/**
 * Footer Component
 * One multi-column footer, shared by the public site and the signed-in app.
 *
 * Features:
 * - Black background matching header
 * - Multi-column layout with logo, nav links, social, copyright
 * - Hover underline animation on links
 * - Dark mode compatible (black bg works in both modes)
 * - Loading states for internal navigation links
 *
 * There used to be a second "compact" bar documented as the authenticated
 * footer. Neither call site ever asked for it, so the signed-in app got the
 * public footer, Sign In and Sign Up Free included, offered to people who
 * were already signed in. `audience` is what fixes that; the compact branch
 * is gone rather than left as an unreachable second layout.
 */

import { HeartIcon } from "@phosphor-icons/react";

import { NavLink } from "@/components/ui/nav-link";
import { LawGavelSVG } from "@/components/illustrations";
import { Fragment } from "react";
import { SOCIAL_LINKS } from "@/lib/constants/externalLinks";
import { TOOL_NAV_LINKS } from "@/lib/constants/navigation";

// Brand icons as inline SVGs: neither lucide nor Phosphor ships brand marks
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);
const SOCIAL_ICONS = {
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
} as const;

interface FooterProps {
  /**
   * Kept because both call sites pass it and only one layout remains.
   * Collapse it once the public layout can be edited alongside this file.
   */
  variant?: "extended";

  /**
   * Who is reading the footer. The signed-in app drops the two links that
   * only make sense to a logged-out visitor.
   */
  audience?: "public" | "app";
}

export default function Footer({ audience = "public" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    // `z-10`, NOT `z-50`. The footer only has to clear the ambient canvas
    // (`AmbientMurmuration`, `fixed inset-0 z-0`) and the dot ground; it has
    // no business outranking the header.
    //
    // At `z-50` it TIED with the header, which is `fixed z-50`, and the
    // footer is the last child of `(site)/layout.tsx`, so DOM order decided
    // it and the footer won. Measured on production: with the Learn menu
    // open over the footer, `elementFromPoint` at a point 40px inside the
    // overlap returned the footer, not the menu link. The menu was not
    // clipped - it rendered all six items at full height - it was covered,
    // and its clicks went to the footer behind it.
    //
    // The same tie beat the back-to-top button (fixed 2026-09-09) and the
    // mobile data drawer at `z-40`, which an open drawer scrolled to the
    // bottom of a page could not paint over. Raising each of those past the
    // footer one at a time treats the symptom; the footer is what is wrong.
    // Gated by `footer-stacking.test.ts`.
    <footer className="relative z-10 border-t-3 border-black bg-black dark:border-white dark:bg-black">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        {/* Multi-column grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <div className="font-heading text-xl font-bold text-white mb-4">
              <span className="text-(--primary)">PERM</span> Tracker
            </div>{" "}
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              Live DOL data for the wait, automatic deadlines for the work. Free for applicants and attorneys.
            </p>
            {/* Social links. Driven by SOCIAL_LINKS so a network that has no
                real profile yet is simply absent, rather than linking its
                bare homepage as these previously did. */}
            <div className="flex gap-4">
              {SOCIAL_LINKS.map(({ href, label, icon }) => {
                const Icon = SOCIAL_ICONS[icon];
                // Both marks are monochrome here, LinkedIn included. Its
                // official #0A66C2 was the honest brand colour and it was
                // still wrong in place: it made the LinkedIn tile the only
                // coloured thing in an otherwise black-and-white footer, on
                // every page, so the eye landed on it before anything the
                // footer is actually for. Two marks at one weight read as a
                // set; one in brand colour reads as a sticker. It also carried
                // brightness-125/150, and a brightness filter used to lift a
                // colour is the glow this project does not ship.
                const brand = "text-white/70 hover:text-white";
                return (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={"flex min-h-[44px] min-w-[44px] items-center justify-center transition-all " + brand}
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>{" "}

          {/* A whitespace text node between grid items. The column above ends in
              link text and the next begins with a heading, so textContent runs them
              together ("...attorneys.Product", "Sign InLearn", "Processing
              TimesCalculators") for anything that walks the DOM. Whitespace-only
              nodes are not laid out as grid items, so this costs nothing visually.
              Measured: these are the only three glued boundaries in the footer;
              the Legal column does not glue and is left alone. */}
          {/* Product column */}
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
              Product
            </p>{" "}
            <nav className="footer-links flex flex-col gap-3" aria-label="Product links">
              <NavLink
                href="/perm-case-status"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Track my case
              </NavLink>{" "}
              <NavLink
                href="/case-search"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Search every case
              </NavLink>{" "}
              <NavLink
                href="/tools/perm-timeline-calculator"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Processing time calculator
              </NavLink>{" "}
              <NavLink
                href="/visa-bulletin"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Visa bulletin
              </NavLink>{" "}
              <NavLink
                href="/lca-wages"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                H-1B salaries
              </NavLink>{" "}
              <NavLink
                href="/tools"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Data
              </NavLink>{" "}
              <NavLink
                href="/for-attorneys"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                For attorneys
              </NavLink>{" "}
              <NavLink
                href="/email-preferences"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Email preferences
              </NavLink>{" "}
              <NavLink
                href="/faq"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                FAQ
              </NavLink>{" "}
              {audience === "public" && (
                <>
                  <NavLink
                    href="/signup"
                    className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                    spinnerClassName="text-(--primary)"
                  >
                    Sign Up Free
                  </NavLink>{" "}
                  <NavLink
                    href="/login"
                    className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                    spinnerClassName="text-(--primary)"
                  >
                    Sign In
                  </NavLink>
                </>
              )}
            </nav>
          </div>{" "}

          {/* Learn column */}
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
              Learn
            </p>{" "}
            <nav className="footer-links flex flex-col gap-3" aria-label="Content links">
              <NavLink
                href="/blog"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Blog
              </NavLink>{" "}
              <NavLink
                href="/guides"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Guides
              </NavLink>{" "}
              <NavLink
                href="/changelog"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Changelog
              </NavLink>{" "}
              <NavLink
                href="/perm-processing-times"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Processing Times
              </NavLink>
            </nav>
          </div>{" "}

          {/* Calculators column. The suite shipped reachable from exactly
              one inbound link, which is the orphan-page defect: a page can
              return 200, sit in the sitemap, and still be invisible because
              nothing indexable points at it. */}
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
              Calculators
            </p>{" "}
            <nav className="footer-links flex flex-col gap-3" aria-label="Calculator links">
              {TOOL_NAV_LINKS.map((link) => (
                <Fragment key={link.href}>
                  <NavLink
                    href={link.href}
                    className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                    spinnerClassName="text-(--primary)"
                  >
                    {link.label}
                  </NavLink>{" "}
                </Fragment>
              ))}
            </nav>
          </div>

          {/* Legal column */}
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
              Legal
            </p>{" "}
            <nav className="footer-links flex flex-col gap-3" aria-label="Legal links">
              <NavLink
                href="/privacy"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Privacy Policy
              </NavLink>{" "}
              <NavLink
                href="/terms"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Terms of Service
              </NavLink>{" "}
              <NavLink
                href="/security"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Security
              </NavLink>{" "}
              <NavLink
                href="/about"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                About
              </NavLink>{" "}
              <NavLink
                href="/contact"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Contact
              </NavLink>
            </nav>
          </div>
        </div>

        {/* Bottom bar with illustration */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="opacity-30" aria-hidden="true">
              <LawGavelSVG size={28} className="text-white" />
            </div>{" "}
            <div className="mono text-xs text-white/70">
              &copy; {currentYear} PERM Tracker. All rights reserved.
            </div>
          </div>{" "}
          <div className="flex items-center gap-1 text-xs text-white/70">
            Made with <HeartIcon className="h-3 w-3 text-(--primary)" /> for everyone in the PERM line
          </div>
        </div>
      </div>
    </footer>
  );
}
