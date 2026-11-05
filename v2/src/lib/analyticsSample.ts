/**
 * Which events PostHog's free million can carry (Nov 4 2026). The period from Oct 22 12:39:55 UTC was on course for
 * about 1.15 million events (513,600 in its first 13.4 days), past the free million, and the owner chose to send
 * fewer rather than pay. Page-leave events stop at the SDK (`capture_pageleave: false`, about 4,000 a day), and web
 * vitals come from one session in four (about 3,800 a day saved): a quarter of sessions still gives PostHog's speed
 * medians, and nothing in this codebase reads either event. Bounce rate and time on page in PostHog's own web
 * dashboard lean on page-leave events, so they read lower from Nov 5 2026.
 */

/** The share of sessions whose web vitals are sent: one in this many. */
export const VITALS_ONE_IN = 4;

/** FNV-1a over the session id: the same session is always in or always out, so its figures stay whole. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Whether a web-vitals event from this session is kept. An event with no session id is kept (there are few). */
export function keepsVitals(sessionId: unknown): boolean {
  if (typeof sessionId !== "string" || sessionId.length === 0) return true;
  return hash(sessionId) % VITALS_ONE_IN === 0;
}

/** Whether before_send drops this event to stay inside the free allowance. */
export function droppedForAllowance(event: { event?: string; properties?: Record<string, unknown> }): boolean {
  if (event.event === "$pageleave") return true;
  if (event.event === "$web_vitals") return !keepsVitals(event.properties?.$session_id);
  return false;
}
