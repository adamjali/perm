/**
 * An employer's first letter as the month detail counts it: A to Z, every non-letter under "#".
 * A plain module, so the browser's case list and the server's query share one shape.
 */
export const OTHER_INITIAL = "#";
export const INITIAL_RE = /^[A-Z#]$/;
