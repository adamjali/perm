/**
 * The scheduled GitHub jobs that the server's clock drives.
 *
 * WHY THIS EXISTS. GitHub's `schedule` trigger ran this repo's crons two to
 * seven and a half hours late on every one of the nine days measured to
 * Sep 7 2026 (the "4:10 AM" sweep landed between 8:00 and 8:50 AM, the
 * health check between 9:15 and 10:30). So each job here has a systemd timer
 * on the server (scripts/oracle/systemd/permtracker-cron@dispatch-<job>.timer)
 * that calls `/api/cron/dispatch/<job>`, and the route fires GitHub's
 * `workflow_dispatch` for it. Vercel's cron did this from Sep 7 2026 until
 * the move to the server on Sep 28 2026.
 *
 * Kept in a sibling of the route on purpose: a `route.ts` may export only
 * handler names, and the timers have to agree with this table, which the
 * test next door enforces.
 */

export interface CronJob {
  /** The workflow file under .github/workflows. */
  workflow: string;
  /** `workflow_dispatch` inputs; omitted for workflows that take none. */
  inputs?: Record<string, string>;
  /** When it runs, as a UTC cron expression; its timer's OnCalendar must match. */
  schedule: string;
  /** What the job is, for the log line and the docs. */
  description: string;
}

export const REPO = "adamjali/perm";
export const BRANCH = "main";

/**
 * A second dispatch inside this window is skipped. A timer that catches up
 * after a restart (Persistent=true) can land on a scheduled run; a second full sweep
 * is ~10,000 DOL requests for nothing, and the workflow's concurrency group
 * would queue it rather than drop it.
 */
export const RECENT_RUN_WINDOW_MS = 20 * 60 * 1000;

export const CRON_JOBS: Record<string, CronJob> = {
  "processing-times": {
    workflow: "processing-times-ingest.yml",
    schedule: "0 7 * * *",
    description: "DOL processing times, daily",
  },
  "case-status-full": {
    workflow: "case-status-direct.yml",
    inputs: { mode: "full" },
    schedule: "10 8 * * *",
    description: "every PERM case against DOL, plus the discovery walk, daily",
  },
  "pwd-daily": {
    workflow: "pwd-status-direct.yml",
    inputs: { mode: "pending" },
    schedule: "40 9 * * *",
    description: "pending PWD and LCA cases against DOL, daily",
  },
  "ingest-health": {
    workflow: "ingest-health.yml",
    schedule: "0 10 * * *",
    description: "freshness, frontier, backfill and lookup-demand check, daily",
  },
  "pwd-weekly-full": {
    workflow: "pwd-status-direct.yml",
    inputs: { mode: "full" },
    schedule: "40 10 * * 0",
    description: "the rolling-window PWD and LCA re-check, Sundays",
  },
  "watched-cases": {
    workflow: "watched-cases.yml",
    schedule: "25 * * * *",
    description: "the cases someone has an alert on, against DOL, hourly (skips an hour a sweep is running)",
  },
  "case-status-pending": {
    workflow: "case-status-direct.yml",
    inputs: { mode: "pending" },
    schedule: "40 19 * * *",
    description: "pending PERM cases against DOL, the mid-day refresh",
  },
  "daily-monitor": {
    workflow: "daily-monitor.yml",
    schedule: "30 11 * * *",
    description: "the morning operator report: health, bills, runs, traffic, emailed to the admin",
  },
  "convex-backup": {
    workflow: "convex-backup.yml",
    schedule: "50 7 * * *",
    description: "a full Convex export, sealed on the runner and copied to R2 by the server, nightly",
  },
};

export const CRON_PATH_PREFIX = "/api/cron/dispatch/";

/**
 * Housekeeping that runs INSIDE this app rather than on GitHub. Same clock,
 * same secret, its own route, because the work is a Turso write the app's
 * own read layer owns (and tests): a GitHub step would restate the retention
 * constant in a second language. The test next door holds the server's
 * timers to the union of this table and CRON_JOBS.
 */
export interface HousekeepingJob {
  /** The route the timer calls: /api/cron/<name>, which permtracker-cron builds. */
  path: string;
  /** When it runs, as a UTC cron expression; its timer's OnCalendar must match. */
  schedule: string;
  description: string;
}

export const HOUSEKEEPING_JOBS: Record<string, HousekeepingJob> = {
  "prune-uscis": {
    path: "/api/cron/prune-uscis",
    schedule: "20 9 * * *",
    description: "delete USCIS case-status rows nobody has looked up for twelve months (privacy policy, section 18)",
  },
  scorecard: {
    path: "/api/cron/scorecard",
    schedule: "0 12 * * *",
    description: "record today's sampled predictions, grade the decided ones, rewrite the scorecard summaries",
  },
};
