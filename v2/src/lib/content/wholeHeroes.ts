import WHOLE_HEROES from "./whole-heroes.json";

/**
 * Header pictures shown whole on a plain ground: a form, a page of the site, an app screen, a document
 * (scripts/make_article_heroes.py writes the list). A card, a topic stack or the article's own frame shows them
 * with object-contain on the same ground, so nothing is cut off; a photograph of a place still fills its box.
 * Oct 26 2026: 110 of 127 headers had been 4:3 crops that ended mid-chart or mid-sentence, and the cards cut
 * them again to 16:9.
 */
const WHOLE = new Set<string>(WHOLE_HEROES);

export function isWholeHero(src: string | null | undefined): boolean {
  return Boolean(src) && WHOLE.has(src as string);
}

/** The picture's own ground, so a box wider or taller than the picture shows no seam (both themes). */
export const WHOLE_HERO_GROUND = "bg-[#F4F4F1]";
