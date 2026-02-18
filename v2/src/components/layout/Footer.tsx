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

import { Github, Twitter, Linkedin, Heart } from "lucide-react";
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
                  <Github className="h-5 w-5" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 transition-colors hover:text-primary"
                  aria-label="Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 transition-colors hover:text-primary"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
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
                  href="/#faq"
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
