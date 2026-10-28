/**
 * The two lines' colours wherever EB-2 and EB-3 sit side by side: lime, the site's
 * primary, for EB-2, and blue, its light second accent, for EB-3. A fill for the
 * bar and an ink edge for the key's swatch, which needs 3:1 against the page.
 */
export const EB_LINE_COLOURS = {
  EB2: { fill: "bg-primary", edge: "border-data-good-ink" },
  EB3: { fill: "bg-chart-blue", edge: "border-data-info-ink" },
} as const;
