import type { GreenCardRoute } from "@/lib/perm";

/** The two ways to the green card, as a reader chooses between them (the planner, the fee calculator). */
export const ROUTE_LABEL: Record<GreenCardRoute, { name: string; note: string }> = {
  aos: { name: "Inside the US", note: "Adjustment of status, Form I-485" },
  cp: { name: "At a US consulate abroad", note: "Consular processing, through the National Visa Center" },
};
