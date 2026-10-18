/**
 * An occupation's SOC code, as every page, search and table on the site keys it.
 *
 * DOL prints one job two ways: `15-1252.00` (the O*NET form) and `15-1252` (the
 * SOC form). On Sep 4 2026 `perm_cases` held 302,081 dotted codes and 71,858
 * bare ones, and `pwd_cases` held no dotted code at all, so an exact match on
 * either spelling misses the other (an exact match on the dotted accountants,
 * 13-2011, lost 24.7% of them; on registered nurses, 29-1141, 31%). Every
 * reader matches on the SOC detail occupation, the first seven characters,
 * through the helpers here.
 *
 * The cost, stated: O*NET splits a few SOC occupations into finer jobs
 * (`15-1299.08` and `15-1299.09`), and a search for one reaches its group.
 * DOL publishes nothing finer for the other programs, so the site can't either.
 */

const GROUP = /^(\d{2}-\d{4})/;

/** A whole SOC code as a reader types it, `15-1252` or `15-1252.00`: what DOL's wage search takes. */
export const SOC_CODE_RE = /^\d{2}-\d{4}$|^\d{2}-\d{4}\.\d{2}$/;

/** `15-1252` from `15-1252.00`, `15-1252` or ` 15-1252.01 `; null when it isn't a SOC code. */
export function socGroup(code: string | null | undefined): string | null {
  return GROUP.exec((code ?? "").trim())?.[1] ?? null;
}

/**
 * The same rule over a table's `soc_code` column, written once. The indexes
 * that serve it (`idx_pc_socg_*` in scripts/db_migrate.py, the `*_soc_dec`
 * indexes in scripts/ingest_flag_disclosure.py) are built on this exact text:
 * SQLite uses an expression index only when the two parse to the same tree.
 */
export const SOC_GROUP_SQL = "substr(soc_code, 1, 7)";

/**
 * The condition for one job: the group bound as its argument, so no caller can
 * bind a raw `15-1252.00` against a seven-character group and match nothing
 * (which /case-search did, on employer and state searches, until Oct 18 2026).
 * A code that isn't a SOC code matches nothing, never everything.
 */
export function socGroupClause(code: string | null | undefined): { sql: string; args: string[] } {
  const group = socGroup(code);
  return group ? { sql: `${SOC_GROUP_SQL} = ?`, args: [group] } : { sql: "0", args: [] };
}

/**
 * Schedule A, Group I (20 CFR 656.5(a)): physical therapists and professional
 * nurses. Their employers file the labor certification with USCIS, "not with an
 * ETA application processing center" (656.15(a)), so DOL's PERM files hold only a
 * handful of them, and any page counting this job from those files says so.
 */
const SCHEDULE_A_GROUPS: ReadonlySet<string> = new Set(["29-1123", "29-1141"]);

export function isScheduleA(code: string | null | undefined): boolean {
  const group = socGroup(code);
  return group !== null && SCHEDULE_A_GROUPS.has(group);
}
