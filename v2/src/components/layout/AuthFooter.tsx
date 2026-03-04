"use client";

/**
 * AuthFooter Component
 * Footer for public/authentication pages.
 *
 * Features:
 * - Privacy Policy, Terms of Service, Contact links
 * - Copyright with current year
 * - Neobrutalist top border (border-t-4, border-black)
 * - Black background with white text
 * - Loading states for internal navigation links
 *
 * Phase: 20-02 (Dashboard Data Layer)
 * Updated: 2026-01-02
 */

import { NavLink } from "@/components/ui/nav-link";

export default function AuthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-50 border-t-4 border-black bg-black dark:border-white dark:bg-black">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-8">
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
          © {currentYear} PERM Tracker
        </div>
      </div>
    </footer>
  );
}
