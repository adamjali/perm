import { describe, expect, it, vi } from "vitest";

import { retryBriefly } from "../retryBriefly";

describe("retryBriefly", () => {
  it("returns the first success without retrying", async () => {
    const write = vi.fn().mockResolvedValue("ok");
    await expect(retryBriefly(write, [0, 0])).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("retries a failure and returns the next attempt", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("[Request ID: ab12] Server Error")).mockResolvedValue("ok");
    await expect(retryBriefly(write, [0, 0])).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("survives two failures in a row (Sentry 57: the first retry also failed)", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server Error"))
      .mockRejectedValueOnce(new Error("Server Error"))
      .mockResolvedValue("ok");
    await expect(retryBriefly(write, [0, 0])).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("stops after three attempts and lets the last error through", async () => {
    const write = vi.fn().mockRejectedValue(new Error("still failing"));
    await expect(retryBriefly(write, [0, 0])).rejects.toThrow("still failing");
    expect(write).toHaveBeenCalledTimes(3);
  });
});
