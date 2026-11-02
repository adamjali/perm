/**
 * A SOC code's shape, the one rule for every writer and reader: the case form, the chat, an import, the
 * public finder and the database helpers in `src/lib/socCode.ts`, which re-exports these.
 *
 * DOL prints one job two ways: `15-1252.00` (the O*NET form) and `15-1252` (the SOC form). A case stores
 * the seven-character group, the form every table on the site keys a job by.
 */

const GROUP = /^(\d{2}-\d{4})/;

/** A whole SOC code as a reader types it, `15-1252` or `15-1252.00`: what DOL's wage search takes. */
export const SOC_CODE_RE = /^\d{2}-\d{4}$|^\d{2}-\d{4}\.\d{2}$/;

/** `15-1252` from `15-1252.00`, `15-1252` or ` 15-1252.01 `; null when it isn't a SOC code. */
export function socGroup(code: string | null | undefined): string | null {
  return GROUP.exec((code ?? "").trim())?.[1] ?? null;
}

/** Whether a value is a whole SOC code, either spelling. */
export function isSocCode(code: string | null | undefined): boolean {
  return SOC_CODE_RE.test((code ?? "").trim());
}
