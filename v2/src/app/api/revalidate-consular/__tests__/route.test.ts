import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The consulate refresh route: its guards, and the two ways its lists can rot with nothing red:
 * a new page that reads State's scheduling table and isn't listed, and a family pattern that
 * matches no page (revalidatePath on it is a silent no-op).
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag: vi.fn() }));

const { POST } = await import("../route");
const { CONSULAR_PAGES, CONSULAR_PAGE_FAMILIES } = await import("../paths");

const SECRET = "test-secret-value";
const appDir = join(process.cwd(), "src", "app");

function post(secret: string | null = SECRET): Request {
  return new Request("https://permtracker.app/api/revalidate-consular", {
    method: "POST",
    headers: secret === null ? {} : { "x-revalidate-secret": secret },
  });
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "page.tsx" || e === "route.ts") out.push(p);
  }
  return out;
}

const urlOf = (fileRoute: string) => "/" + fileRoute.replace(/\([^)]*\)\/?/g, "").replace(/^\/+|\/+$/g, "");
const routeOf = (file: string) => urlOf(file.slice(appDir.length + 1).replace(/\/(page\.tsx|route\.ts)$/, ""));

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-consular", () => {
  it("refuses no secret, a wrong secret, and an unconfigured secret", async () => {
    expect((await POST(post(null))).status).toBe(403);
    expect((await POST(post("wrong"))).status).toBe(403);
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(post(null))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expires every listed page, and every family as pages", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    for (const p of CONSULAR_PAGES) expect(revalidatePath).toHaveBeenCalledWith(p);
    for (const f of CONSULAR_PAGE_FAMILIES) expect(revalidatePath).toHaveBeenCalledWith(f, "page");
    expect(revalidatePath).toHaveBeenCalledTimes(CONSULAR_PAGES.length + CONSULAR_PAGE_FAMILIES.length);
  });
});

describe("the lists match the pages that read State's scheduling table", () => {
  it("each family is the file path of a real page, route groups included", () => {
    for (const f of CONSULAR_PAGE_FAMILIES) {
      expect(f).toMatch(/^\/\(/);
      expect(existsSync(join(appDir, f, "page.tsx")), `${f}/page.tsx`).toBe(true);
    }
  });

  it("covers every cached page that reads it", () => {
    const pages = walk(appDir);
    expect(pages.length, "found no pages; the walk is blind").toBeGreaterThan(30);
    const families = new Set(CONSULAR_PAGE_FAMILIES.map(urlOf));
    const readers: string[] = [];
    const missing: string[] = [];
    for (const file of pages) {
      const src = readFileSync(file, "utf8");
      // State's consular tables: the scheduling tool, the nonimmigrant issuances by post and the refusals by ground.
      if (!/db\/(consularPosts|nivIssuances|visaRefusals)|getPlanReading/.test(src) || !/export const revalidate\s*=/.test(src)) continue;
      const route = routeOf(file);
      readers.push(route);
      if (families.has(route)) continue;
      if (!(CONSULAR_PAGES as readonly string[]).includes(route)) missing.push(route);
    }
    expect(readers).toEqual(expect.arrayContaining(["/consular-posts", "/consular-posts/[post]", "/visa-refusals"]));
    expect(missing, `read State's table but aren't expired when one lands: ${missing.join(", ")}`).toEqual([]);
  });
});
