/**
 * The API's own ceilings that the docs print, kept apart from the server-only
 * modules that enforce them so a static page can read them.
 */

/** Live DOL lookups a UTC day for every API account together (src/lib/api/live.ts). */
export const API_LIVE_DAILY_CAP = 20_000;
