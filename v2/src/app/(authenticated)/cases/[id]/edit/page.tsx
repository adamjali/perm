/**
 * Edit Case Page
 *
 * Page for editing an existing case with pre-populated form data.
 *
 * Features:
 * - Uses CaseForm component in "edit" mode
 * - Pre-populates form with fetched case data
 * - Loading skeleton while fetching
 * - Not found state for missing/inaccessible cases
 * - Success redirect to case detail page
 * - Cancel navigation back to case detail
 *
 * Phase: 22 (Case Forms)
 * Task: 22-05 (Edit Case Page)
 * Created: 2025-12-25
 */

import type { Metadata } from "next";
import { EditCasePageClient } from "./EditCasePageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Edit Case",
    robots: { index: false, follow: false },
  };
}

export default function EditCasePage() {
  return <EditCasePageClient />;
}
