import { describe, expect, it, vi } from "vitest";

import { runSendLoop, type SendLoopDeps } from "../newsletterSend";

/**
 * A fake list plus a scripted Resend. `script[email]` is the sequence of
 * results that address answers with, one per attempt; an address not in the
 * script always succeeds.
 */
function arrange(
  emails: string[],
  script: Record<string, Array<{ error?: string }>> = {},
  budget = Number.POSITIVE_INFINITY,
) {
  const attempts: string[] = [];
  const failures: Array<{ email: string; attempt: number }> = [];
  const waits: number[] = [];
  let charged = 0;
  const deps: SendLoopDeps = {
    nextBatch: async (after, limit) => {
      const rest = after === undefined ? emails : emails.filter((e) => e > after);
      return rest.slice(0, limit);
    },
    charge: async () => {
      charged += 1;
      return { allowed: charged <= budget };
    },
    send: async (email) => {
      attempts.push(email);
      const queued = script[email];
      const next = queued?.shift();
      return next ?? {};
    },
    wait: async (ms) => {
      waits.push(ms);
    },
    onFailure: async (email, _error, attempt) => {
      failures.push({ email, attempt });
    },
  };
  return { deps, attempts, failures, waits, charged: () => charged };
}

describe("runSendLoop", () => {
  it("sends every confirmed address once and leaves the cursor on the last one", async () => {
    const { deps, attempts } = arrange(["a@x.test", "b@x.test", "c@x.test"]);
    const r = await runSendLoop(deps, { batch: 25, retryDelayMs: 1 });
    expect(attempts).toEqual(["a@x.test", "b@x.test", "c@x.test"]);
    expect(r).toEqual({ sent: 3, failed: 0, cursor: "c@x.test", budgetHit: false });
  });

  it("retries a failed send ONCE after the delay, and counts it as sent when the retry lands", async () => {
    const { deps, attempts, failures, waits } = arrange(["a@x.test", "b@x.test"], {
      a: [],
      "a@x.test": [{ error: "socket closed" }, {}],
    });
    const r = await runSendLoop(deps, { batch: 25, retryDelayMs: 3000 });
    expect(attempts).toEqual(["a@x.test", "a@x.test", "b@x.test"]);
    expect(waits).toEqual([3000]);
    // The first failure is reported as attempt 1 (a log line), never as the
    // recorded error: that is reserved for the second.
    expect(failures).toEqual([{ email: "a@x.test", attempt: 1 }]);
    expect(r).toEqual({ sent: 2, failed: 0, cursor: "b@x.test", budgetHit: false });
  });

  it("records the second failure and moves on, so one dead address cannot stall the list", async () => {
    const { deps, attempts, failures } = arrange(["a@x.test", "b@x.test"], {
      "a@x.test": [{ error: "422" }, { error: "422" }],
    });
    const r = await runSendLoop(deps, { batch: 25, retryDelayMs: 1 });
    expect(attempts).toEqual(["a@x.test", "a@x.test", "b@x.test"]);
    expect(failures).toEqual([
      { email: "a@x.test", attempt: 1 },
      { email: "a@x.test", attempt: 2 },
    ]);
    expect(r).toEqual({ sent: 1, failed: 1, cursor: "b@x.test", budgetHit: false });
  });

  it("charges the budget before EVERY attempt, the retry included", async () => {
    const { deps, charged } = arrange(["a@x.test", "b@x.test"], {
      "a@x.test": [{ error: "429" }, {}],
    });
    await runSendLoop(deps, { batch: 25, retryDelayMs: 1 });
    // a (fail), a (retry), b = three attempts, three charges.
    expect(charged()).toBe(3);
  });

  it("does not advance past an address whose retry the budget refused, so tomorrow's batch reaches it", async () => {
    // Budget of exactly 2: a's first attempt, then b... but a fails first, so
    // the second charge is a's retry, and the third (refused) never happens:
    // budget 1 means a's retry is refused.
    const { deps, attempts } = arrange(["a@x.test", "b@x.test"], {
      "a@x.test": [{ error: "socket closed" }],
    }, 1);
    const r = await runSendLoop(deps, { batch: 25, retryDelayMs: 1 });
    expect(attempts).toEqual(["a@x.test"]);
    expect(r).toEqual({ sent: 0, failed: 0, cursor: undefined, budgetHit: true });
  });

  it("stops on a refused charge with the cursor on the last address that was actually handled", async () => {
    const { deps } = arrange(["a@x.test", "b@x.test", "c@x.test"], {}, 2);
    const r = await runSendLoop(deps, { batch: 25, retryDelayMs: 1 });
    expect(r).toEqual({ sent: 2, failed: 0, cursor: "b@x.test", budgetHit: true });
  });

  it("pages through the list by the cursor when a batch comes back full", async () => {
    const emails = Array.from({ length: 7 }, (_, i) => `u${i}@x.test`);
    const { deps, attempts } = arrange(emails);
    const nextBatch = vi.fn(deps.nextBatch);
    const r = await runSendLoop({ ...deps, nextBatch }, { batch: 3, retryDelayMs: 1 });
    expect(attempts).toHaveLength(7);
    expect(nextBatch.mock.calls.map((c) => c[0])).toEqual([undefined, "u2@x.test", "u5@x.test"]);
    expect(r.cursor).toBe("u6@x.test");
    expect(r.budgetHit).toBe(false);
  });

  it("resumes after a stored cursor", async () => {
    const { deps, attempts } = arrange(["a@x.test", "b@x.test", "c@x.test"]);
    const r = await runSendLoop(deps, { cursor: "a@x.test", batch: 25, retryDelayMs: 1 });
    expect(attempts).toEqual(["b@x.test", "c@x.test"]);
    expect(r.sent).toBe(2);
  });
});
