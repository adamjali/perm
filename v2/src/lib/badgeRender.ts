import type { BadgeSpec, BadgeStyle, BadgeTheme } from "@/lib/badge";

/**
 * The three shapes a badge can take, drawn as SVG with no external anything.
 *
 * A badge is served cross-origin and rendered by somebody else's page, often
 * inside a sanitiser (GitHub's camo proxy, Reddit, Notion). So: no external
 * fonts, no CSS, no `<style>`, no scripts, no `<image>`, no `foreignObject`.
 * Everything is presentation attributes on primitive shapes, which is the
 * subset every one of those renderers actually keeps.
 *
 * The font stack is the same one shields.io uses, for the same reason: it is
 * the set that exists on the machines these get viewed on. Widths are
 * estimated from character counts rather than measured, so every renderer
 * leaves generous padding instead of fitting tightly.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "Verdana,DejaVu Sans,system-ui,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,DejaVu Sans Mono,monospace";

interface Palette {
  ground: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  rule: string;
}

/**
 * Black or paper, with the same lime on both.
 *
 * The accent does NOT change between themes. It is the brand's one colour and
 * it clears 4.5:1 against black for the value text drawn on it; on the light
 * theme the lime is used as a rule and a fill behind black text, never as
 * text on white, where #2ECC40 is 2.05:1 and would fail.
 */
const PALETTES: Record<BadgeTheme, Palette> = {
  dark: { ground: "#000000", ink: "#FAFAFA", muted: "#A1A1A1", accent: "#2ECC40", accentInk: "#000000", rule: "#2F2F2F" },
  light: { ground: "#FAFAFA", ink: "#0A0A0A", muted: "#5A5A5A", accent: "#2ECC40", accentInk: "#000000", rule: "#D4D4D4" },
};

/** Rough advance width at 11px in the shield font. */
const w11 = (s: string) => Math.round(s.length * 6.6);
/** Rough advance width at a given size, for the card faces. */
const wAt = (s: string, px: number) => Math.round(s.length * px * 0.6);

function open(width: number, height: number, alt: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(alt)}">` +
    `<title>${esc(alt)}</title>`
  );
}

/** The classic two-segment strip, 20px tall. */
function shield(spec: BadgeSpec, p: Palette): string {
  const lw = w11(spec.label) + 12;
  const vw = w11(spec.value) + 12;
  const w = lw + vw;
  return [
    open(w, 20, spec.alt),
    `<rect width="${lw}" height="20" fill="${p.ground}"/>`,
    `<rect x="${lw}" width="${vw}" height="20" fill="${p.accent}"/>`,
    `<g font-family="${FONT}" font-size="11" text-anchor="middle">`,
    `<text x="${lw / 2}" y="14" fill="${p.ink}">${esc(spec.label)}</text>`,
    `<text x="${lw + vw / 2}" y="14" fill="${p.accentInk}" font-weight="bold">${esc(spec.value)}</text>`,
    `</g></svg>`,
  ].join("");
}

/**
 * A stat card: the figure large, its caption under it, and the source and date
 * along the bottom. Where the figure has a history, a sparkline sits behind
 * the lower half.
 *
 * The source line is not decoration. A number this size, on a page that is not
 * ours, has to say who published it and when, or it is just an assertion in a
 * nice typeface.
 */
function card(spec: BadgeSpec, p: Palette): string {
  const h = 116;
  const valueSize = spec.value.length > 12 ? 24 : spec.value.length > 8 ? 30 : 36;
  const w = Math.max(300, wAt(spec.value, valueSize) + 48, wAt(spec.label, 13) + 48);
  const footer = `${spec.source}${spec.asOf ? ` · ${spec.asOf}` : ""}`;

  const parts = [
    open(w, h, spec.alt),
    `<rect width="${w}" height="${h}" fill="${p.ground}"/>`,
  ];

  // The sparkline lives behind the figure, low-contrast, so it reads as
  // texture rather than competing with the number it belongs to.
  if (spec.series && spec.series.length > 1) {
    const top = 46;
    const band = 46;
    const step = (w - 32) / (spec.series.length - 1);
    const pts = spec.series
      .map((v, i) => `${(16 + i * step).toFixed(1)},${(top + band - v * band).toFixed(1)}`)
      .join(" ");
    parts.push(`<polyline points="${pts}" fill="none" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="2"/>`);
  }

  parts.push(
    `<rect width="${w}" height="4" fill="${p.accent}"/>`,
    `<text x="16" y="34" font-family="${FONT}" font-size="13" font-weight="bold" fill="${p.muted}">${esc(spec.label)}</text>`,
    `<text x="16" y="78" font-family="${FONT}" font-size="${valueSize}" font-weight="bold" fill="${p.ink}">${esc(spec.value)}</text>`,
    `<line x1="16" y1="92" x2="${w - 16}" y2="92" stroke="${p.rule}" stroke-width="1"/>`,
    `<text x="16" y="107" font-family="${MONO}" font-size="10" fill="${p.muted}">${esc(footer)}</text>`,
    `</svg>`,
  );
  return parts.join("");
}

/**
 * A proportion bar: the figure, and how large it is against the whole it is
 * part of. Only offered for the review stages, where the whole is a real
 * quantity (everything pending) rather than an invented denominator.
 */
function bar(spec: BadgeSpec, p: Palette): string {
  const w = 300;
  const h = 64;
  const frac = Math.max(0, Math.min(1, spec.fraction ?? 0));
  const track = w - 32;
  // A share can round to nothing and still be thousands of people, so the fill
  // never disappears entirely.
  const fill = Math.max(3, Math.round(track * frac));
  const pct = frac >= 0.001 ? `${(frac * 100).toFixed(frac < 0.1 ? 1 : 0)}%` : "under 0.1%";
  return [
    open(w, h, spec.alt),
    `<rect width="${w}" height="${h}" fill="${p.ground}"/>`,
    `<text x="16" y="22" font-family="${FONT}" font-size="12" font-weight="bold" fill="${p.muted}">${esc(spec.label)}</text>`,
    `<text x="16" y="44" font-family="${FONT}" font-size="18" font-weight="bold" fill="${p.ink}">${esc(spec.value)}</text>`,
    `<text x="${w - 16}" y="44" font-family="${MONO}" font-size="11" fill="${p.muted}" text-anchor="end">${esc(pct)} of pending</text>`,
    `<rect x="16" y="52" width="${track}" height="6" fill="${p.rule}"/>`,
    `<rect x="16" y="52" width="${fill}" height="6" fill="${p.accent}"/>`,
    `</svg>`,
  ].join("");
}

export function renderBadge(spec: BadgeSpec, style: BadgeStyle, theme: BadgeTheme): string {
  const p = PALETTES[theme];
  if (style === "card") return card(spec, p);
  if (style === "bar") return bar(spec, p);
  return shield(spec, p);
}

/**
 * The badge shown when no figure was published.
 *
 * It says so rather than showing the last real value. An embed nobody is
 * watching is exactly where a stale number does its damage, and the whole
 * argument for these badges is that they are current.
 */
export function renderUnavailable(kind: string, style: BadgeStyle, theme: BadgeTheme): string {
  return renderBadge(
    {
      kind,
      label: "PERM Tracker",
      value: "no figure today",
      href: "/",
      alt: "PERM Tracker: no figure was published for this badge today",
      asOf: null,
      source: "no figure published",
    },
    style,
    theme,
  );
}
