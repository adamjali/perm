import { describe, expect, it } from "vitest";

import { guardStorage, memoryStorage, storageBlocked } from "../storageGuard";

/**
 * A browser blocking this site's storage throws on reading window.localStorage
 * (Oct 19 2026: the sign-in page fell to the error screen on Android Chrome).
 * These stand in a window whose stores throw the way Chrome's do.
 */
function refusingWindow(which: ("localStorage" | "sessionStorage")[]): Window {
  const win = {} as Window;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(win, name, {
      configurable: true,
      get: () => {
        if (which.includes(name)) {
          throw new DOMException(
            `Failed to read the '${name}' property from 'Window': Access is denied for this document.`,
            "SecurityError",
          );
        }
        return memoryStorage();
      },
    });
  }
  return win;
}

describe("guardStorage", () => {
  it("puts an in-memory store where the browser refuses one, and says so", () => {
    const win = refusingWindow(["localStorage", "sessionStorage"]);
    expect(guardStorage(win)).toEqual({ local: true, session: true });
    win.localStorage.setItem("k", "v");
    expect(win.localStorage.getItem("k")).toBe("v");
    expect(() => win.sessionStorage.getItem("x")).not.toThrow();
    expect(storageBlocked(win)).toBe(true);
  });

  it("leaves a working store alone", () => {
    const win = refusingWindow([]);
    expect(guardStorage(win)).toEqual({ local: false, session: false });
    expect(storageBlocked(win)).toBe(false);
  });

  it("flags only a blocked localStorage, which is what sign-in needs", () => {
    const win = refusingWindow(["sessionStorage"]);
    expect(guardStorage(win)).toEqual({ local: false, session: true });
    expect(storageBlocked(win)).toBe(false);
  });

  it("never throws when the property can't be replaced", () => {
    const win = {} as Window;
    Object.defineProperty(win, "localStorage", {
      configurable: false,
      get: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    Object.defineProperty(win, "sessionStorage", { configurable: true, get: () => memoryStorage() });
    expect(() => guardStorage(win)).not.toThrow();
    expect(storageBlocked(win)).toBe(false);
  });

  it("the memory store behaves like Storage", () => {
    const s = memoryStorage();
    s.setItem("a", "1");
    s.setItem("b", "2");
    expect(s.length).toBe(2);
    expect(s.key(0)).toBe("a");
    s.removeItem("a");
    expect(s.getItem("a")).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });
});
