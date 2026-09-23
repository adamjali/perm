import "server-only";

import { exec, one } from "./client";
import {
  fetchCaseStatus,
  type CaseStatusResult,
  type ClientDeps,
  type UscisCaseStatus,
} from "@/lib/uscis/torchClient";

/**
 * Stored USCIS case statuses: what the site has been told, and when.
 *
 * STORE, BECAUSE THE OWNER SAID SO. Adam decided (2026-09-22) that USCIS
 * responses are kept, which is what lets a second reader of the same receipt
 * be answered from our copy rather than from USCIS's quota, and what lets the
 * page say "status seen <date>" honestly.
 *
 * THE COLUMNS ARE THE PRIVACY POLICY'S LIST, NOTHING MORE. Section 18 of
 * `/privacy` (id `uscis-case-status`) says what is stored: the receipt
 * number, the form type, the status text, the dated history, and the time of
 * the lookup, deleted twelve months after the last lookup. Every column below
 * is one of those (the two USCIS dates and the long status sentence are the
 * status text and its dates as USCIS returns them; the three timestamps are
 * lookup times). The raw response body is deliberately NOT kept: the policy
 * does not name it, and a stored blob that nothing reads is a liability with
 * no reader. `uscis-wiring.test.ts` holds the table to this list.
 *
 * STORED FIRST, INSIDE A WINDOW. A row younger than `FRESH_MS` answers
 * without a call. Older than that, USCIS is asked, and the stored row is
 * returned (marked stale, with the failure named) only when USCIS could not
 * answer. That last rule matters: a reader who sees a status must be able to
 * tell whether it is this morning's or last week's, so the shape carries
 * `seenAt` on every branch that returns a row.
 *
 * The table is created lazily by the first write. Every ingest in this repo
 * creates its own tables the same way; nothing here needs a migration.
 */

export const FRESH_MS = 6 * 60 * 60 * 1000;

/** Rows nobody has looked up for this long are pruned. The privacy policy states it. */
export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export const TABLE_DDL = `CREATE TABLE IF NOT EXISTS uscis_case_status (
  receipt        TEXT PRIMARY KEY,
  form_type      TEXT,
  status_text    TEXT NOT NULL,
  status_desc    TEXT,
  submitted_at   TEXT,
  modified_at    TEXT,
  history_json   TEXT,
  seen_at        INTEGER NOT NULL,
  first_seen_at  INTEGER NOT NULL,
  last_change_at INTEGER NOT NULL,
  last_read_at   INTEGER NOT NULL
)`;

export interface StoredUscisStatus extends UscisCaseStatus {
  /** When USCIS last told us this, epoch ms. */
  seenAt: number;
  firstSeenAt: number;
  /** When the status text or modified date last differed from the previous copy. */
  lastChangeAt: number;
}

interface Row {
  receipt: string;
  form_type: string | null;
  status_text: string;
  status_desc: string | null;
  submitted_at: string | null;
  modified_at: string | null;
  history_json: string | null;
  seen_at: number | string;
  first_seen_at: number | string;
  last_change_at: number | string;
}

let ensured: Promise<void> | null = null;

/** Create the table once per process. Idempotent at the database too. */
export function ensureUscisTable(): Promise<void> {
  if (!ensured) ensured = exec(TABLE_DDL).then(() => undefined);
  return ensured;
}

/** Test hook. */
export function resetEnsured(): void {
  ensured = null;
}

// libSQL returns integers as strings on some paths. Shape both.
const int = (v: number | string) => (typeof v === "number" ? v : Number(v));

function fromRow(r: Row): StoredUscisStatus {
  let history: UscisCaseStatus["history"] = [];
  try {
    const parsed = r.history_json ? (JSON.parse(r.history_json) as unknown) : [];
    if (Array.isArray(parsed)) history = parsed as UscisCaseStatus["history"];
  } catch {
    history = [];
  }
  return {
    receipt: r.receipt,
    formType: r.form_type,
    statusText: r.status_text,
    statusDesc: r.status_desc ?? "",
    submittedAt: r.submitted_at,
    modifiedAt: r.modified_at,
    history,
    seenAt: int(r.seen_at),
    firstSeenAt: int(r.first_seen_at),
    lastChangeAt: int(r.last_change_at),
  };
}

export async function readStored(receipt: string): Promise<StoredUscisStatus | null> {
  const r = await one<Row>(
    `SELECT receipt, form_type, status_text, status_desc, submitted_at, modified_at,
            history_json, seen_at, first_seen_at, last_change_at
       FROM uscis_case_status WHERE receipt = ?`,
    [receipt],
  ).catch(() => null);
  return r ? fromRow(r) : null;
}

/** Stamp that somebody read this row, so retention counts from the last lookup. */
export async function touchRead(receipt: string, now: Date): Promise<void> {
  await exec(`UPDATE uscis_case_status SET last_read_at = ? WHERE receipt = ?`, [now.getTime(), receipt]).catch(
    () => undefined,
  );
}

/**
 * Upsert a live answer. `last_change_at` moves only when the status text or
 * USCIS's modified date differs from the stored copy, so "changed" on the
 * page means USCIS changed it, not that we looked again.
 */
export async function recordStatus(status: UscisCaseStatus, now: Date): Promise<StoredUscisStatus> {
  await ensureUscisTable();
  const t = now.getTime();
  const historyJson = JSON.stringify(status.history);
  await exec(
    `INSERT INTO uscis_case_status
       (receipt, form_type, status_text, status_desc, submitted_at, modified_at, history_json,
        seen_at, first_seen_at, last_change_at, last_read_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(receipt) DO UPDATE SET
       form_type    = excluded.form_type,
       status_text  = excluded.status_text,
       status_desc  = excluded.status_desc,
       submitted_at = excluded.submitted_at,
       modified_at  = excluded.modified_at,
       history_json = excluded.history_json,
       seen_at      = excluded.seen_at,
       last_read_at = excluded.last_read_at,
       last_change_at = CASE
         WHEN uscis_case_status.status_text IS NOT excluded.status_text
           OR uscis_case_status.modified_at IS NOT excluded.modified_at
         THEN excluded.last_change_at
         ELSE uscis_case_status.last_change_at END`,
    [
      status.receipt,
      status.formType,
      status.statusText,
      status.statusDesc,
      status.submittedAt,
      status.modifiedAt,
      historyJson,
      t,
      t,
      t,
      t,
    ],
  );
  const stored = await readStored(status.receipt);
  // If the read-back fails (a read-only token in dev, say), answer from what
  // we just wrote rather than pretending the lookup failed.
  return stored ?? { ...status, seenAt: t, firstSeenAt: t, lastChangeAt: t };
}

/** Delete rows nobody has read inside the retention window. Returns rows removed. */
export async function pruneUscisCaseStatus(now: Date): Promise<number> {
  await ensureUscisTable();
  return exec(`DELETE FROM uscis_case_status WHERE last_read_at < ?`, [now.getTime() - RETENTION_MS]);
}

export type UscisLookupResult =
  | { kind: "ok"; status: StoredUscisStatus; source: "stored" | "live" }
  | { kind: "stale"; status: StoredUscisStatus; failure: Exclude<CaseStatusResult, { kind: "ok" }>["kind"] }
  | Exclude<CaseStatusResult, { kind: "ok" }>;

/**
 * One receipt in, the best honest answer out. Reads the stored row first;
 * asks USCIS when the row is missing or older than the freshness window;
 * never invents anything.
 */
export async function lookupUscisCase(
  receipt: string,
  now: Date = new Date(),
  deps: ClientDeps & { freshMs?: number } = {},
): Promise<UscisLookupResult> {
  const freshMs = deps.freshMs ?? FRESH_MS;
  const stored = await readStored(receipt);
  if (stored && now.getTime() - stored.seenAt < freshMs) {
    await touchRead(receipt, now);
    return { kind: "ok", status: stored, source: "stored" };
  }
  const live = await fetchCaseStatus(receipt, { now: () => now, fetchImpl: deps.fetchImpl });
  if (live.kind === "ok") {
    const saved = await recordStatus(live.status, now);
    return { kind: "ok", status: saved, source: "live" };
  }
  if (stored) {
    await touchRead(receipt, now);
    return { kind: "stale", status: stored, failure: live.kind };
  }
  return live;
}
