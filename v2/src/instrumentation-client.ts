/**
 * Next.js client-side instrumentation.
 *
 * Initializes Vercel BotID to protect critical API routes from automated
 * abuse. BotID passively collects browser/TLS/interaction signals on every
 * page load, then the server-side checkBotId() call in each protected
 * route's handler verifies the caller had a real browser.
 *
 * Direct-API attackers (curl, bare fetch, scripts without a real browser
 * loading this file) never collect signals, so checkBotId() returns
 * isBot=true and the route returns 403 before any work is done.
 *
 * Protected routes here MUST match the paths that call checkBotId() on
 * the server — mismatches cause the server to reject all requests as
 * unverifiable.
 */

import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    // AI chat — biggest AI-cost protection target. One abusive burst can
    // burn through Gemini/OpenRouter/Mistral/Groq/Cerebras free-tier
    // quotas in minutes.
    { path: "/api/chat", method: "POST" },

    // Convex Auth sign-in/sign-up/reset routes. @convex-dev/auth/nextjs
    // proxies these through /api/auth before hitting Convex, so BotID can
    // see and block them here.
    { path: "/api/auth/*", method: "POST" },
  ],
});
