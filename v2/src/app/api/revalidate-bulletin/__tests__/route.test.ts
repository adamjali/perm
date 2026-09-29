import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The guards on the bulletin revalidation route, and the two ways its lists can
 * rot without anything turning red: a new page that reads the bulletin and is
 * not listed (it shows last month's cutoffs for a day), and a family pattern
 * that matches no page (revalidatePath on it is a silent no-op).
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag: vi.fn() }));

const { POST } = await import("../route");
const { BULLETIN_PAGES, BULLETIN_PAGE_FAMILIES } = await import("../paths");

const SECRET = "test-secret-value";
const appDir = join(process.cwd(), "src", "app");

function post(secret: string | null = SECRET): Request {
  return new Request("https://permtracker.app/api/revalidate-bulletin", {
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

/** "/(site)/(public)/visa-bulletin/[month]" -> "/visa-bulletin/[month]" */
const urlOf = (fileRoute: string) => "/" + fileRoute.replace(/\([^)]*\)\/?/g, "").replace(/^\/+|\/+$/g, "");

function routeOf(file: string): string {
  return urlOf(file.slice(appDir.length + 1).replace(/\/(page\.tsx|route\.ts)$/, ""));
}

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-bulletin", () => {
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
    for (const p of BULLETIN_PAGES) expect(revalidatePath).toHaveBeenCalledWith(p);
    for (const f of BULLETIN_PAGE_FAMILIES) expect(revalidatePath).toHaveBeenCalledWith(f, "page");
    expect(revalidatePath).toHaveBeenCalledTimes(BULLETIN_PAGES.length + BULLETIN_PAGE_FAMILIES.length);
  });
});

describe("the lists match the pages that read the bulletin", () => {
  it("each family is the file path of a real page, route groups included", () => {
    // Next tags a page by its FILE path, so "/visa-bulletin/[month]" would
    // expire nothing. Checked against the tree, not against a copy of the rule.
    for (const f of BULLETIN_PAGE_FAMILIES) {
      expect(f).toMatch(/^\/\(/);
      expect(existsSync(join(appDir, f, "page.tsx")), `${f}/page.tsx`).toBe(true);
    }
  });

  it("covers every cached page that reads the bulletin", () => {
    const EXCLUDED: Record<string, string> = {
      "/badge/[kind]":
        "its bulletin badges' canonical URLs are listed; the style variants self-heal in their own day",
    };
    const readsBulletin = (src: string) =>
      /turso\/bulletin|getVisaBulletins|BulletinBoard|badgeData/.test(src);

    const pages = walk(appDir);
    expect(pages.length, "found no pages; the walk is blind").toBeGreaterThan(30);

    const families = new Set(BULLETIN_PAGE_FAMILIES.map(urlOf));
    const readers: string[] = [];
    const missing: string[] = [];
    for (const file of pages) {
      const src = readFileSync(file, "utf8");
      if (!readsBulletin(src) || !/export const revalidate\s*=/.test(src)) continue;
      const route = routeOf(file);
      readers.push(route);
      if (route in EXCLUDED || families.has(route)) continue;
      if (!(BULLETIN_PAGES as readonly string[]).includes(route)) missing.push(route);
    }
    // Control: the known readers must be found, or a changed import makes the
    // whole check pass over nothing.
    expect(readers).toEqual(expect.arrayContaining(["/visa-bulletin", "/visa-bulletin/[month]"]));
    expect(missing, `read the bulletin but are not expired when one lands: ${missing.join(", ")}`).toEqual([]);
  });

  it("lists no path that no page serves", () => {
    const routes = walk(appDir).map(routeOf);
    const servedBy = (route: string, path: string) => {
      const rs = route.split("/");
      const ps = path.split("/");
      return rs.length === ps.length && rs.every((seg, i) => (seg.startsWith("[") ? (ps[i] ?? "") !== "" : seg === ps[i]));
    };
    const orphans = (BULLETIN_PAGES as readonly string[]).filter((p) => !routes.some((r) => r === p || servedBy(r, p)));
    expect(orphans, `listed with no page: ${orphans.join(", ")}`).toEqual([]);
  });

  it("lists every bulletin badge", async () => {
    const { BADGE_DEFS } = await import("@/lib/badge");
    const bulletinBadges = BADGE_DEFS.filter((d) => d.group === "Visa bulletin").map((d) => `/badge/${d.id}.svg`);
    expect(bulletinBadges.length).toBeGreaterThan(10);
    for (const b of [...bulletinBadges, "/badge/bulletins-held.svg"]) expect(BULLETIN_PAGES).toContain(b);
  });
});
