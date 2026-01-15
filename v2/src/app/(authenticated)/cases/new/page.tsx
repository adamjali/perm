/**
 * Add Case Page
 *
 * Page for creating a new case with duplicate detection.
 *
 * Features:
 * - Uses CaseForm component in "add" mode
 * - Duplicate detection before save (employer + beneficiary)
 * - Warning dialog with skip/override options
 * - Success redirect to case detail
 * - Cancel navigation back to cases list
 *
 * Phase: 22 (Case Forms)
 * Task: 22-04 (Add Case Page)
 * Created: 2025-12-25
 */

import type { Metadata } from "next";
import { AddCasePageClient } from "./AddCasePageClient";

export const metadata: Metadata = {
  title: "New Case",
  robots: { index: false, follow: false },
};

export default function AddCasePage() {
  return <AddCasePageClient />;
}
