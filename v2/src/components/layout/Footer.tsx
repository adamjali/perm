"use client";

// THIS DIRECTIVE IS LOAD-BEARING AND SHOULD NOT BE. Attempted and reverted
// 2026-09-01, after four clean builds. Read this before trying again.
//
// THE PRIZE. Footer has no state, effects, handlers or browser APIs, and both
// parents - `(site)/layout.tsx` and `(authenticated)/layout.tsx` - are server
// components. As a client component its whole multi-column tree is serialized
// into the RSC flight payload ON TOP OF being rendered as HTML, so it is stored
// twice in every cached page on the site. Measured on an entity page that
// payload is 163 KB of 330 KB (49.4%), and Vercel bills ISR writes in 8 KB
// units, so the duplication is money on every route.
//
// WHY IT DOES NOT WORK YET. Footer is not merely duplicating itself, it is
// acting as a client BOUNDARY for a large graph underneath the authenticated
// layout. Remove the directive and webpack re-partitions the chunks, some of
// that graph lands server-side, and the build dies collecting page data with
//
//     TypeError: (0 , d.createContext) is not a function
//
// naming webpack bootstrap and no source file. `createContext` exists only in
// React's client build.
//
// WHAT WAS ALREADY FIXED (kept - correct on its own merits, and the trap is
// real whether or not Footer ever changes). Twenty-five modules were using
// client-only APIs with no boundary of their own, working purely because every
// path that reached them crossed somebody else's first:
//   - 6 found by walking the import graph from every server entry point:
//     lib/ai/page-context (createContext), LoginTracker, PendingTermsHandler,
//     ChatWidgetConnected, useToolOrchestrator, useChatWithPersistence
//   - 4 more calling createContext directly: CaseFormContext,
//     useCaseFormSection, pwa/InstallPrompt, SettingsUnsavedChangesContext
//   - 19 with VALUE imports of `convex/react`, whose hooks reach createContext
//     (a type-only importer, case-detail-types.ts, correctly needs nothing)
//
// WHY IT STILL FAILED. With all of those declared, the failure did not go away,
// it MOVED - /admin/security, then /admin, then back. Chunk membership shifts
// each time, so this is not one more missing directive; something about how the
// authenticated layout's client graph is partitioned is doing it. Declaring
// boundaries one at a time is whack-a-mole and does not converge.
//
// HOW TO ACTUALLY FINISH IT. Do not iterate on production builds at 5-6 minutes
// a cycle. Read the emitted chunk (`.next/server/chunks/*.js`) to find which
// module id is calling createContext and what pulled it in, or bisect the
// authenticated layout's imports. That is an hour of focused work and worth it:
// it is the difference between the 2% one component bought and roughly 25%.

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
const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

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
  github: GithubIcon,
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
    <footer className="relative z-50 border-t-3 border-black bg-black dark:border-white dark:bg-black">
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
                // All three marks are monochrome here, LinkedIn included.
                //
                // Its official #0A66C2 was the honest brand colour and it was
                // still wrong in place: it made the LinkedIn tile the only
                // coloured thing in an otherwise black-and-white footer, on
                // every page, so the eye landed on it before anything the
                // footer is actually for. Three marks at one weight read as a
                // set; one in brand colour reads as a sticker. It also
                // carried brightness-125/150, and a brightness filter used
                // to lift a colour is the glow this project does not ship.
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
          </div>

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
                href="/tools/perm-timeline-calculator"
                className="hover-underline text-sm text-white/60 transition-colors hover:text-(--primary)"
                spinnerClassName="text-(--primary)"
              >
                Processing time calculator
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
          </div>

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
          </div>

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
