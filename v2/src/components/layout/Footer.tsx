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

interface FooterProps {
  variant?: "compact" | "extended";
}

export default function Footer({ variant = "compact" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === "extended") {
    return (
      <footer className="relative z-50 border-t-4 border-black bg-black dark:border-white dark:bg-black">
        <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8">
          {/* Multi-column grid */}
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
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
                  href="https://github.com/adamjali/perm"
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
              <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                Product
              </h4>
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
              </nav>
            </div>

            {/* Resources column */}
            <div>
              <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                Resources
              </h4>
              <nav className="flex flex-col gap-3" aria-label="Resource links">
                <a
                  href="https://flag.dol.gov/programs/perm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                >
                  DOL PERM Info
                </a>
                <a
                  href="https://www.ecfr.gov/current/title-20/chapter-V/part-656"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                >
                  20 CFR 656
                </a>
                <a
                  href="https://github.com/adamjali/perm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                >
                  GitHub
                </a>
              </nav>
            </div>

            {/* Legal column */}
            <div>
              <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                Legal
              </h4>
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
                <a
                  href="/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-underline text-sm text-white/60 transition-colors hover:text-primary"
                >
                  Contact
                </a>
              </nav>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <div className="mono text-xs text-white/40">
              &copy; {currentYear} PERM Tracker. All rights reserved.
            </div>
            <div className="flex items-center gap-1 text-xs text-white/40">
              Made with <Heart className="h-3 w-3 text-primary" /> for immigration attorneys
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Compact variant (default - for authenticated pages)
  return (
    <footer className="relative z-50 border-t-4 border-black bg-black dark:border-white dark:bg-black">
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
          <a
            href="/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="hover-underline text-white transition-colors hover:text-primary"
          >
            Contact
          </a>
        </div>

        {/* Copyright */}
        <div className="mono text-xs text-white/60">
          &copy; {currentYear} PERM Tracker
        </div>
      </div>
    </footer>
  );
}
