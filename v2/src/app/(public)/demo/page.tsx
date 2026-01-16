/**
 * Demo Page
 *
 * Interactive demo of PERM Tracker using localStorage for data persistence.
 * Allows users to explore the application without creating an account.
 *
 * Features:
 * - Demo banner indicating browser-only storage
 * - Stats grid showing case overview
 * - Mini calendar with deadline indicators
 * - Mini timeline with case progress bars
 * - Case cards grid with edit/delete actions
 * - Add/Edit case modal with cascade logic
 * - Delete confirmation dialog
 * - CTA section for conversion
 * - Reset button to restore default demo data
 *
 */

import type { Metadata } from "next";
import { DemoPageClient } from "./DemoPageClient";

export const metadata: Metadata = {
  title: "Try Demo",
  description:
    "Try PERM Tracker for free. Explore all features with sample data before signing up. No account required.",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title: "Try PERM Tracker Demo",
    description:
      "Try PERM Tracker for free. Explore deadline tracking, case validation, and all features with sample data.",
    url: "/demo",
    type: "website",
  },
};

export default function DemoPage() {
  return <DemoPageClient />;
}
