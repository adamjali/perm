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
 * Task: 22-04 (Add Case Page)
 */

import type { Metadata } from "next";
import { AddCasePageClient } from "./AddCasePageClient";

export const metadata: Metadata = {
  title: "New case",
  robots: { index: false, follow: false },
};

export default function AddCasePage() {
  return <AddCasePageClient />;
}
