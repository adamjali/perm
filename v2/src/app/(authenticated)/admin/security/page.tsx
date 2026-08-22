/**
 * Admin security dashboard, top-level route.
 *
 * Gated by the same admin middleware as /admin (see src/lib/admin/adminAuth).
 */

import type { Metadata } from "next";
import SecurityDashboardClient from "./SecurityDashboardClient";

export const metadata: Metadata = {
  title: "Security · Admin",
  robots: { index: false, follow: false },
};

export default function AdminSecurityPage() {
  return <SecurityDashboardClient />;
}
