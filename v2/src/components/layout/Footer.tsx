"use client";

/**
 * Footer Component
 * Footer with compact (authenticated pages) and extended (public pages) variants.
 *
 * Features:
 * - Black background matching header
 * - Compact: Privacy, Terms, Contact links + copyright
 * - Extended: Multi-column layout with logo, nav links, social, copyright
 * - Hover underline animation on links
 * - Dark mode compatible (black bg works in both modes)
 * - Loading states for internal navigation links
 *
 */

import { Heart } from "lucide-react";

// Brand icons as inline SVGs — lucide-react v1.x removed brand icons
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
import { NavLink } from "@/components/ui/nav-link";
import { LawGavelSVG } from "@/components/illustrations";

interface FooterProps {
  variant?: "compact" | "extended";
}

export default function Footer({ variant = "compact" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === "extended") {
    return (
      <footer className="relative z-50 border-t-3 border-black bg-black dark:border-white dark:bg-black">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
          {/* Multi-column grid */}
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div className="lg:col-span-1">
              <div className="font-heading text-xl font-bold text-white mb-4">
                <span className="text-primary">PERM</span> Tracker
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Free case management for immigration attorneys. Track deadlines, manage cases, never miss a filing.
              </p>
              {/* Social links */}
              <div className="flex gap-4">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 transition-colors hover:text-primary"
                  aria-label="GitHub"
                >
                  <GithubIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 transition-colors hover:text-primary"
                  aria-label="Twitter"
                >
                  <TwitterIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 transition-colors hover:text-primary"
                  aria-label="LinkedIn"
                >
                  <LinkedinIcon className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Product column */}
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                Product
              </p>
              <nav className="flex flex-col gap-3" aria-label="Product links">
                <NavLink
                  href="/#features"
                  showLoading={false}
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Features
                </NavLink>
                <NavLink
                  href="/demo"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Demo
                </NavLink>
                <NavLink
                  href="/faq"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  FAQ
                </NavLink>
                <NavLink
                  href="/signup"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Sign Up Free
                </NavLink>
                <NavLink
                  href="/login"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Sign In
                </NavLink>
              </nav>
            </div>

            {/* Learn column */}
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                Learn
              </p>
              <nav className="flex flex-col gap-3" aria-label="Content links">
                <NavLink
                  href="/blog"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Blog
                </NavLink>
                <NavLink
                  href="/tutorials"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Tutorials
                </NavLink>
                <NavLink
                  href="/guides"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Guides
                </NavLink>
                <NavLink
                  href="/changelog"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Changelog
                </NavLink>
                <NavLink
                  href="/resources"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Resources
                </NavLink>
              </nav>
            </div>

            {/* Legal column */}
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                Legal
              </p>
              <nav className="flex flex-col gap-3" aria-label="Legal links">
                <NavLink
                  href="/privacy"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Privacy Policy
                </NavLink>
                <NavLink
                  href="/terms"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
                >
                  Terms of Service
                </NavLink>
                <NavLink
                  href="/contact"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                  spinnerClassName="text-primary"
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
              </div>
              <div className="mono text-xs text-white/70">
                &copy; {currentYear} PERM Tracker. All rights reserved.
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/70">
              Made with <Heart className="h-3 w-3 text-primary" /> for immigration attorneys
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Compact variant (default - for authenticated pages)
  return (
    <footer className="relative z-50 border-t-3 border-black bg-black dark:border-white dark:bg-black">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-8">
        {/* Footer Links */}
        <div className="flex items-center gap-6 text-sm">
          <NavLink
            href="/privacy"
            className="hover-underline text-white transition-colors hover:text-primary"
            spinnerClassName="text-primary"
          >
            Privacy
          </NavLink>
          <NavLink
            href="/terms"
            className="hover-underline text-white transition-colors hover:text-primary"
            spinnerClassName="text-primary"
          >
            Terms
          </NavLink>
          <NavLink
            href="/contact"
            className="hover-underline text-white transition-colors hover:text-primary"
            spinnerClassName="text-primary"
          >
            Contact
          </NavLink>
        </div>

        {/* Copyright */}
        <div className="mono text-xs text-white/60">
          &copy; {currentYear} PERM Tracker
        </div>
      </div>
    </footer>
  );
}
