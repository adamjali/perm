/**
 * Cases Page
 * Main case list view with filtering, sorting, and pagination.
 *
 * Features:
 * - URL state management for filters, sort, and page
 * - Client-side filtering and sorting using helpers
 * - Responsive grid layout (1/2/3 columns)
 * - Empty state for new users and filtered results
 * - Skeleton loading state
 *
 * Layout:
 * 1. Page header with case count and Add Case button
 * 2. CaseFilterBar (filters + sort controls)
 * 3. Case cards grid with staggered entrance animation
 * 4. CasePagination controls
 *
 * Phase: 21 (Case List)
 * Created: 2025-12-24
 */

import type { Metadata } from "next";
import { CasesPageClient } from "./CasesPageClient";

export const metadata: Metadata = {
  title: "Cases",
  robots: { index: false, follow: false },
};

export default function CasesPage() {
  return <CasesPageClient />;
}
