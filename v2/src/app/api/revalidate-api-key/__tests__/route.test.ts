import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const forgetKeys = vi.fn((ids: readonly string[]) => ids.length);
vi.mock("@/lib/api/auth", () => ({ forgetKeys: (ids: readonly string[]) => forgetKeys(ids) }));

import { POST } from "../route";

function req(body: unknown, secret = "s"): Request {
  return new Request("https://permtracker.app/api/revalidate-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify(body),
  });
}

describe("POST /api/revalidate-api-key", () => {
  beforeEach(() => {
    forgetKeys.mockClear();
    vi.stubEnv("REVALIDATE_SECRET", "s");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a caller without the secret and forgets nothing", async () => {
    expect((await POST(req({ keyIds: ["Ab3kXy9Q"] }, "wrong"))).status).toBe(403);
    expect(forgetKeys).not.toHaveBeenCalled();
  });

  it("refuses everyone while the secret isn't set", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    expect((await POST(req({ keyIds: ["Ab3kXy9Q"] }, ""))).status).toBe(403);
  });

  it("forgets exactly the keys named", async () => {
    const res = await POST(req({ keyIds: ["Ab3kXy9Q", "Zz9Zz9Zz"] }));
    expect(res.status).toBe(200);
    expect(forgetKeys).toHaveBeenCalledWith(["Ab3kXy9Q", "Zz9Zz9Zz"]);
  });

  it.each([[["../x"]], [["short"]], [[123]], ["Ab3kXy9Q"], [[]], [Array(21).fill("Ab3kXy9Q")]])(
    "refuses keyIds %j",
    async (keyIds) => {
      expect((await POST(req({ keyIds }))).status).toBe(400);
      expect(forgetKeys).not.toHaveBeenCalled();
    },
  );
});
