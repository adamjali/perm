import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The guards on the DOL revalidation route, plus the drift guard that is the
 * real reason this file exists.
 *
 * The endpoint takes no input, so there is no traversal case to test the way
 * the employer endpoint has one. What CAN rot is the path list: it is a
 * hand-maintained enumeration of the pages that render DOL's snapshot, and the
 * failure mode when someone adds a page and forgets it is invisible. The new
 * page simply keeps serving a stale number for a day, with nothing red
 * anywhere. So the last test walks the app tree and re-derives the list.
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { POST } = await import("../route");
const { DOL_PAGES } = await import("../paths");

const SECRET = "test-secret-value";

function post(secret: string | null = SECRET): Request {
  return new Request("https://permtracker.app/api/revalidate-dol", {
    method: "POST",
    headers: secret === null ? {} : { "x-revalidate-secret": secret },
  });
}

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-dol", () => {
  it("refuses no secret, a wrong secret, and an unconfigured secret", async () => {
    expect((await POST(post(null))).status).toBe(403);
    expect((await POST(post("wrong"))).status).toBe(403);

    // The unconfigured case is the one that matters: an endpoint deployed
    // before its secret exists must be shut, not open. `!expected` has to be
    // part of the condition, because `undefined !== null` would otherwise let
    // a caller sending no header through on a box with no secret set.
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(post(null))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expires every listed path on a valid call", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ revalidated: DOL_PAGES.length });
    expect(revalidatePath).toHaveBeenCalledTimes(DOL_PAGES.length);
    for (const p of DOL_PAGES) expect(revalidatePath).toHaveBeenCalledWith(p);
  });

  it("uses LITERAL paths, never the (route, 'page') pattern form", () => {
    // The pattern form would expire every page under a dynamic segment in one
    // call. That is the cost failure the employer endpoint was built to avoid,
    // and it is one careless argument away here too.
    for (const call of revalidatePath.mock.calls) expect(call).toHaveLength(1);
    for (const p of DOL_PAGES) {
      expect(p.startsWith("/")).toBe(true);
      expect(p).not.toContain("[");
    }
  });
});

describe("the path list has not drifted from the pages that read the snapshot", () => {
  /**
   * Pages that read the snapshot and are deliberately NOT in the list. Each
   * needs a reason, because "it is excluded" and "someone forgot it" look
   * identical from here.
   */
  const EXCLUDED: Record<string, string> = {
    "/perm-queue/[month]":
      "~39 generated pages on a 1h window; they self-heal, and expiring a whole generated tail in one call is the employer-page cost mistake",
    "/perm-case-status": "fully dynamic (no revalidate), so there is no cached copy to expire",
  };

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (e === "page.tsx" || e === "route.ts") out.push(p);
    }
    return out;
  }

  it("covers every ISR page that renders getProcessingTimes / estimate", () => {
    const appDir = join(process.cwd(), "src", "app");
    const pages = walk(appDir);

    // Control: a run that found no pages would pass every assertion below
    // while proving nothing, which is the shape of blind sweep this repo has
    // shipped before.
    expect(pages.length).toBeGreaterThan(30);

    const missing: string[] = [];
    for (const file of pages) {
      const src = readFileSync(file, "utf8");
      const readsDol =
        src.includes("getProcessingTimes") || /from\s+["'][^"']*turso\/estimate["']/.test(src);
      if (!readsDol) continue;

      // Only ISR pages have anything to expire. A page with no `revalidate` is
      // dynamic and renders fresh every time.
      if (!/export const revalidate\s*=/.test(src)) continue;

      const route =
        "/" +
        file
          .slice(appDir.length + 1)
          .replace(/\/(page\.tsx|route\.ts)$/, "")
          .replace(/\([^)]*\)\/?/g, "") // strip route groups like (site)/(public)
          .replace(/^\/+|\/+$/g, "");

      const normalized = route === "/" ? "/" : route.replace(/\/$/, "");
      if (normalized in EXCLUDED) continue;
      if (!(DOL_PAGES as readonly string[]).includes(normalized)) missing.push(normalized);
    }

    expect(
      missing,
      `These pages render DOL's snapshot but are not in DOL_PAGES, so they will serve a stale ` +
        `figure for a full revalidate window after DOL moves. Add them, or add an EXCLUDED entry ` +
        `with the reason: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("lists no path that no page actually serves", () => {
    // The mirror failure: a path left behind after a page is renamed or
    // deleted. `revalidatePath` on a route that does not exist is silent, so
    // nothing would ever surface it.
    const appDir = join(process.cwd(), "src", "app");
    const pages = walk(appDir);
    const routes = new Set(
      pages.map(
        (f) =>
          "/" +
          f
            .slice(appDir.length + 1)
            .replace(/\/(page\.tsx|route\.ts)$/, "")
            .replace(/\([^)]*\)\/?/g, "")
            .replace(/^\/+|\/+$/g, ""),
      ),
    );
    const orphans = (DOL_PAGES as readonly string[]).filter((p) => !routes.has(p));
    expect(orphans, `DOL_PAGES lists paths with no page: ${orphans.join(", ")}`).toEqual([]);
  });
});
