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
 * Task: 22-05 (Edit Case Page)
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { EditCasePageClient } from "./EditCasePageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Edit case",
    robots: { index: false, follow: false },
  };
}

export default function EditCasePage() {
  return (
    // Suspense required: EditCasePageClient uses useSearchParams() for deep-link field/section
    <Suspense>
      <EditCasePageClient />
    </Suspense>
  );
}
