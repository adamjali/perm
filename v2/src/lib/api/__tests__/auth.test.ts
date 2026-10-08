import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn() }));

const { presentedKey } = await import("../auth");

const req = (headers: Record<string, string>) => new Request("https://permtracker.app/v1/queue", { headers });

describe("presentedKey", () => {
  it("reads a Bearer key, and an X-API-Key header", () => {
    expect(presentedKey(req({ authorization: "Bearer pt_live_abc" }))).toBe("pt_live_abc");
    expect(presentedKey(req({ "x-api-key": " pt_live_abc " }))).toBe("pt_live_abc");
  });

  it("treats an empty Bearer as no key: the Claude Code plugin sends it when its key is left blank", () => {
    expect(presentedKey(req({ authorization: "Bearer " }))).toBeNull();
    expect(presentedKey(req({ authorization: "bearer" }))).toBeNull();
    expect(presentedKey(req({}))).toBeNull();
  });
});
