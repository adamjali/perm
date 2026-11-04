import { describe, expect, it } from "vitest";

import {
  NEW_KEYS_PER_HOUR,
  PER_ADDRESS_PER_MINUTE,
  PER_MINUTE,
  SENTRY_PER_HOUR,
  SENTRY_PER_KEY_PER_HOUR,
  createClientErrorBudget,
} from "../budget";

/** The error screens' reports are public; these are the limits on what a stranger's loop can spend. */
function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createClientErrorBudget", () => {
  it("lets one address send a few a minute, then refuses until the minute turns", () => {
    const c = clock();
    const b = createClientErrorBudget(c.now);
    for (let i = 0; i < PER_ADDRESS_PER_MINUTE; i++) expect(b.admit("a")).toBe(true);
    expect(b.admit("a")).toBe(false);
    expect(b.admit("b")).toBe(true);
    c.advance(60_000);
    expect(b.admit("a")).toBe(true);
  });

  it("caps everyone together each minute, however many addresses", () => {
    const b = createClientErrorBudget(clock().now);
    let admitted = 0;
    for (let i = 0; i < PER_MINUTE + 50; i++) if (b.admit(`addr-${i}`)) admitted++;
    expect(admitted).toBe(PER_MINUTE);
  });

  it("files a few copies of one kind an hour, and past the new kinds shares one issue", () => {
    const c = clock();
    const b = createClientErrorBudget(c.now);
    for (let i = 0; i < SENTRY_PER_KEY_PER_HOUR; i++) expect(b.sentryKey("same")).toBe("same");
    expect(b.sentryKey("same")).toBeNull();
    for (let i = 1; i < NEW_KEYS_PER_HOUR; i++) expect(b.sentryKey(`kind ${i}`)).toBe(`kind ${i}`);
    expect(b.sentryKey("made up 1")).toBe("other");
    expect(b.sentryKey("made up 2")).toBe("other");
    c.advance(3_600_000);
    expect(b.sentryKey("made up 3")).toBe("made up 3");
  });

  it("stops sending to Sentry at the hour's allowance", () => {
    const b = createClientErrorBudget(clock().now);
    let filed = 0;
    for (let i = 0; i < SENTRY_PER_HOUR * 3; i++) if (b.sentryKey(`k${i % NEW_KEYS_PER_HOUR}`)) filed++;
    expect(filed).toBeLessThanOrEqual(SENTRY_PER_HOUR);
    expect(filed).toBe(Math.min(SENTRY_PER_HOUR, NEW_KEYS_PER_HOUR * SENTRY_PER_KEY_PER_HOUR));
  });
});
