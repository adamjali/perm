/**
 * Which events PostHog's free million can carry (Nov 4 2026). The period from Oct 22 12:39:55 UTC was on course for
 * about 1.15 million events (513,600 in its first 13.4 days), past the free million, and the owner chose to send
 * fewer rather than pay. Page-leave events stop at the SDK (`capture_pageleave: false`, about 4,000 a day), and web
 * vitals come from one page load in four (about 4,500 a day saved): a quarter still gives PostHog's speed medians,
 * and nothing in this codebase reads either event. Bounce rate and time on page in PostHog's own web dashboard lean
 * on page-leave events, so they read lower from Nov 5 2026.
 *
 * WHY A PAGE LOAD AND NOT THE SESSION (Nov 5 2026). The first version kept a session's vitals by hashing its
 * `$session_id`, and kept every event that had none. In this site's cookie-free mode PostHog gives an event its
 * session on its own server, after `before_send` has run, so no event had one there and every one was kept: on Nov 5
 * vitals ran at 1.1 for each page view, more than before. A signed-in browser does carry a session id and still
 * hashes it; everyone else is drawn once per page load.
 */

/** The share of page loads (or signed-in sessions) whose web vitals are sent: one in this many. */
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

/** This page load's draw, made once: every vitals event of one load is in or out together. */
const LOAD_DRAW = Math.random();

/**
 * Whether a web-vitals event is kept: by its session when it has one, otherwise by the page load's draw (`draw`, in
 * [0, 1), taken as a parameter so tests can pin it).
 */
export function keepsVitals(sessionId: unknown, draw: number = LOAD_DRAW): boolean {
  if (typeof sessionId === "string" && sessionId.length > 0) return hash(sessionId) % VITALS_ONE_IN === 0;
  return draw < 1 / VITALS_ONE_IN;
}

/** Whether before_send drops this event to stay inside the free allowance. */
export function droppedForAllowance(
  event: { event?: string; properties?: Record<string, unknown> },
  draw: number = LOAD_DRAW,
): boolean {
  if (event.event === "$pageleave") return true;
  if (event.event === "$web_vitals") return !keepsVitals(event.properties?.$session_id, draw);
  return false;
}
