import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The refresh route for the review pages: shut without the secret, both fixed paths on a valid call, and a list
 * that can't drift from the pages that read the reviews (a page left off would keep an approved review hidden, or
 * a declined one shown, for up to a day with nothing red anywhere).
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { POST } = await import("../route");
const { REVIEW_PAGES } = await import("../paths");

const SECRET = "test-secret-value";
const post = (secret: string | null = SECRET) =>
  new Request("https://permtracker.app/api/revalidate-reviews", {
    method: "POST",
    headers: secret === null ? {} : { "x-revalidate-secret": secret },
  });

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-reviews", () => {
  it("refuses no secret, a wrong secret, and an unconfigured one", async () => {
    expect((await POST(post(null))).status).toBe(403);
    expect((await POST(post("wrong"))).status).toBe(403);
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(post(null))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refreshes each page that shows the reviews, by its literal path", async () => {
    expect((await POST(post())).status).toBe(200);
    expect(revalidatePath.mock.calls).toEqual(REVIEW_PAGES.map((p) => [p]));
  });
});

describe("the path list", () => {
  it("names every public page that reads the reviews", () => {
    const appDir = join(process.cwd(), "src/app");
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === "page.tsx" && readFileSync(full, "utf8").includes("getSiteReviews(")) pages.push(full);
      }
    };
    walk(appDir);
    const routes = pages
      .map((f) => "/" + relative(appDir, f).replace(/\/?page\.tsx$/, "").split("/").filter((s) => !s.startsWith("(")).join("/"))
      .sort();
    expect(routes.length).toBeGreaterThan(0);
    expect(routes).toEqual([...REVIEW_PAGES].sort());
  });
});
