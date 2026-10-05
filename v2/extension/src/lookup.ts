/**
 * The service worker's one job: ask permtracker.app about a name, once.
 *
 * Answers are kept in session storage (cleared when the browser closes) for
 * six hours, so going back to a posting, or the same employer's next posting,
 * asks nothing. The request sends no cookies: the extension is anonymous to
 * permtracker.app whether or not you've ever signed in there.
 *
 * Written against injected `fetch` and storage so it's tested without Chrome.
 */
import { lookupUrl, parseLookup, type LookupAnswer } from "./api";

export type LookupReply = { ok: true; answer: LookupAnswer } | { ok: false; message: string };

export interface SessionStore {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_MESSAGE = 300;

export function cacheKey(name: string): string {
  return `lookup:${name.replace(/\s+/g, " ").trim().toLowerCase()}`;
}

export function createLookup(deps: {
  fetch: typeof fetch;
  store: SessionStore;
  version: string;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  return async function lookup(name: string): Promise<LookupReply> {
    const key = cacheKey(name);
    const saved = (await deps.store.get(key).catch((): Record<string, unknown> => ({})))[key] as { at?: number; answer?: unknown } | undefined;
    if (saved && typeof saved.at === "number" && now() - saved.at < CACHE_MS) {
      const answer = parseLookup(saved.answer);
      if (answer) return { ok: true, answer };
    }

    let res: Response;
    try {
      res = await deps.fetch(lookupUrl(name), {
        method: "GET",
        credentials: "omit",
        headers: { "X-PT-Extension": deps.version },
      });
    } catch {
      return { ok: false, message: "Couldn't reach PERM Tracker. Check your connection and try again." };
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok) {
      const said = (json as { error?: { message?: unknown } } | null)?.error?.message;
      return {
        ok: false,
        message:
          typeof said === "string" && said.length > 0
            ? said.slice(0, MAX_MESSAGE)
            : "PERM Tracker couldn't answer just now. Try again in a minute.",
      };
    }
    const answer = parseLookup(json);
    if (!answer) {
      return { ok: false, message: "PERM Tracker sent an answer this version can't read. Updating the extension should fix it." };
    }
    await deps.store.set({ [key]: { at: now(), answer } }).catch(() => undefined);
    return { ok: true, answer };
  };
}
