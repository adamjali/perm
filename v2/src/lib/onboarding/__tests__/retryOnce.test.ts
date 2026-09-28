import { describe, expect, it, vi } from "vitest";

import { retryOnce } from "../retryOnce";

describe("retryOnce", () => {
  it("returns the first success without retrying", async () => {
    const write = vi.fn().mockResolvedValue("ok");
    await expect(retryOnce(write, 0)).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("retries a failure once and returns the second attempt", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("[Request ID: ab12] Server Error")).mockResolvedValue("ok");
    await expect(retryOnce(write, 0)).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("stops after two attempts and lets the second error through", async () => {
    const write = vi.fn().mockRejectedValue(new Error("still failing"));
    await expect(retryOnce(write, 0)).rejects.toThrow("still failing");
    expect(write).toHaveBeenCalledTimes(2);
  });
});
