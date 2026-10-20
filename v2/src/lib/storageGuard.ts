/**
 * A browser set to block this site's cookies and data throws on merely reading
 * `window.localStorage`: "SecurityError: Failed to read the 'localStorage'
 * property from 'Window': Access is denied for this document." Convex Auth's
 * Next.js provider reads it while rendering, so the whole sign-in page fell
 * through to the error screen (Oct 19 2026, 7:06 to 7:51 PM EDT: one visitor on
 * Android Chrome, three tries, never saw the form).
 *
 * `guardStorage` runs before the app hydrates (src/instrumentation-client.ts).
 * When reading a store throws, it puts an in-memory store in its place for this
 * page, so the page renders, and records that it did; the sign-in pages then
 * say why signing in can't stick in this browser (`StorageBlockedNotice`).
 */

const FLAG = "__ptStorageBlocked";

type Guarded = Window & { [FLAG]?: boolean };

/** A Storage that lives in memory for this page only. */
export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key: string) => (items.has(key) ? (items.get(key) as string) : null),
    key: (i: number) => [...items.keys()][i] ?? null,
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      items.set(key, String(value));
    },
  };
}

/** Whether reading this store throws (the property read itself, and one get). */
function blocked(win: Window, name: "localStorage" | "sessionStorage"): boolean {
  try {
    win[name].getItem("__pt_probe");
    return false;
  } catch {
    return true;
  }
}

/**
 * Replace each store the browser refuses with an in-memory one. Returns which
 * were replaced. Never throws: a browser that won't let the property be
 * replaced keeps its refusing store, and the page is no worse than before.
 */
export function guardStorage(win: Window = window): { local: boolean; session: boolean } {
  const out = { local: false, session: false };
  for (const [name, key] of [["localStorage", "local"], ["sessionStorage", "session"]] as const) {
    if (!blocked(win, name)) continue;
    try {
      const store = memoryStorage();
      Object.defineProperty(win, name, { configurable: true, get: () => store });
      out[key] = !blocked(win, name);
    } catch {
      out[key] = false;
    }
  }
  if (out.local) (win as Guarded)[FLAG] = true;
  return out;
}

/** True when this page's localStorage is the in-memory stand-in. */
export function storageBlocked(win: Window | undefined = typeof window === "undefined" ? undefined : window): boolean {
  return win !== undefined && (win as Guarded)[FLAG] === true;
}
