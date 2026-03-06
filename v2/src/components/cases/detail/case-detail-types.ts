/**
 * Shared type alias for the case data object used across case detail tab components.
 * Derived from the Convex `cases.get` query return type.
 */

import type { useQuery } from "convex/react";
import type { api } from "@/../convex/_generated/api";

/**
 * The full case data object returned by `api.cases.get`, excluding null/undefined loading states.
 * All tab components in the case detail view receive this type.
 */
export type CaseDetailData = NonNullable<
  ReturnType<typeof useQuery<typeof api.cases.get>>
>;
