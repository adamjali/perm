import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

import { POST } from "../route";

function req(body: unknown, secret = "s"): Request {
  return new Request("https://permtracker.app/api/revalidate-firm", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify(body),
  });
}

describe("POST /api/revalidate-firm", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    vi.stubEnv("REVALIDATE_SECRET", "s");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a caller without the secret and expires nothing", async () => {
    expect((await POST(req({ slug: "smith-immigration-pllc" }, "wrong"))).status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expires exactly the firm's page", async () => {
    const res = await POST(req({ slug: "smith-immigration-pllc" }));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/perm-attorneys/smith-immigration-pllc");
  });

  it.each([["../../"], ["[slug]"], ["Smith"], [""], [123], [undefined]])("refuses slug %s", async (slug) => {
    expect((await POST(req({ slug }))).status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
