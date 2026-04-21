/**
 * Per-user rate limits enforced INSIDE Convex mutations + actions.
 *
 * Sits alongside per-email + per-IP limits (convex/authRateLimit.ts):
 *   - Per-email  → one identity brute-forcing one account
 *   - Per-IP     → one source hitting many unique emails
 *   - Per-user   → one authenticated user (or compromised JWT) hammering
 *                   their own expensive write/action endpoints
 *
 * The Convex Rate Limiter component uses write-transactional state, so
 * calls can only live inside `mutation` / `action` / `internalMutation`
 * handlers. Queries (read-only) are NOT rate-limited here — they're auto-
 * cached by Convex, cheap to serve, and don't write to the DB. If a read
 * endpoint becomes a concrete abuse vector later, we'll wrap it with an
 * internal mutation for throttling.
 *
 * Usage:
 *   const userId = await getCurrentUserId(ctx);
 *   await rateLimiter.limit(ctx, "caseCreate", { key: userId, throws: true });
 *
 * `throws: true` emits an error whose message includes "rate limit", which
 * the existing client-side error handlers already recognize + surface.
 */

import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Writes on core case data (mutations)
  caseCreate: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 10 },
  caseUpdate: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 10 },

  // Chat/conversation creation (mutations)
  conversationCreate: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },

  // Notifications bulk operations (mutations)
  notificationsMarkAllRead: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },

  // Reordering (drag-drop can fire rapidly during manipulation — high burst capacity)
  userCaseOrderSave: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },

  // Templates (mutations)
  jobTemplateCreate: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },

  // External-API-spend action paths (Tavily, Brave search for knowledge)
  knowledgeSearch: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },

  // Push subscription management (low churn expected)
  pushSubscriptionSave: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 3 },
});
