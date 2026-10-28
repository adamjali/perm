import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The guards on the policy revalidation route, and the way its list can rot:
 * a page that starts reading the rule pipeline without being expired when a
 * rule moves.
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag: vi.fn() }));

const { POST } = await import("../route");
const { POLICY_PAGES, RULE_PARTS } = await import("../paths");

const SECRET = "test-secret-value";
const appDir = join(process.cwd(), "src", "app");

function post(secret: string | null = SECRET): Request {
  return new Request("https://permtracker.app/api/revalidate-policy", {
    method: "POST",
    headers: secret === null ? {} : { "x-revalidate-secret": secret },
  });
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "page.tsx") out.push(p);
  }
  return out;
}

const routeOf = (file: string) =>
  "/" + file.slice(appDir.length + 1).replace(/\/page\.tsx$/, "").replace(/\([^)]*\)\/?/g, "").replace(/^\/+|\/+$/g, "");

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-policy", () => {
  it("refuses no secret, a wrong secret, and an unconfigured secret", async () => {
    expect((await POST(post(null))).status).toBe(403);
    expect((await POST(post("wrong"))).status).toBe(403);
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(post(null))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expires every listed page, and every article that shows a rule's status", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    for (const p of POLICY_PAGES) expect(revalidatePath).toHaveBeenCalledWith(p);
    // Control: the article on DOL's PERM proposal uses RuleStatus and RuleCompare.
    expect(revalidatePath).toHaveBeenCalledWith("/blog/proposed-perm-rule-rin-1205-ac29");
    const articles = revalidatePath.mock.calls.map((c) => c[0] as string).filter((p) => !(POLICY_PAGES as readonly string[]).includes(p));
    for (const a of articles) {
      const [, type, slug] = a.split("/");
      const src = readFileSync(join(process.cwd(), "content", type!, `${slug}.mdx`), "utf8");
      expect(RULE_PARTS.some((t) => src.includes(`<${t}`)), `${a} expired without a rule part`).toBe(true);
    }
  });

  it("lists every cached page that reads the rule pipeline", () => {
    const readers = walk(appDir)
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return /db\/(rulePipeline|policyNotices)/.test(src) && /export const revalidate\s*=/.test(src);
      })
      .map(routeOf);
    // Control: the known reader must be found, or the check passes over nothing.
    expect(readers).toContain("/policy-changes");
    expect(readers.filter((r) => !(POLICY_PAGES as readonly string[]).includes(r))).toEqual([]);
  });
});
