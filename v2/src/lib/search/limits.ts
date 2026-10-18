/**
 * How long a search's words may be, for every search box, route and reader on
 * the site. A plain module, so a browser box and the route behind it read the
 * same numbers.
 */

/**
 * The longest text any search accepts: past every employer name DOL prints, and
 * a cap that runs before anything walks the string (a route can be handed about
 * a megabyte, and a regex over that is the slow path).
 */
export const SEARCH_TEXT_MAX = 120;
/** The shortest text a name search runs on: one letter matches everything. */
export const SEARCH_TEXT_MIN = 2;
/** The longest query worth a fuzzy guess at a name (the "did you mean" index). */
export const SUGGEST_MAX_LENGTH = 80;
