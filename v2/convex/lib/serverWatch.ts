/**
 * The off-server check on the server: pure rules, tested in serverWatch.test.ts.
 *
 * WHY IT LIVES OFF THE SERVER. On Oct 10 2026 the server's disk filled and
 * every monitor ON the server (the watchdog, the defense, the health sampler)
 * went blind with it; the owner heard at the 7:30 AM report, two hours later.
 * The server now alarms on itself (scripts/oracle/bin/permtracker-alarm), but
 * nothing on a machine can report that machine being gone. Convex runs
 * elsewhere, so it reads the health report the server writes every 10 minutes
 * (perm_docs['server_health'], scripts/oracle/bin/permtracker-health) and
 * emails when that report goes quiet, when the database stops answering, or
 * when the report says the disk is nearly full.
 */

/** The sampler writes every 10 minutes; three missed writes is an alarm. */
export const STALE_MS = 35 * 60 * 1000;
/** Reminders while an alarm lasts. */
export const REMIND_MS = 6 * 60 * 60 * 1000;
/** Disk use the report itself flags (the server's own alarm acts at 25 GB free, about 83%). */
export const DISK_PCT = 90;

export interface HealthRow {
  computed_at: number | string | null;
  json: string | null;
}

/** Why the server needs a look, or null when its report is fresh and the disk has room. */
export function judge(row: HealthRow | null, now: number, readError?: string): string | null {
  if (readError) return `the server's database did not answer (${readError.slice(0, 160)})`;
  if (!row || row.computed_at === null) return "the server has never written its health report";
  const age = now - Number(row.computed_at);
  if (!(age <= STALE_MS)) {
    return `the server's health report is ${Math.round(age / 60000)} minutes old (it writes one every 10)`;
  }
  try {
    const doc = JSON.parse(row.json ?? "{}") as { now?: { diskPct?: number } };
    const disk = doc.now?.diskPct;
    if (typeof disk === "number" && disk >= DISK_PCT) return `the server's disk is ${disk}% full`;
  } catch {
    return "the server's health report could not be read";
  }
  return null;
}

export interface WatchState {
  down: boolean;
  since: number;
  mailedAt: number;
  reason: string;
}

export type WatchMail = { kind: "start" | "still" | "clear"; reason: string } | null;

/** The next state, and the email this check should send (start, reminder, recovery, or none). */
export function step(prev: WatchState | null, reason: string | null, now: number): { next: WatchState; mail: WatchMail } {
  if (reason) {
    if (!prev || !prev.down) {
      return { next: { down: true, since: now, mailedAt: now, reason }, mail: { kind: "start", reason } };
    }
    if (now - prev.mailedAt >= REMIND_MS) {
      return { next: { ...prev, mailedAt: now, reason }, mail: { kind: "still", reason } };
    }
    return { next: { ...prev, reason }, mail: null };
  }
  if (prev?.down) {
    return { next: { down: false, since: now, mailedAt: now, reason: "" }, mail: { kind: "clear", reason: prev.reason } };
  }
  return { next: { down: false, since: prev?.since ?? now, mailedAt: prev?.mailedAt ?? 0, reason: "" }, mail: null };
}
