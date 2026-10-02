import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The sweep's revalidation route: the secret, the literal paths, and the drift
 * guard that re-derives the list from every page reading a sweep-written figure.
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag: vi.fn() }));

const { POST } = await import("../route");
const { SWEEP_PAGES } = await import("../paths");

const SECRET = "test-secret-value";
const post = (secret: string | null = SECRET) =>
  new Request("https://permtracker.app/api/revalidate-sweep", {
    method: "POST",
    headers: secret === null ? {} : { "x-revalidate-secret": secret },
  });

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-sweep", () => {
  it("refuses no secret, a wrong one, and an unconfigured one", async () => {
    expect((await POST(post(null))).status).toBe(403);
    expect((await POST(post("wrong"))).status).toBe(403);
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(post(null))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expires every listed literal path on a valid call", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledTimes(SWEEP_PAGES.length);
    for (const call of revalidatePath.mock.calls) expect(call).toHaveLength(1);
    for (const p of SWEEP_PAGES) expect(p).not.toContain("[");
  });
});

describe("the list covers every cached page that reads a sweep-written figure", () => {
  /** Readers whose data only the sweep writes. */
  const READERS = [
    "getObservedDays",
    "getActivitySeries",
    "getChangeActivity",
    "getLiveCensus",
    "getSweepCoverage",
    "getReviewStages",
    "getDecisionPace",
    "getStageStats",
    "getEmployerStages",
    "getLiveBacklog",
    "getLiveMirrorSize",
    "getQueueAhead",
    "getPwdSummary",
    "getLcaSummary",
    "getSeasonalSummary",
  ];
  const EXCLUDED: Record<string, string> = {
    "/perm-queue/[month]":
      "~40 generated pages on a six-hour window; expiring a generated tail in one call is the cost the employer endpoint exists to avoid",
    "/perm-rfi-audit/[stage]": "generated per stage on its own window, for the same reason",
    "/perm-case-status": "fully dynamic, so there is no cached copy to expire",
    "/perm-employers/[slug]":
      "a 30-day tail of ~100,000 pages; the ones whose figures moved are expired one by one by /api/revalidate-live-employers",
  };

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (e === "page.tsx") out.push(p);
    }
    return out;
  }

  it("has no page missing", () => {
    const appDir = join(process.cwd(), "src", "app");
    const pages = walk(appDir);
    expect(pages.length).toBeGreaterThan(30);
    let readers = 0;
    const missing: string[] = [];
    for (const file of pages) {
      const src = readFileSync(file, "utf8");
      if (!READERS.some((r) => new RegExp(`\\b${r}\\s*\\(`).test(src))) continue;
      readers += 1;
      if (!/export const revalidate\s*=/.test(src)) continue;
      const route =
        "/" +
        file
          .slice(appDir.length + 1)
          .replace(/\/page\.tsx$/, "")
          .replace(/\([^)]*\)\/?/g, "")
          .replace(/^\/+|\/+$/g, "");
      const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
      if (normalized in EXCLUDED) continue;
      if (!(SWEEP_PAGES as readonly string[]).includes(normalized)) missing.push(normalized);
    }
    // Control: a walk that matched no reader would pass while proving nothing.
    expect(readers).toBeGreaterThan(4);
    expect(missing, `pages reading sweep figures but not expired by the sweep: ${missing.join(", ")}`).toEqual([]);
  });
});
