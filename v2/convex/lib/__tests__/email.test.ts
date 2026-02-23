import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmailWithRetry } from "../email";
import type { Resend } from "resend";

// Mock Resend client factory
function createMockResend(
  sendImpl: (...args: unknown[]) => Promise<{ data: { id: string } | null; error: { message: string; name: string } | null }>
) {
  return {
    emails: { send: vi.fn(sendImpl) },
  } as unknown as Resend;
}

describe("sendEmailWithRetry", () => {
  const baseParams = {
    from: "test@example.com",
    to: ["recipient@example.com"],
    subject: "Test",
    html: "<p>Hello</p>",
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("returns data on successful send", async () => {
    const resend = createMockResend(async () => ({
      data: { id: "msg_123" },
      error: null,
    }));

    const result = await sendEmailWithRetry(resend, baseParams);

    expect(result.data).toEqual({ id: "msg_123" });
    expect(result.error).toBeUndefined();
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
  });

  it("returns error immediately for non-retryable API errors", async () => {
    const resend = createMockResend(async () => ({
      data: null,
      error: { message: "Invalid API key", name: "AuthenticationError" },
    }));

    const result = await sendEmailWithRetry(resend, baseParams);

    expect(result.error).toEqual({ message: "Invalid API key", name: "AuthenticationError" });
    expect(result.data).toBeUndefined();
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
  });

  it("retries on rate limit (too many requests) and succeeds", async () => {
    let callCount = 0;
    const resend = createMockResend(async () => {
      callCount++;
      if (callCount === 1) {
        return { data: null, error: { message: "Too many requests", name: "RateLimitError" } };
      }
      return { data: { id: "msg_456" }, error: null };
    });

    const result = await sendEmailWithRetry(resend, baseParams, 3);

    expect(result.data).toEqual({ id: "msg_456" });
    expect(result.error).toBeUndefined();
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("retries on 'rate limit' wording variant", async () => {
    let callCount = 0;
    const resend = createMockResend(async () => {
      callCount++;
      if (callCount <= 2) {
        return { data: null, error: { message: "rate limit exceeded", name: "RateLimitError" } };
      }
      return { data: { id: "msg_789" }, error: null };
    });

    const result = await sendEmailWithRetry(resend, baseParams, 3);

    expect(result.data).toEqual({ id: "msg_789" });
    expect(resend.emails.send).toHaveBeenCalledTimes(3);
  });

  it("returns error after exhausting all retries on rate limit", async () => {
    const resend = createMockResend(async () => ({
      data: null,
      error: { message: "Too many requests", name: "RateLimitError" },
    }));

    const result = await sendEmailWithRetry(resend, baseParams, 2);

    expect(result.error).toEqual({ message: "Too many requests", name: "RateLimitError" });
    expect(result.data).toBeUndefined();
    // Attempt 0, 1, 2 = 3 total calls
    expect(resend.emails.send).toHaveBeenCalledTimes(3);
  });

  it("retries on thrown exceptions (network errors) and succeeds", async () => {
    let callCount = 0;
    const resend = createMockResend(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("ECONNRESET: connection reset");
      }
      return { data: { id: "msg_recovered" }, error: null };
    });

    const result = await sendEmailWithRetry(resend, baseParams, 3);

    expect(result.data).toEqual({ id: "msg_recovered" });
    expect(result.error).toBeUndefined();
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("returns error after exhausting retries on network exceptions", async () => {
    const resend = createMockResend(async () => {
      throw new Error("ENOTFOUND: getaddrinfo failed");
    });

    const result = await sendEmailWithRetry(resend, baseParams, 1);

    expect(result.error).toEqual({
      message: "ENOTFOUND: getaddrinfo failed",
      name: "Error",
    });
    expect(result.data).toBeUndefined();
    // Attempt 0, 1 = 2 total calls (network error is retryable)
    expect(resend.emails.send).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry non-network thrown exceptions", async () => {
    const resend = createMockResend(async () => {
      throw new Error("Invalid API key");
    });

    const result = await sendEmailWithRetry(resend, baseParams, 3);

    expect(result.error).toEqual({
      message: "Invalid API key",
      name: "Error",
    });
    expect(result.data).toBeUndefined();
    // Only 1 call — non-network errors are not retried
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error thrown values", async () => {
    const resend = createMockResend(async () => {
      throw "string error";
    });

    const result = await sendEmailWithRetry(resend, baseParams, 0);

    expect(result.error).toEqual({
      message: "string error",
      name: "UnknownError",
    });
  });

  it("uses 0 maxRetries for no-retry mode", async () => {
    const resend = createMockResend(async () => ({
      data: null,
      error: { message: "Too many requests", name: "RateLimitError" },
    }));

    const result = await sendEmailWithRetry(resend, baseParams, 0);

    expect(result.error).toBeDefined();
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
  });
});
