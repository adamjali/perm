import "server-only";

import { doc } from "@/lib/turso/publicData";
import type { VisaAnnualLimitsDoc } from "@/lib/visaLimits";

/** The Department's annual limits and Table V, written once a year by scripts/ingest_visa_limits.py. */
export async function getVisaAnnualLimits(): Promise<VisaAnnualLimitsDoc | null> {
  return doc<VisaAnnualLimitsDoc>("visa_annual_limits");
}
