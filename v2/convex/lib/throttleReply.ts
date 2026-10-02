/**
 * What a public form says when one of its limits refuses a request.
 *
 * One shared line ("We can't send confirmation emails right now. Please try
 * again in a little while.") for two different limits with two different
 * waits tells the reader nothing. Neither limit depends on the address, so
 * naming which one fired and how long it
 * lasts leaks nothing: the per-connection limit is about the caller's own
 * network, and the site-wide one is the same for everybody.
 */

import { MS_PER_MINUTE } from "./time";

/** "about 40 minutes", "about 3 hours", "a minute". */
export function waitPhrase(ms: number): string {
  const min = Math.ceil(Math.max(0, ms) / MS_PER_MINUTE);
  if (min <= 1) return "a minute";
  if (min < 90) return `about ${min} minutes`;
  return `about ${Math.round(min / 60)} hours`;
}

/** The caller's own connection has sent too many in its window. */
export function connectionThrottleReply(resetInMs: number): string {
  return `That's a lot of requests from one connection in a short time. Try again in ${waitPhrase(resetInMs)}.`;
}

/** The site-wide daily email budget is spent; it frees up as the day rolls over. */
export function siteThrottleReply(resetInMs: number, what = "confirmation emails"): string {
  return `The site has sent all the ${what} it can for now; there's a daily limit. Try again in ${waitPhrase(resetInMs)}.`;
}
