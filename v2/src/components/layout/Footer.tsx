"use client";

import Link from "next/link";
import { LOCALES } from "@/lib/i18n/locales";

// KEEP "use client" HERE. As a server component this footer makes every page
// BIGGER, measured at about 9.5 KB a page.
//
// A CLIENT component appears in the RSC payload as a compact client
// REFERENCE: a module id plus its props. A SERVER component's full rendered
// element tree is serialized into it. So converting a markup-heavy component
// from client to server REPLACES a small reference with a large serialized
// tree, and the page grows. The payload is reduced by rendering less, not by
// moving boundaries.
//
// Its `@phosphor-icons/react` import is the MAIN entry, which calls
// `createContext` at module scope for its IconContext and so needs React's
// client build. A server component must import from `@phosphor-icons/react/ssr`
// instead, or the build fails with `TypeError: (0 , d.createContext) is not a
// function`, naming webpack bootstrap rather than any source file (the module
// ids in `.next/server/chunks/*.js` point at the importer). A type-only import
// of the main entry is erased at compile and is safe anywhere.

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
 * `audience` drops Sign in and Sign up for the signed-in app, where they
 * would be offered to people who are already signed in.
 */

import { CaretDownIcon, HeartIcon } from "@phosphor-icons/react";

import { NavLink } from "@/components/ui/nav-link";
import { LawGavelSVG } from "@/components/illustrations";
import { Fragment } from "react";
import { SOCIAL_LINKS } from "@/lib/constants/externalLinks";
import { FOOTER_COLUMNS } from "@/lib/constants/navigation";
import { NOT_LEGAL_SERVICES } from "@/lib/constants/about";

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

  // The signed-in app drops Sign Up and Sign In; that is the whole reason
  // `audience` exists.
  const columns = FOOTER_COLUMNS.map((col) => ({
    ...col,
    links: audience === "public" && col.publicOnly ? [...col.links, ...col.publicOnly] : col.links,
  }));

  return (
    // `z-10`, NOT `z-50`. The footer only has to clear the ambient canvas
    // (`AmbientMurmuration`, `fixed inset-0 z-0`) and the dot ground; it has
    // no business outranking the header.
    //
    // At `z-50` it would TIE with the header, which is `fixed z-50`, and the
    // footer is the last child of `(site)/layout.tsx`, so DOM order decides
    // it and the footer wins: the Learn menu, open over the footer, is not
    // clipped but covered, and its clicks go to the footer behind it
    // (`elementFromPoint` inside the overlap returns the footer).
    //
    // The same tie would beat the back-to-top button and the mobile data
    // drawer. Raising each of those past the footer one at a time treats the
    // symptom; the footer is what is wrong. Gated by
    // `footer-stacking.test.ts`.
    <footer className="relative z-10 border-t-3 border-black bg-black dark:border-white dark:bg-black">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        {/* Multi-column grid */}
        {/* SIX cells, not five: the brand block plus five link columns. At
            `xl:grid-cols-5` the sixth wrapped to a second row, so the footer
            stayed 754px tall on a 1440px screen even after the calculators
            column dropped from sixteen links to seven - the tallest column set
            a row height and then there were two rows of it. Measured. The
            gap tightens too; 40px between columns was most of the rest. */}
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 sm:gap-y-6 lg:grid-cols-3 lg:gap-y-10 xl:grid-cols-6">
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

          {/* Every column is a `<details>`: an accordion on a phone, a plain
              column at `lg`. Before this the footer measured 760px on desktop
              and 1,882px on a phone.

              The links stay in the HTML when a column is shut, because the
              content of a closed `<details>` is parsed and indexed - it is
              hidden, not absent - so nothing here costs a crawler anything.
              The desktop expansion is CSS only (`.footer-col` in globals.css),
              so there is no JS, no hydration flash and no second copy of the
              markup for a second breakpoint. */}
          {columns.map((col) => (
            <details key={col.title} className="footer-col group border-b border-white/10 pb-3 last:border-0 lg:border-0 lg:pb-0">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-2 lg:min-h-0 lg:pointer-events-none lg:py-0">
                <span className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                  {col.title}
                </span>{" "}
                <CaretDownIcon
                  className="h-4 w-4 shrink-0 text-white/60 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none lg:hidden"
                  aria-hidden="true"
                />
              </summary>
              <nav className="footer-col-body footer-links mt-3 flex flex-col gap-3 lg:mt-4" aria-label={col.ariaLabel}>
                {col.links.map((link) => (
                  <Fragment key={link.href}>
                    <NavLink
                      href={link.href}
                      // 44px rows on touch, the craft floor, and only inside
                      // an accordion that starts shut - so the tap target is
                      // real where a finger is used and costs no height where
                      // the column is collapsed. At `lg` they go back to a
                      // dense text list, which is what a pointer wants.
                      className="hover-underline flex min-h-11 items-center text-sm text-white/60 transition-colors hover:text-(--primary) lg:block lg:min-h-0"
                      spinnerClassName="text-(--primary)"
                    >
                      {link.label}
                    </NavLink>{" "}
                  </Fragment>
                ))}
                {col.more ? (
                  <NavLink
                    href={col.more.href}
                    className="hover-underline flex min-h-11 items-center text-sm font-bold text-white/80 transition-colors hover:text-(--primary) lg:block lg:min-h-0"
                    spinnerClassName="text-(--primary)"
                  >
                    {col.more.label}
                  </NavLink>
                ) : null}
              </nav>
            </details>
          ))}
        </div>

        {/* The guide for the person waiting, in five languages. The only site-
            wide link to those pages; each name is in its own language, marked
            with `lang` and `hrefLang` so a screen reader and a crawler both
            know what they are. */}
        <nav aria-label="Other languages" className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
          <span className="font-bold text-white">The guide in:</span>{" "}
          {LOCALES.map((l) => (
            <Fragment key={l.code}>
              {" "}
              <a
                href={l.path}
                lang={l.tag}
                hrefLang={l.tag}
                className="flex min-h-11 items-center underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white lg:min-h-0"
              >
                {l.endonym}
              </a>
            </Fragment>
          ))}
        </nav>

        {/* Bottom bar with illustration */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="opacity-30" aria-hidden="true">
              <LawGavelSVG size={28} className="text-white" />
            </div>{" "}
            <div className="mono text-sm text-white/70">
              {/* The brand name links home from every page: Google ties a
                  phrase to a page partly by what links to it with those
                  words, and the header logo alone is a thin signal. */}
              &copy; {currentYear}{" "}
              <Link href="/" className="underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white">
                PERM Tracker
              </Link>
              . All rights reserved.
            </div>
          </div>{" "}
          <div className="flex items-center gap-1 text-sm text-white/70">
            Made with <HeartIcon className="h-3 w-3 text-(--primary)" /> for everyone in the PERM line
          </div>
        </div>{" "}
        {/* Every page, every audience: see NOT_LEGAL_SERVICES for why. */}
        <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-white/70">
          {NOT_LEGAL_SERVICES}
        </p>
      </div>
    </footer>
  );
}
