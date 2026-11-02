import { afterEach, describe, expect, it } from "vitest";

import { forgetLink, keepLink, keptLink, LINK_KEEP_MS } from "../keptLink";

/**
 * The sealed link from our email is kept in this browser for a day, so a reload, the back button or a new tab
 * still ties the review to the rating (Nov 2 2026: a reload lost it and one person showed twice).
 */
describe("the kept review link", () => {
  afterEach(() => {
    forgetLink();
  });

  it("comes back within the day it was kept", () => {
    keepLink("sealed-token", 1_000);
    expect(keptLink(1_000 + LINK_KEEP_MS - 1)).toBe("sealed-token");
  });

  it("is gone after the day, and after it's forgotten", () => {
    keepLink("sealed-token", 1_000);
    expect(keptLink(1_000 + LINK_KEEP_MS)).toBeNull();
    keepLink("sealed-token", 1_000);
    forgetLink();
    expect(keptLink(1_001)).toBeNull();
  });

  it("never throws when the browser refuses storage", () => {
    // happy-dom's storage is a Proxy a prototype spy doesn't reach, so the whole getter is swapped and put back.
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(() => keepLink("sealed-token")).not.toThrow();
      expect(keptLink()).toBeNull();
      expect(() => forgetLink()).not.toThrow();
    } finally {
      if (real) Object.defineProperty(window, "localStorage", real);
    }
  });

  it("ignores something else stored under its name", () => {
    window.localStorage.setItem("pt.reviewLink", "not json");
    expect(keptLink()).toBeNull();
  });
});
