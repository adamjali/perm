/**
 * The panel's icons, copied from Phosphor's own definitions (bold weight, 256
 * viewBox), never drawn by hand. __tests__/icons.test.ts holds each path to
 * the file it came from in node_modules/@phosphor-icons/react/dist/defs.
 */
export const ICONS = {
  /** Phosphor "X", bold. */
  x: "M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z",
  /** The brand mark's two letters, from public/icon.svg (a 192 viewBox: a #2ecc40 tile, corner radius 24, white glyphs). */
  markP: "M45 61h29a19 19 0 0 1 0 38H58v26H45Zm13 10v19h12.5a9.5 9.5 0 0 0 0-19Z",
  markT: "M101 61h50v10h-19v54h-12V71h-19Z",
} as const;
