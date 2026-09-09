/**
 * The stage feed's row ceiling, in a sibling module because a `route.ts` may
 * export only the handler names: an extra export fails Next's route type
 * generation in `next build` and nowhere earlier. The stage page imports the
 * same value so the count on the page and the count in the feed cannot come
 * from different ceilings.
 */
export const STAGE_FEED_MAX = 25_000;
