"use client";

import { useEffect } from "react";
import { initBotId } from "botid/client/core";

/**
 * Vercel BotID, started only where a protected route can be called.
 *
 * BotID proves a request came from a real browser: its client wraps `fetch`
 * and `XMLHttpRequest`, and when a request matches a protected route it fetches
 * a challenge token and attaches it as the `x-is-human` header. The route's
 * server-side `checkBotId()` then answers whether the caller is a bot, and a
 * script calling the API directly gets a 403 before any work is done.
 *
 * It protects ONE route, `POST /api/chat`, because that is the one call where
 * abuse spends money: every chat message draws on the AI providers' quotas
 * (Groq, Mistral, Gemini, OpenRouter, Cerebras). The chat lives only in the
 * signed-in app (ChatWidgetConnected in the (authenticated) layout), so this
 * component lives there too.
 *
 * It used to start in src/instrumentation-client.ts, which Next runs on EVERY
 * page, so every public visitor loaded the BotID client and had `fetch` and
 * `XMLHttpRequest` wrapped for a route they cannot reach without signing in.
 * The challenge scripts themselves (c.js, and Kasada's p.js) only ever load
 * when a protected request fires, so the saving is the client code and the
 * wrapping, not a heavy download; measured 2026-09-23 after an outside audit.
 *
 * NOT protected, on purpose: /api/auth. That route is owned by
 * @convex-dev/auth's proxy (src/proxy.ts) and has no route handler that could
 * call checkBotId(), which also relies on @vercel/request-context and
 * next/headers and throws on its response-header path outside a real route
 * handler. Auth is guarded instead by Cloudflare Turnstile, per-IP and
 * per-email rate limits and server-side name validation (docs/SECURITY.md).
 * Listing it here would collect signals nothing consumes.
 *
 * Every path listed here MUST have a matching `checkBotId()` call in its route
 * handler, and vice versa; `botid-scope.test.ts` holds the two together. Not
 * <BotIdClient> from "botid/client": that renders the setup as an inline
 * <script>, and an effect that calls the same `initBotId` needs no CSP room.
 */
export const BOTID_PROTECTED = [
  // AI chat: the AI-cost protection target. Enforced by checkBotId() in
  // src/app/api/chat/route.ts.
  { path: "/api/chat", method: "POST" },
];

let started = false;

export function BotIdInit() {
  useEffect(() => {
    // Once per page session: initBotId wraps fetch, and a second call would
    // wrap the wrapper. StrictMode runs effects twice in development.
    if (started) return;
    started = true;
    try {
      initBotId({ protect: BOTID_PROTECTED });
    } catch (error) {
      // Don't take the app down if BotID fails to start. The server-side
      // checkBotId() treats an unverifiable request as a bot and refuses it,
      // which is the correct behaviour on init failure anyway.
      console.warn("[BotIdInit] BotID init failed:", error instanceof Error ? error.message : String(error));
    }
  }, []);
  return null;
}
