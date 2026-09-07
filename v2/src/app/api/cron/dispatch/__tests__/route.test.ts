import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The guards on the cron dispatcher, and the drift guard between the job
 * table and vercel.json: a job whose schedule is in one and not the other
 * is a job that silently never runs, which is the exact defect this route
 * exists to end.
 */

const { GET } = await import("../[job]/route");
const { CRON_JOBS, CRON_PATH_PREFIX, RECENT_RUN_WINDOW_MS, REPO } = await import("../jobs");

const SECRET = "cron-secret-for-tests";
const TOKEN = "github-token-for-tests";

function call(job: string, auth: string | null = `Bearer ${SECRET}`) {
  const headers: Record<string, string> = {};
  if (auth !== null) headers.authorization = auth;
  const request = new Request(`https://permtracker.app/api/cron/dispatch/${job}`, { headers });
  return GET(request, { params: Promise.resolve({ job }) });
}

function githubMock(runs: Array<{ created_at: string; status: string }>, dispatchStatus = 204) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/runs?per_page=5")) {
      return new Response(JSON.stringify({ workflow_runs: runs }), { status: 200 });
    }
    if (u.endsWith("/dispatches") && init?.method === "POST") {
      return new Response(dispatchStatus === 204 ? null : "no", { status: dispatchStatus });
    }
    throw new Error(`unexpected fetch ${u}`);
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  process.env.GITHUB_DISPATCH_TOKEN = TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/cron/dispatch/[job]", () => {
  it("refuses no header, a wrong secret, and an unconfigured secret with 401", async () => {
    const fetchMock = githubMock([]);
    vi.stubGlobal("fetch", fetchMock);
    expect((await call("ingest-health", null)).status).toBe(401);
    expect((await call("ingest-health", "Bearer wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call("ingest-health", null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a job that is not in the table, before touching GitHub", async () => {
    const fetchMock = githubMock([]);
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("nuke-everything");
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 500, not 200, while the GitHub token is missing", async () => {
    const fetchMock = githubMock([]);
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.GITHUB_DISPATCH_TOKEN;
    const res = await call("ingest-health");
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "GITHUB_DISPATCH_TOKEN is not set" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches with the branch, the inputs and the GitHub headers", async () => {
    const fetchMock = githubMock([]);
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("case-status-full");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      dispatched: "case-status-direct.yml",
      inputs: { mode: "full" },
    });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    const [url, init] = post as [string, RequestInit];
    expect(url).toBe(`https://api.github.com/repos/${REPO}/actions/workflows/case-status-direct.yml/dispatches`);
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main", inputs: { mode: "full" } });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers["User-Agent"]).toBeTruthy();
  });

  it("sends empty inputs for a workflow that takes none", async () => {
    const fetchMock = githubMock([]);
    vi.stubGlobal("fetch", fetchMock);
    await call("ingest-health");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(String(post[1].body))).toEqual({ ref: "main", inputs: {} });
  });

  it("skips when the workflow already has a run inside the window (duplicate delivery)", async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const fetchMock = githubMock([{ created_at: fiveMinutesAgo, status: "in_progress" }]);
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("pwd-daily");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ skipped: expect.stringContaining("started 5 min ago") });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("does not skip for a run older than the window", async () => {
    const old = new Date(Date.now() - RECENT_RUN_WINDOW_MS - 60_000).toISOString();
    const fetchMock = githubMock([{ created_at: old, status: "completed" }]);
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("pwd-daily");
    await expect(res.json()).resolves.toMatchObject({ dispatched: "pwd-status-direct.yml" });
  });

  it("reports a GitHub refusal as 502 with GitHub's status, never as success", async () => {
    vi.stubGlobal("fetch", githubMock([], 422));
    const res = await call("processing-times");
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ githubStatus: 422 });
  });

  it("reports an unreachable GitHub as 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("getaddrinfo ENOTFOUND"); }));
    const res = await call("processing-times");
    expect(res.status).toBe(502);
  });
});

describe("vercel.json agrees with the job table", () => {
  const vercelJson = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  const crons = vercelJson.crons ?? [];

  it("declares exactly one cron per job, at the job's schedule", () => {
    const byPath = new Map(crons.map((c) => [c.path, c.schedule]));
    for (const [name, job] of Object.entries(CRON_JOBS)) {
      expect(byPath.get(`${CRON_PATH_PREFIX}${name}`), `cron for ${name}`).toBe(job.schedule);
    }
    expect(crons.length, "a cron pointing at a job that is not in the table").toBe(Object.keys(CRON_JOBS).length);
  });

  it("every cron path resolves to a known job", () => {
    for (const c of crons) {
      expect(c.path.startsWith(CRON_PATH_PREFIX)).toBe(true);
      expect(CRON_JOBS[c.path.slice(CRON_PATH_PREFIX.length)], c.path).toBeDefined();
    }
  });
});
