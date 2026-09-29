import { describe, expect, it } from "vitest";

import {
  ERRORS_PER_HOUR,
  HOUR_MS,
  LOGS_PER_HOUR,
  PER_ERROR_PER_HOUR,
  createSentryBudget,
  errorKey,
} from "../sentryBudget";

const err = (value: string, type = "Error") => ({ exception: { values: [{ type, value }] } });

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("the Sentry budget", () => {
  it("counts attempt 1 and attempt 2 of one stall as the same error", () => {
    expect(errorKey(err("turso query deadline (20000ms, attempt 1): SELECT slug"))).toBe(
      errorKey(err("turso query deadline (20000ms, attempt 2): SELECT slug")),
    );
    expect(errorKey(err("a"))).not.toBe(errorKey(err("b")));
  });

  it("sends the first copies of an error, holds the rest, and says how many on the next", () => {
    const c = clock();
    const b = createSentryBudget(c.now);
    const sent = Array.from({ length: 50 }, () => b.error(err("stall 7"))).filter(Boolean);
    expect(sent).toHaveLength(PER_ERROR_PER_HOUR);
    // A different error still gets through, and carries the held count.
    const next = b.error(err("something else"));
    expect(next?.tags?.["budget.held_before"]).toBe(50 - PER_ERROR_PER_HOUR);
    // The count is reported once, then resets.
    expect(b.error(err("a third error"))?.tags?.["budget.held_before"]).toBeUndefined();
  });

  it("caps all errors together, then opens again the next hour", () => {
    const c = clock();
    const b = createSentryBudget(c.now);
    let sent = 0;
    for (let i = 0; i < 200; i++) if (b.error(err(`distinct ${String.fromCharCode(65 + (i % 26))}${i % 7 ? "x" : "y"}${Math.floor(i / 52)}`))) sent++;
    expect(sent).toBe(ERRORS_PER_HOUR);
    c.advance(HOUR_MS);
    expect(b.error(err("after the hour"))).not.toBeNull();
  });

  it("never drops anything on an ordinary day's volume", () => {
    const c = clock();
    const b = createSentryBudget(c.now);
    // Ten errors and a thousand log lines spread over a day.
    let dropped = 0;
    for (let h = 0; h < 24; h++) {
      if (h < 10 && !b.error(err(`daily ${h % 3}`))) dropped++;
      for (let i = 0; i < 42; i++) if (!b.log({ attributes: {} })) dropped++;
      c.advance(HOUR_MS);
    }
    expect(dropped).toBe(0);
  });

  it("caps log lines per hour and reports what it held", () => {
    const c = clock();
    const b = createSentryBudget(c.now);
    let sent = 0;
    for (let i = 0; i < LOGS_PER_HOUR + 40; i++) if (b.log({ attributes: {} })) sent++;
    expect(sent).toBe(LOGS_PER_HOUR);
    c.advance(HOUR_MS);
    expect(b.log({ attributes: {} })?.attributes?.["budget.held_before"]).toBe(40);
  });
});
