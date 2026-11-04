import { EstimateChecksList } from "@/components/scorecard/EstimateChecksList";
import { getEstimateChecks } from "@/lib/db/estimateChecks";
import { PERM_CHECKS, type CheckRow } from "@/lib/scorecard/checks";

const SCOPES: Record<"perm" | "pwd", readonly CheckRow["key"][]> = { perm: PERM_CHECKS, pwd: ["pwd-day"] };

/**
 * How well the site's estimates have held, read live from its own checks (src/lib/scorecard/checks.ts), for a guide.
 * `scope="perm"` keeps the PERM rows only, `scope="pwd"` the wage-request day. Three guides had typed the October
 * 15 and 16 figures, which went stale in weeks.
 */
export async function EstimateChecksNow({ scope = "all" }: { scope?: "all" | "perm" | "pwd" }) {
  const rows = await getEstimateChecks().catch(() => []);
  const shown = scope === "all" ? rows : rows.filter((r) => SCOPES[scope].includes(r.key));
  return <EstimateChecksList rows={shown} className="not-prose my-6" />;
}
