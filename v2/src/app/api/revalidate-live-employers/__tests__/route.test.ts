import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The guards on a route any stranger can POST to.
 *
 * Every case here is one item from the public-endpoint checklist in
 * v2/CLAUDE.md, and the traversal one is the reason this file exists at all:
 * the handler hands its input to `revalidatePath`, so an unvalidated slug is
 * a path, not a string.
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { POST } = await import("../route");

const SECRET = "test-secret-value";

function post(body: unknown, secret: string | null = SECRET): Request {
  return new Request("https://permtracker.app/api/revalidate-live-employers", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === null ? {} : { "x-revalidate-secret": secret }),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/revalidate-live-employers", () => {
  it("refuses a request with no secret, a wrong secret, or no secret configured", async () => {
    expect((await POST(post({ slugs: ["a"] }, null))).status).toBe(403);
    expect((await POST(post({ slugs: ["a"] }, "wrong"))).status).toBe(403);

    // The unconfigured case matters most: shipping this route before the
    // secret exists must be INERT, not open. An `expected` of undefined must
    // never equal a missing header.
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(post({ slugs: ["a"] }, null))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expires exactly the paths it was given, de-duplicated", async () => {
    const res = await POST(post({ slugs: ["acme-corp", "b-llc", "acme-corp"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ revalidated: 2 });
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      "/perm-employers/acme-corp",
      "/perm-employers/b-llc",
    ]);
    // A LITERAL path every time. The `('/perm-employers/[slug]', 'page')`
    // pattern form would expire all ~33,700 employer pages in one call.
    for (const call of revalidatePath.mock.calls) {
      expect(call).toHaveLength(1);
      expect(call[0]).not.toContain("[");
    }
  });

  it("cannot be walked out of its own path segment", async () => {
    // Without the slug-alphabet check this reaches revalidatePath as
    // "/perm-employers/../.." and expires whatever that resolves to.
    const res = await POST(
      post({ slugs: ["../..", "a/b", "acme%2fcorp", "ACME", "a b", "ok-slug"] }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ revalidated: 1, skipped: 5 });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/perm-employers/ok-slug");
  });

  it("caps the batch, and says 429 rather than 400 so monitoring reads right", async () => {
    const res = await POST(post({ slugs: Array.from({ length: 801 }, (_, i) => `e-${i}`) }));
    // 429 because the payload is well formed and the caller should retry
    // smaller. A 400 sends the next person debugging their JSON.
    expect(res.status).toBe(429);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed body without throwing", async () => {
    expect((await POST(post({ slugs: "not-an-array" }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ slugs: [] }))).status).toBe(400);
    expect((await POST(post({ slugs: [1, null, {}] }))).status).toBe(400);

    const bad = new Request("https://permtracker.app/api/revalidate-live-employers", {
      method: "POST",
      headers: { "x-revalidate-secret": SECRET },
      body: "{ not json",
    });
    expect((await POST(bad)).status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exports no GET, because a GET that mutates is clicked by mail scanners", async () => {
    // Outlook Safe Links, Mimecast, Proofpoint and Barracuda all fetch URLs
    // in inbound mail. This is the module-level version of that rule.
    const mod = await import("../route");
    expect("GET" in mod).toBe(false);
  });
});
