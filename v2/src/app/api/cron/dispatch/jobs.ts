/**
 * The scheduled GitHub jobs that Vercel's clock drives.
 *
 * WHY THIS EXISTS. GitHub's `schedule` trigger ran this repo's crons two to
 * seven and a half hours late on every one of the nine days measured to
 * Sep 7 2026 (the "4:10 AM" sweep landed between 8:00 and 8:50 AM, the
 * health check between 9:15 and 10:30). Vercel invokes a cron job within
 * the minute on Pro, so each job here is a Vercel cron that calls
 * `/api/cron/dispatch/<job>`, and the route fires GitHub's
 * `workflow_dispatch` for it. The schedules are the same UTC strings the
 * workflows used to carry in their own `schedule:` blocks.
 *
 * Deployment note: Vercel binds environment variables at build time, and
 * `vercel redeploy` of a docs-only commit is skipped by the ignore rule
 * (it reads as a 9-second "Canceled" deployment), so the build that
 * bound GITHUB_DISPATCH_TOKEN on Sep 7 2026 had to carry a change under
 * src/. This comment is that change.
 *
 * Kept in a sibling of the route on purpose: a `route.ts` may export only
 * handler names, and `vercel.json` has to agree with this table, which the
 * test next door enforces.
 */

export interface CronJob {
  /** The workflow file under .github/workflows. */
  workflow: string;
  /** `workflow_dispatch` inputs; omitted for workflows that take none. */
  inputs?: Record<string, string>;
  /** The cron expression, UTC, exactly as it appears in vercel.json. */
  schedule: string;
  /** What the job is, for the log line and the docs. */
  description: string;
}

export const REPO = "adamjali/perm";
export const BRANCH = "main";

/**
 * A second dispatch inside this window is skipped. Vercel documents that
 * cron delivery can invoke the same scheduled run twice; a second full sweep
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
  "case-status-pending": {
    workflow: "case-status-direct.yml",
    inputs: { mode: "pending" },
    schedule: "40 19 * * *",
    description: "pending PERM cases against DOL, the mid-day refresh",
  },
};

export const CRON_PATH_PREFIX = "/api/cron/dispatch/";
