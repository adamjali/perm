import { NextResponse } from "next/server";

import {
  BRANCH,
  CRON_JOBS,
  RECENT_RUN_WINDOW_MS,
  REPO,
} from "../jobs";

/**
 * Vercel's clock, GitHub's runners.
 *
 * Vercel invokes this with `Authorization: Bearer <CRON_SECRET>` (the
 * header is added automatically when the env var exists) on the schedules
 * in vercel.json; the route fires `workflow_dispatch` for the named job.
 * See ../jobs.ts for why GitHub's own scheduler is not trusted with this.
 *
 * Three refusals and one skip, each with its own status so monitoring can
 * tell them apart: 401 (not Vercel), 404 (not a job), 500 (the GitHub token
 * is not configured, which is the state between deploying this and Adam
 * creating the token), and 200 with `skipped` when the workflow already has
 * a run from the last 20 minutes (Vercel documents duplicate deliveries).
 * A GitHub refusal is 502 with GitHub's status, never a 200.
 */

export const dynamic = "force-dynamic";

const GITHUB = "https://api.github.com";
const TAG = "[cronDispatch]";

interface WorkflowRun {
  created_at: string;
  status: string;
  html_url?: string;
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "permtracker-cron-dispatch",
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ job: string }> },
): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  const spec = CRON_JOBS[job];
  if (!spec) {
    return NextResponse.json({ error: "Unknown job", job }, { status: 404 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    console.error(`${TAG} ${job}: GITHUB_DISPATCH_TOKEN is not set; nothing dispatched`);
    return NextResponse.json(
      { error: "GITHUB_DISPATCH_TOKEN is not set", job },
      { status: 500 },
    );
  }

  const base = `${GITHUB}/repos/${REPO}/actions/workflows/${spec.workflow}`;
  const now = Date.now();

  try {
    const recent = await fetch(`${base}/runs?per_page=5`, { headers: githubHeaders(token) });
    if (recent.ok) {
      const body = (await recent.json()) as { workflow_runs?: WorkflowRun[] };
      const fresh = (body.workflow_runs ?? []).find(
        (r) => now - Date.parse(r.created_at) < RECENT_RUN_WINDOW_MS,
      );
      if (fresh) {
        const minutes = Math.round((now - Date.parse(fresh.created_at)) / 60_000);
        console.log(`${TAG} ${job}: skipped, a run started ${minutes} min ago (${fresh.status})`);
        return NextResponse.json({
          job,
          skipped: `a run of ${spec.workflow} started ${minutes} min ago`,
          run: fresh.html_url ?? null,
        });
      }
    } else {
      // A failed read must not stop the dispatch: the guard is a courtesy
      // against duplicates, and the workflow's own concurrency group is the
      // real protection. Say so in the log.
      console.warn(`${TAG} ${job}: could not list runs (HTTP ${recent.status}); dispatching anyway`);
    }

    const res = await fetch(`${base}/dispatches`, {
      method: "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: BRANCH, inputs: spec.inputs ?? {} }),
    });
    if (res.status !== 204) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`${TAG} ${job}: GitHub answered ${res.status}: ${detail}`);
      return NextResponse.json(
        { error: "GitHub refused the dispatch", job, githubStatus: res.status, detail },
        { status: 502 },
      );
    }
    console.log(`${TAG} ${job}: dispatched ${spec.workflow} ${JSON.stringify(spec.inputs ?? {})}`);
    return NextResponse.json({
      job,
      dispatched: spec.workflow,
      inputs: spec.inputs ?? {},
      at: new Date(now).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} ${job}: ${message}`);
    return NextResponse.json({ error: "GitHub unreachable", job, detail: message }, { status: 502 });
  }
}
