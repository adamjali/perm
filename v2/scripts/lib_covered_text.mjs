/**
 * Text covered by a highlight: an inline element with a background (or a background drawn by its ::before or
 * ::after) whose box overlaps text painted before it, so the highlight hides those letters. The homepage's
 * heading did this on Nov 2 2026: the lime month on the second line covered the "g" of "deciding" above it,
 * because the highlight's box is as tall as its font's whole ascent and descent and the heading's lines sit
 * closer than that. Text painted after the highlight lies on top of it and stays readable, so only earlier
 * text counts (and, for a positioned highlight, which paints over everything in flow, all of it).
 *
 * `coveredText` runs inside the page (Playwright's page.evaluate): it returns one line per covered word.
 */
export function coveredText() {
  const found = [];
  const INLINE = new Set(["inline", "inline-block", "inline-flex"]);
  const alpha = (color) => {
    if (!color || color === "transparent") return 0;
    const parts = color.match(/rgba?\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean) ?? [];
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
  };
  const paints = (cs) => cs.content !== "none" && cs.content !== "normal" && (alpha(cs.backgroundColor) > 0.05 || cs.backgroundImage !== "none") && !(parseInt(cs.zIndex, 10) < 0);
  const hidden = (el) => !!el.closest('svg, [aria-hidden="true"], [inert], .sr-only');
  const words = (text) => text.trim().replace(/\s+/g, " ").slice(0, 40);

  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (!INLINE.has(cs.display) || hidden(el)) continue;
    const own = alpha(cs.backgroundColor) > 0.05 || cs.backgroundImage !== "none";
    const pseudo = paints(getComputedStyle(el, "::before")) || paints(getComputedStyle(el, "::after"));
    if (!own && !pseudo) continue;
    if (own && parseInt(cs.zIndex, 10) < 0) continue;
    const boxes = [...el.getClientRects()].filter((b) => b.width > 0 && b.height > 0);
    if (!boxes.length) continue;
    // The block that lays the highlight out holds the lines it can reach.
    let block = el.parentElement;
    while (block && (INLINE.has(getComputedStyle(block).display) || getComputedStyle(block).display === "contents")) block = block.parentElement;
    if (!block) continue;
    const positioned = cs.position !== "static";
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (el.contains(n) || !n.textContent.trim() || hidden(n.parentElement)) continue;
      const before = el.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING;
      if (!before && !positioned) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const hit = boxes.some((b) => Math.min(r.right, b.right) - Math.max(r.left, b.left) > 2 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1);
        if (hit) {
          found.push(`"${words(el.textContent)}" covers "${words(n.textContent)}"`);
          break;
        }
      }
    }
  }
  return [...new Set(found)];
}
